/**
 * Authorization tests against the real migrations (PGlite).
 *
 * Every test runs its statements as a given user with role `authenticated`
 * (or `anon`), so Row Level Security, column grants and triggers are all in
 * force, exactly as they are for a browser holding a user JWT.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createDatabase, createUser, expectDenied } from './helpers/db.js';

let db;
const ids = {};

async function su(sql, params) {
  return (await db.query(sql, params)).rows;
}

before(async () => {
  db = await createDatabase();

  // Facilities
  const [facA] = await su(
    `insert into healthcare_facilities (name, type, published) values ('Puskesmas A','puskesmas',true) returning id`,
  );
  const [facB] = await su(
    `insert into healthcare_facilities (name, type, published) values ('Puskesmas B','puskesmas',true) returning id`,
  );
  const [facHidden] = await su(
    `insert into healthcare_facilities (name, type, published) values ('Draft Clinic','clinic',false) returning id`,
  );
  ids.facA = facA.id;
  ids.facB = facB.id;
  ids.facHidden = facHidden.id;

  // Accounts. Every one starts as a patient; privileged roles are granted the
  // way an operator would, with a trusted server context.
  ids.patientUser = await createUser(db, { email: 'patient@t.test', fullName: 'Siti Patient' });
  ids.patient2User = await createUser(db, { email: 'patient2@t.test', fullName: 'Budi Patient' });
  ids.docA = await createUser(db, { email: 'docA@t.test', fullName: 'dr. A' });
  ids.chwA = await createUser(db, { email: 'chwA@t.test', fullName: 'CHW A' });
  ids.docB = await createUser(db, { email: 'docB@t.test', fullName: 'dr. B' });
  ids.admin = await createUser(db, { email: 'admin@t.test', fullName: 'Admin One' });
  ids.admin2 = await createUser(db, { email: 'admin2@t.test', fullName: 'Admin Two' });

  await su(`update profiles set role='professional' where id = any($1)`, [
    [ids.docA, ids.chwA, ids.docB],
  ]);
  await su(`update profiles set role='admin' where id = any($1)`, [[ids.admin, ids.admin2]]);

  await su(
    `insert into healthcare_professional_profiles (profile_id, clinical_role, can_review, facility_id) values
       ($1,'physician',true,$4), ($2,'chw',false,$4), ($3,'physician',true,$5)`,
    [ids.docA, ids.chwA, ids.docB, ids.facA, ids.facB],
  );
  // An admin whose staff record claims can_review must still not be able to review.
  await su(
    `insert into healthcare_professional_profiles (profile_id, clinical_role, can_review, facility_id)
     values ($1,'coordinator',true,$2)`,
    [ids.admin, ids.facA],
  );

  // Patients: p1 is the account-linked patient at A, p2 sits at B.
  const [p1] = await su(
    `insert into patient_profiles (name, sex, profile_id, home_facility_id)
     values ('Siti Patient','female',$1,$2) returning id`,
    [ids.patientUser, ids.facA],
  );
  const [p2] = await su(
    `insert into patient_profiles (name, sex, home_facility_id) values ('Walk-in B','male',$1) returning id`,
    [ids.facB],
  );
  const [p3] = await su(
    `insert into patient_profiles (name, sex, profile_id) values ('Budi Patient','male',$1) returning id`,
    [ids.patient2User],
  );
  ids.p1 = p1.id;
  ids.p2 = p2.id;
  ids.p3 = p3.id;
});

after(async () => {
  await db?.close();
});

describe('accounts', () => {
  test('sign-up is always a patient, even when the client asks for admin', async () => {
    const id = await createUser(db, {
      email: 'sneaky@t.test',
      fullName: 'Sneaky',
      metadata: { role: 'admin', status: 'active' },
    });
    const [row] = await su('select role, status from profiles where id = $1', [id]);
    assert.equal(row.role, 'patient');
  });

  test('a user cannot promote themselves or reactivate themselves', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const e1 = await expectDenied(c.query(`update profiles set role='admin' where id = $1`, [ids.patientUser]));
      assert.match(e1.message, /permission denied/i);
      const e2 = await expectDenied(c.query(`update profiles set status='active' where id = $1`, [ids.patientUser]));
      assert.match(e2.message, /permission denied/i);
    });
    const [row] = await su('select role from profiles where id=$1', [ids.patientUser]);
    assert.equal(row.role, 'patient');
  });

  test('a user can rename themselves but not read another profile', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      await c.query(`update profiles set full_name='Siti R.' where id = $1`, [ids.patientUser]);
      const rows = await c.rows('select id from profiles');
      assert.deepEqual(rows.map((r) => r.id), [ids.patientUser]);
    });
  });

  test('administrators can list all accounts', async () => {
    await asUser(db, ids.admin, async (c) => {
      const rows = await c.rows('select id from profiles');
      assert.ok(rows.length >= 7);
    });
  });

  test('non-admins cannot call the admin functions', async () => {
    for (const uid of [ids.patientUser, ids.docA]) {
      await asUser(db, uid, async (c) => {
        const e = await expectDenied(c.query(`select admin_set_account_role($1,'admin')`, [ids.patient2User]));
        assert.match(e.message, /forbidden/i);
        const e2 = await expectDenied(c.query(`select admin_set_account_status($1,'suspended')`, [ids.patient2User]));
        assert.match(e2.message, /forbidden/i);
      });
    }
  });

  test('an admin cannot change their own role or status', async () => {
    await asUser(db, ids.admin, async (c) => {
      const e1 = await expectDenied(c.query(`select admin_set_account_role($1,'patient')`, [ids.admin]));
      assert.match(e1.message, /own role/i);
      const e2 = await expectDenied(c.query(`select admin_set_account_status($1,'suspended')`, [ids.admin]));
      assert.match(e2.message, /own status/i);
    });
  });

  test('role changes are audited', async () => {
    await asUser(db, ids.admin, async (c) => {
      await c.query(`select admin_set_account_role($1,'professional')`, [ids.patient2User]);
    });
    const audit = await su(
      `select action, detail from audit_logs where action='account.role-changed' and subject='patient2@t.test'`,
    );
    assert.equal(audit.length, 1);
    assert.match(audit[0].detail, /patient to professional/);
    await su(`update profiles set role='patient' where id=$1`, [ids.patient2User]);
  });

  test('an admin can demote another admin, and one active admin always remains', async () => {
    // The actor must be an active admin other than the target, so a demotion can
    // never remove the last one: the "last active admin" check inside the
    // function is defence in depth behind that.
    await asUser(db, ids.admin, async (c) => {
      await c.query(`select admin_set_account_role($1,'professional')`, [ids.admin2]);
    });
    const [{ n }] = await su(`select count(*)::int as n from profiles where role='admin' and status='active'`);
    assert.ok(n >= 1);
    await su(`update profiles set role='admin' where id=$1`, [ids.admin2]);
  });

  test('a suspended administrator has no authority', async () => {
    await su(`update profiles set status='suspended' where id=$1`, [ids.admin2]);
    try {
      await asUser(db, ids.admin2, async (c) => {
        const e = await expectDenied(c.query(`select admin_set_account_role($1,'professional')`, [ids.docB]));
        assert.match(e.message, /forbidden/i);
      });
    } finally {
      await su(`update profiles set status='active' where id=$1`, [ids.admin2]);
    }
  });
  test('a suspended account matches no policy', async () => {
    await su(`update profiles set status='suspended' where id=$1`, [ids.patientUser]);
    try {
      await asUser(db, ids.patientUser, async (c) => {
        assert.deepEqual(await c.rows('select id from patient_profiles'), []);
        assert.deepEqual(await c.rows('select id from screenings'), []);
      });
    } finally {
      await su(`update profiles set status='active' where id=$1`, [ids.patientUser]);
    }
  });
});

describe('patient records', () => {
  test('a patient sees only their own clinical record', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const rows = await c.rows('select id from patient_profiles');
      assert.deepEqual(rows.map((r) => r.id), [ids.p1]);
    });
  });

  test('a professional sees only patients at their own facility', async () => {
    await asUser(db, ids.docA, async (c) => {
      const rows = await c.rows('select id from patient_profiles');
      assert.deepEqual(rows.map((r) => r.id), [ids.p1]);
    });
    await asUser(db, ids.docB, async (c) => {
      const rows = await c.rows('select id from patient_profiles');
      assert.deepEqual(rows.map((r) => r.id), [ids.p2]);
    });
  });

  test('a patient with no home facility is invisible to every professional', async () => {
    for (const uid of [ids.docA, ids.docB, ids.chwA]) {
      await asUser(db, uid, async (c) => {
        const rows = await c.rows('select id from patient_profiles where id = $1', [ids.p3]);
        assert.equal(rows.length, 0);
      });
    }
  });

  test('administrators can read patient records for management', async () => {
    await asUser(db, ids.admin, async (c) => {
      const rows = await c.rows('select id from patient_profiles');
      assert.equal(rows.length, 3);
    });
  });

  test('a professional can only register patients at their own facility', async () => {
    await asUser(db, ids.docA, async (c) => {
      await c.query(
        `insert into patient_profiles (name, sex, home_facility_id, created_by) values ('New A','male',$1,$2)`,
        [ids.facA, ids.docA],
      );
      const e = await expectDenied(
        c.query(
          `insert into patient_profiles (name, sex, home_facility_id, created_by) values ('New B','male',$1,$2)`,
          [ids.facB, ids.docA],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('a patient cannot register other patients', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into patient_profiles (name, home_facility_id, created_by) values ('X',$1,$2)`,
          [ids.facA, ids.patientUser],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('only an administrator can move a patient to another facility; mrn is immutable', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(
        c.query(`update patient_profiles set home_facility_id=$1 where id=$2`, [ids.facB, ids.p1]),
      );
      assert.match(e.message, /administrator/i);
      const e2 = await expectDenied(c.query(`update patient_profiles set mrn='X' where id=$1`, [ids.p1]));
      assert.match(e2.message, /permission denied/i);
    });
    await asUser(db, ids.patientUser, async (c) => {
      const e = await expectDenied(
        c.query(`update patient_profiles set home_facility_id=$1 where id=$2`, [ids.facB, ids.p1]),
      );
      assert.match(e.message, /administrator/i);
    });
    await asUser(db, ids.admin, async (c) => {
      await c.query(`update patient_profiles set home_facility_id=$1 where id=$2`, [ids.facB, ids.p3]);
    });
    await su(`update patient_profiles set home_facility_id=null where id=$1`, [ids.p3]);
  });

  test('notes are visible only to assigned professionals', async () => {
    await asUser(db, ids.docA, async (c) => {
      await c.query(
        `insert into patient_notes (patient_id, author_id, body) values ($1,$2,'seen at clinic')`,
        [ids.p1, ids.docA],
      );
      assert.equal((await c.rows('select id from patient_notes')).length, 1);
      const e = await expectDenied(
        c.query(`insert into patient_notes (patient_id, author_id, body) values ($1,$2,'x')`, [ids.p2, ids.docA]),
      );
      assert.match(e.message, /row-level security/i);
    });
    for (const uid of [ids.patientUser, ids.admin, ids.docB]) {
      await asUser(db, uid, async (c) => {
        assert.equal((await c.rows('select id from patient_notes')).length, 0);
      });
    }
  });
});

describe('screenings and clinical content', () => {
  let screeningId;

  test('a professional files a screening for an assigned patient only', async () => {
    await asUser(db, ids.docA, async (c) => {
      const [row] = await c.rows(
        `insert into screenings (patient_id, facility_id, operator_id, status)
         values ($1,$2,$3,'draft') returning id`,
        [ids.p1, ids.facA, ids.docA],
      );
      screeningId = row.id;
      await c.query(`insert into screening_reports (screening_id, symptoms) values ($1, '{"coughWeeks":3}')`, [
        screeningId,
      ]);

      const e = await expectDenied(
        c.query(`insert into screenings (patient_id, facility_id, operator_id) values ($1,$2,$3)`, [
          ids.p2,
          ids.facA,
          ids.docA,
        ]),
      );
      assert.match(e.message, /row-level security/i);

      // Cannot file as someone else.
      const e2 = await expectDenied(
        c.query(`insert into screenings (patient_id, facility_id, operator_id) values ($1,$2,$3)`, [
          ids.p1,
          ids.facA,
          ids.chwA,
        ]),
      );
      assert.match(e2.message, /row-level security/i);
    });
  });

  test('patients and other professionals cannot file screenings', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const e = await expectDenied(
        c.query(`insert into screenings (patient_id, facility_id, operator_id) values ($1,$2,$3)`, [
          ids.p1,
          ids.facA,
          ids.patientUser,
        ]),
      );
      assert.match(e.message, /row-level security/i);
    });
    await asUser(db, ids.docB, async (c) => {
      const e = await expectDenied(
        c.query(`insert into screenings (patient_id, facility_id, operator_id) values ($1,$2,$3)`, [
          ids.p1,
          ids.facB,
          ids.docB,
        ]),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('a draft is hidden from the patient; completing it is the operator only', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      assert.equal((await c.rows('select id from screenings')).length, 0);
    });
    await asUser(db, ids.chwA, async (c) => {
      // Same facility, so the CHW can see it, but did not create it.
      assert.equal((await c.rows('select id from screenings where id=$1', [screeningId])).length, 1);
      const r = await c.query(`update screenings set status='queued' where id=$1`, [screeningId]);
      assert.equal(r.affectedRows, 0);
    });
    await asUser(db, ids.docA, async (c) => {
      await c.query(`update screenings set status='queued' where id=$1`, [screeningId]);
    });
  });

  test('status cannot be forged by the operator', async () => {
    await asUser(db, ids.docA, async (c) => {
      // Once submitted, the record is no longer editable by its operator.
      for (const status of ['reviewed', 'closed', 'referred', 'awaiting-review']) {
        const r = await c.query(`update screenings set status=$2 where id=$1`, [screeningId, status]);
        assert.equal(r.affectedRows, 0);
      }
      // A draft can only move to queued.
      const [d] = await c.rows(
        `insert into screenings (patient_id, facility_id, operator_id, status) values ($1,$2,$3,'draft') returning id`,
        [ids.p1, ids.facA, ids.docA],
      );
      for (const status of ['reviewed', 'closed', 'referred', 'awaiting-review']) {
        const e = await expectDenied(c.query(`update screenings set status=$2 where id=$1`, [d.id, status]));
        assert.match(e.message, /Illegal screening status/i);
      }
    });
  });

  test('administrators see screening metadata but never the clinical content', async () => {
    await asUser(db, ids.admin, async (c) => {
      assert.equal((await c.rows('select id from screenings where id=$1', [screeningId])).length, 1);
      assert.equal((await c.rows('select * from screening_reports')).length, 0);
      assert.equal((await c.rows('select * from screening_reviews')).length, 0);
    });
  });

  test('the patient cannot read the clinical report', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      assert.equal((await c.rows('select * from screening_reports')).length, 0);
    });
  });

  test('image path and analysis cannot be written by a client', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e1 = await expectDenied(
        c.query(`update screening_reports set image_path='../other/secret.png' where screening_id=$1`, [screeningId]),
      );
      assert.match(e1.message, /permission denied/i);
      const e2 = await expectDenied(
        c.query(`update screening_reports set analysis='{"TB":0.99}', model_status='completed' where screening_id=$1`, [screeningId]),
      );
      assert.match(e2.message, /permission denied/i);
    });
  });

  test('a community health worker (can_review = false) cannot sign off a review', async () => {
    await asUser(db, ids.chwA, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
           values ($1,$2,'agrees','refer','ok')`,
          [screeningId, ids.chwA],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('administrators cannot review, even with a can_review staff record', async () => {
    await asUser(db, ids.admin, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
           values ($1,$2,'agrees','refer','ok')`,
          [screeningId, ids.admin],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('a reviewer at another facility cannot review', async () => {
    await asUser(db, ids.docB, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
           values ($1,$2,'agrees','refer','ok')`,
          [screeningId, ids.docB],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('a reviewer cannot sign as someone else', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
           values ($1,$2,'agrees','refer','ok')`,
          [screeningId, ids.docB],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('an assigned reviewer signs off once, and the status follows', async () => {
    await asUser(db, ids.docA, async (c) => {
      await c.query(
        `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
         values ($1,$2,'agrees','observe','Watch and repeat in a month')`,
        [screeningId, ids.docA],
      );
      const [row] = await c.rows('select status from screenings where id=$1', [screeningId]);
      assert.equal(row.status, 'reviewed');

      const e = await expectDenied(
        c.query(
          `insert into screening_reviews (screening_id, reviewer_id, agreement, decision, notes)
           values ($1,$2,'agrees','no-action','again')`,
          [screeningId, ids.docA],
        ),
      );
      assert.match(e.message, /duplicate key|not open for review/i);
    });
  });

  test('the patient can read the review of their own screening, nobody else outside care can', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const rows = await c.rows('select notes from screening_reviews');
      assert.equal(rows.length, 1);
      assert.equal((await c.rows('select id from screenings')).length, 1);
    });
    await asUser(db, ids.patient2User, async (c) => {
      assert.equal((await c.rows('select * from screening_reviews')).length, 0);
      assert.equal((await c.rows('select * from screenings')).length, 0);
    });
    await asUser(db, ids.docB, async (c) => {
      assert.equal((await c.rows('select * from screening_reviews')).length, 0);
    });
  });

  test('a real model result moves a queued screening to awaiting-review', async () => {
    const [s] = await su(
      `insert into screenings (patient_id, facility_id, operator_id, status)
       values ($1,$2,$3,'queued') returning id`,
      [ids.p1, ids.facA, ids.docA],
    );
    await su(`insert into screening_reports (screening_id) values ($1)`, [s.id]);
    const [before] = await su(`select status from screenings where id=$1`, [s.id]);
    assert.equal(before.status, 'queued');
    await su(`update screening_reports set model_status='completed', analysis='{}' where screening_id=$1`, [s.id]);
    const [after] = await su(`select status from screenings where id=$1`, [s.id]);
    assert.equal(after.status, 'awaiting-review');
  });

  test('deleting is limited to the operator and to drafts', async () => {
    await asUser(db, ids.docA, async (c) => {
      const [d] = await c.rows(
        `insert into screenings (patient_id, facility_id, operator_id, status) values ($1,$2,$3,'draft') returning id`,
        [ids.p1, ids.facA, ids.docA],
      );
      const r1 = await c.query(`delete from screenings where id=$1`, [screeningId]);
      assert.equal(r1.affectedRows, 0, 'a reviewed screening is not deletable');
      const r2 = await c.query(`delete from screenings where id=$1`, [d.id]);
      assert.equal(r2.affectedRows, 1);
    });
  });
});

describe('referrals and follow-ups', () => {
  let referralId;

  test('creating a referral records its first event', async () => {
    await asUser(db, ids.docA, async (c) => {
      const [r] = await c.rows(
        `insert into referrals (patient_id, from_facility_id, to_facility_id, requested_service, priority, status, created_by, assigned_worker_id)
         values ($1,$2,$3,'tcm-genexpert','urgent','pending',$4,$4) returning id, code`,
        [ids.p1, ids.facA, ids.facB, ids.docA],
      );
      referralId = r.id;
      assert.match(r.code, /^REF-\d{4}$/);
      const events = await c.rows('select from_status, to_status from referral_events where referral_id=$1', [referralId]);
      assert.deepEqual(events, [{ from_status: null, to_status: 'pending' }]);
    });
  });

  test('referrals can only be created for assigned patients, from the own facility', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(
        c.query(
          `insert into referrals (patient_id, from_facility_id, to_facility_id, requested_service, status, created_by)
           values ($1,$2,$3,'cxr','pending',$4)`,
          [ids.p2, ids.facA, ids.facB, ids.docA],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
  });

  test('status moves only through set_referral_status, which writes history', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(c.query(`update referrals set status='closed' where id=$1`, [referralId]));
      assert.match(e.message, /permission denied/i);

      await c.query(`select set_referral_status($1,'appointment-scheduled','Booked for Monday')`, [referralId]);
      const events = await c.rows(
        `select to_status, note from referral_events where referral_id=$1 order by created_at, to_status`,
        [referralId],
      );
      assert.equal(events.length, 2);
      assert.ok(events.some((ev) => ev.to_status === 'appointment-scheduled' && ev.note === 'Booked for Monday'));
    });
  });

  test('another facility, a patient and an admin cannot change referral status', async () => {
    for (const uid of [ids.docB, ids.patientUser, ids.admin]) {
      await asUser(db, uid, async (c) => {
        const e = await expectDenied(c.query(`select set_referral_status($1,'closed')`, [referralId]));
        assert.match(e.message, /not found/i);
      });
    }
  });

  test('the patient reads their referrals; an admin sees none', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      assert.equal((await c.rows('select id from referrals')).length, 1);
      assert.ok((await c.rows('select id from referral_events')).length >= 1);
    });
    await asUser(db, ids.admin, async (c) => {
      assert.equal((await c.rows('select id from referrals')).length, 0);
    });
    await asUser(db, ids.patient2User, async (c) => {
      assert.equal((await c.rows('select id from referrals')).length, 0);
    });
  });

  test('follow-ups: assigned professional only, and links must match the patient', async () => {
    await asUser(db, ids.docA, async (c) => {
      const [f] = await c.rows(
        `insert into follow_up_records (patient_id, referral_id, reason, due_date, created_by, assigned_worker_id)
         values ($1,$2,'referral-attendance', current_date + 7, $3, $3) returning id, code`,
        [ids.p1, referralId, ids.docA],
      );
      assert.match(f.code, /^FU-\d{4}$/);
      await c.query(
        `insert into follow_up_attempts (follow_up_id, actor_id, channel, outcome) values ($1,$2,'phone','no-answer')`,
        [f.id, ids.docA],
      );

      // A referral that belongs to someone else cannot be attached.
      const e = await expectDenied(
        c.query(
          `insert into follow_up_records (patient_id, referral_id, reason, due_date, created_by)
           values ($1,$2,'symptom-recheck', current_date, $3)`,
          [ids.p3, referralId, ids.docA],
        ),
      );
      assert.match(e.message, /row-level security|does not belong/i);
    });
    await asUser(db, ids.patientUser, async (c) => {
      assert.equal((await c.rows('select id from follow_up_records')).length, 1);
      const e = await expectDenied(
        c.query(
          `insert into follow_up_records (patient_id, reason, due_date, created_by) values ($1,'symptom-recheck', current_date, $2)`,
          [ids.p1, ids.patientUser],
        ),
      );
      assert.match(e.message, /row-level security/i);
    });
    await asUser(db, ids.docB, async (c) => {
      assert.equal((await c.rows('select id from follow_up_records')).length, 0);
    });
  });
});

describe('facilities', () => {
  test('the public sees only published facilities', async () => {
    await asUser(db, null, async (c) => {
      const rows = await c.rows('select name from healthcare_facilities order by name');
      assert.deepEqual(rows.map((r) => r.name), ['Puskesmas A', 'Puskesmas B']);
    });
  });

  test('anonymous visitors cannot read any health table', async () => {
    await asUser(db, null, async (c) => {
      for (const table of ['patient_profiles', 'screenings', 'referrals', 'profiles']) {
        const e = await expectDenied(c.query(`select * from ${table}`));
        assert.match(e.message, /permission denied/i);
      }
    });
  });

  test('administrators see unpublished facilities; others do not', async () => {
    await asUser(db, ids.admin, async (c) => {
      assert.equal((await c.rows('select id from healthcare_facilities')).length, 3);
    });
    await asUser(db, ids.patientUser, async (c) => {
      assert.equal((await c.rows('select id from healthcare_facilities')).length, 2);
    });
  });

  test('only administrators write facilities, and new ones start unpublished', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(
        c.query(`insert into healthcare_facilities (name, type) values ('Rogue','clinic')`),
      );
      assert.match(e.message, /row-level security/i);
      const r = await c.query(`update healthcare_facilities set name='Hacked' where id=$1`, [ids.facA]);
      assert.equal(r.affectedRows, 0);
    });
    await asUser(db, ids.admin, async (c) => {
      const e = await expectDenied(
        c.query(`insert into healthcare_facilities (name, type, published) values ('Eager','clinic',true)`),
      );
      assert.match(e.message, /row-level security/i);
      await c.query(`insert into healthcare_facilities (name, type) values ('Legit','clinic')`);
      const [row] = await c.rows(`select published from healthcare_facilities where name='Legit'`);
      assert.equal(row.published, false);
      await c.query(`update healthcare_facilities set published=true where name='Legit'`);
    });
  });
});

describe('onboarding and consent', () => {
  let user;

  before(async () => {
    user = await createUser(db, { email: 'fresh@t.test', fullName: 'Fresh Patient' });
  });

  test('completion cannot be forged by writing the row directly', async () => {
    await asUser(db, user, async (c) => {
      await c.query(`insert into patient_onboarding (profile_id, step, personal) values ($1, 1, $2)`, [
        user,
        JSON.stringify({ fullName: 'Fresh Patient', birthDate: '1990-01-01', phone: '081', sex: 'female' }),
      ]);
      const e = await expectDenied(c.query(`update patient_onboarding set completed_at = now() where profile_id=$1`, [user]));
      assert.match(e.message, /permission denied/i);
      const e2 = await expectDenied(c.query(`update patient_onboarding set consent_health_info = true where profile_id=$1`, [user]));
      assert.match(e2.message, /permission denied/i);
    });
  });

  test('completing needs the address step and consent to data use', async () => {
    await asUser(db, user, async (c) => {
      const e = await expectDenied(c.query(`select complete_patient_onboarding(true, true)`));
      assert.match(e.message, /required/i);
      await c.query(`update patient_onboarding set address=$2, health=$3, step=3 where profile_id=$1`, [
        user,
        JSON.stringify({ province: 'NTT', district: 'Manggarai Barat', village: 'Labuan Bajo', addressLine: 'Jl. X' }),
        JSON.stringify({ symptoms: ['cough'], symptomWeeks: 3, priorTb: 'never', householdContact: false, notes: '', shared: true }),
      ]);
      const e2 = await expectDenied(c.query(`select complete_patient_onboarding(false, true)`));
      assert.match(e2.message, /consent/i);
    });
  });

  test('completing creates the clinical record linked to the account', async () => {
    await asUser(db, user, async (c) => {
      await c.query(`select complete_patient_onboarding(true, true)`);
      const rows = await c.rows('select mrn, name, village from patient_profiles');
      assert.equal(rows.length, 1);
      assert.match(rows[0].mrn, /^TB-\d{4}-\d{4}$/);
      assert.equal(rows[0].village, 'Labuan Bajo');
      const [ob] = await c.rows('select health, consent_health_info from patient_onboarding');
      assert.ok(ob.health);
      assert.equal(ob.consent_health_info, true);
    });
  });

  test('withdrawing health consent clears the answers, not just the flag', async () => {
    await asUser(db, user, async (c) => {
      await c.query(`select set_health_consent(false)`);
      const [ob] = await c.rows('select health, consent_health_info from patient_onboarding');
      assert.equal(ob.health, null);
      assert.equal(ob.consent_health_info, false);
    });
    const audit = await su(`select detail from audit_logs where action='consent.health-info-changed'`);
    assert.match(audit[0].detail, /cleared/);
  });

  test('onboarding rows are private to the patient', async () => {
    await asUser(db, ids.admin, async (c) => {
      assert.equal((await c.rows('select * from patient_onboarding')).length, 0);
    });
    await asUser(db, ids.docA, async (c) => {
      assert.equal((await c.rows('select * from patient_onboarding')).length, 0);
    });
  });

  test('professionals cannot use the patient onboarding functions', async () => {
    await asUser(db, ids.docA, async (c) => {
      const e = await expectDenied(c.query(`select complete_patient_onboarding(true, true)`));
      assert.match(e.message, /forbidden/i);
    });
  });
});

describe('audit log and learning progress', () => {
  test('only administrators can read the audit log', async () => {
    await asUser(db, ids.admin, async (c) => {
      assert.ok((await c.rows('select id from audit_logs')).length > 0);
    });
    for (const uid of [ids.patientUser, ids.docA]) {
      await asUser(db, uid, async (c) => {
        assert.equal((await c.rows('select id from audit_logs')).length, 0);
      });
    }
  });

  test('clients cannot write, edit or delete audit entries', async () => {
    await asUser(db, ids.admin, async (c) => {
      const e1 = await expectDenied(c.query(`insert into audit_logs (action) values ('forged')`));
      assert.match(e1.message, /permission denied/i);
      const e2 = await expectDenied(c.query(`delete from audit_logs`));
      assert.match(e2.message, /permission denied/i);
    });
  });

  test('the table is append-only even for a trusted context', async () => {
    const e1 = await expectDenied(db.query(`update audit_logs set detail='x'`));
    assert.match(e1.message, /append-only/);
    const e2 = await expectDenied(db.query(`delete from audit_logs`));
    assert.match(e2.message, /append-only/);
    const e3 = await expectDenied(db.query(`truncate audit_logs`));
    assert.match(e3.message, /append-only/);
  });

  test('reading progress is private to its owner', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      await c.query(`insert into educational_progress (profile_id, article_id) values ($1,'what-is-tb')`, [ids.patientUser]);
      const e = await expectDenied(
        c.query(`insert into educational_progress (profile_id, article_id) values ($1,'what-is-tb')`, [ids.patient2User]),
      );
      assert.match(e.message, /row-level security/i);
      assert.equal((await c.rows('select * from educational_progress')).length, 1);
    });
    await asUser(db, ids.patient2User, async (c) => {
      assert.equal((await c.rows('select * from educational_progress')).length, 0);
    });
    await asUser(db, ids.admin, async (c) => {
      assert.equal((await c.rows('select * from educational_progress')).length, 0);
    });
  });
});

describe('staff directory', () => {
  test('professionals and administrators see all staff', async () => {
    await asUser(db, ids.docA, async (c) => {
      const rows = await c.rows('select * from list_staff()');
      assert.ok(rows.length >= 4);
      assert.ok(rows.every((r) => r.email));
    });
  });

  test('a patient sees only the staff on their own records, without contact details', async () => {
    await asUser(db, ids.patientUser, async (c) => {
      const rows = await c.rows('select * from list_staff()');
      assert.ok(rows.length >= 1);
      assert.ok(rows.every((r) => r.email === null && r.phone === null));
      assert.ok(!rows.some((r) => r.id === ids.docB));
    });
  });

  test('a visitor gets nothing', async () => {
    await asUser(db, ids.patient2User, async (c) => {
      assert.equal((await c.rows('select * from list_staff()')).length, 0);
    });
  });
});
