/**
 * The development seed must load on top of the migrations, produce the roles
 * the documentation promises, and must not invent clinical output.
 *
 * seed.sql has two parts (see tests/helpers/seed.js): base data, tested first
 * on its own, and sample clinical records, tested as the whole file.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createDatabase } from './helpers/db.js';
import { baseSeedSql, fullSeedSql } from './helpers/seed.js';

const ID = {
  siti: 'a0000000-0000-4000-8000-000000000001',
  doctor: 'a0000000-0000-4000-8000-000000000002',
  chw: 'a0000000-0000-4000-8000-000000000003',
  admin: 'a0000000-0000-4000-8000-000000000004',
  nurse: 'a0000000-0000-4000-8000-000000000005',
  dewi: 'a0000000-0000-4000-8000-000000000006',
};

describe('development seed, base data', () => {
  let db;
  before(async () => {
    db = await createDatabase();
    await db.exec(baseSeedSql());
  });
  after(async () => db?.close());

  const rows = async (sql) => (await db.query(sql)).rows;

  test('creates the four documented sign-ins with the right roles', async () => {
    const accounts = await rows(`select email, role, status from profiles order by email`);
    assert.deepEqual(accounts, [
      { email: 'admin@parupintas.test', role: 'admin', status: 'active' },
      { email: 'chw@parupintas.test', role: 'professional', status: 'active' },
      { email: 'doctor@parupintas.test', role: 'professional', status: 'active' },
      { email: 'patient@parupintas.test', role: 'patient', status: 'active' },
    ]);
  });

  test('stores no plain-text password', async () => {
    const [{ n }] = await rows(
      `select count(*)::int as n from auth.users where encrypted_password in ('Patient123!','Doctor123!','Worker123!','Admin123!')`,
    );
    assert.equal(n, 0);
  });

  test('only the doctor can sign off reviews; the administrator never can', async () => {
    const staff = await rows(
      `select p.email, s.clinical_role, s.can_review from healthcare_professional_profiles s
       join profiles p on p.id = s.profile_id order by p.email`,
    );
    assert.deepEqual(staff, [
      { email: 'admin@parupintas.test', clinical_role: 'coordinator', can_review: false },
      { email: 'chw@parupintas.test', clinical_role: 'chw', can_review: false },
      { email: 'doctor@parupintas.test', clinical_role: 'physician', can_review: true },
    ]);
  });

  test('loads the facility directory, all published, and nothing clinical', async () => {
    const [{ n, unpublished }] = await rows(
      `select count(*)::int as n, count(*) filter (where not published)::int as unpublished from healthcare_facilities`,
    );
    assert.equal(n, 14);
    assert.equal(unpublished, 0);
    for (const table of ['screenings', 'screening_reports', 'screening_reviews', 'referrals', 'follow_up_records']) {
      const [{ c }] = await rows(`select count(*)::int as c from ${table}`);
      assert.equal(c, 0, `${table} must start empty in the base data`);
    }
  });

  test('links the patient account to its clinical record at the clinic', async () => {
    const [row] = await rows(
      `select p.name, f.name as facility from patient_profiles p
       join healthcare_facilities f on f.id = p.home_facility_id
       where p.profile_id = 'a0000000-0000-4000-8000-000000000001'`,
    );
    assert.deepEqual(row, { name: 'Siti Rahmawati', facility: 'Puskesmas Waerana' });
  });

  test('is safe to run twice', async () => {
    await db.exec(baseSeedSql());
    const [{ n }] = await rows(`select count(*)::int as n from profiles`);
    assert.equal(n, 4);
  });
});

describe('development seed, with sample records', () => {
  let db;
  before(async () => {
    db = await createDatabase();
    await db.exec(fullSeedSql());
  });
  after(async () => db?.close());

  const rows = async (sql) => (await db.query(sql)).rows;
  const count = async (table) => (await rows(`select count(*)::int as n from ${table}`))[0].n;

  const TABLES = [
    'profiles', 'healthcare_facilities', 'healthcare_professional_profiles', 'patient_profiles',
    'patient_onboarding', 'patient_notes', 'screenings', 'screening_reports', 'screening_reviews',
    'referrals', 'referral_events', 'follow_up_records', 'follow_up_attempts',
    'educational_progress', 'audit_logs',
  ];

  test('every table has at least three rows to look at', async () => {
    for (const table of TABLES) {
      assert.ok((await count(table)) >= 3, `${table} has fewer than 3 rows`);
    }
  });

  test('adds a nurse at a second facility, a second patient, and one mid-onboarding', async () => {
    const accounts = await rows(`select email, role from profiles where id >= 'a0000000-0000-4000-8000-000000000005' order by email`);
    assert.deepEqual(accounts, [
      { email: 'newpatient@parupintas.test', role: 'patient' },
      { email: 'nurse@parupintas.test', role: 'professional' },
      { email: 'patient2@parupintas.test', role: 'patient' },
    ]);
    const unfinished = await rows(`select step, completed_at from patient_onboarding where profile_id = 'a0000000-0000-4000-8000-000000000007'`);
    assert.deepEqual(unfinished, [{ step: 1, completed_at: null }]);
    const [{ n }] = await rows(`select count(*)::int as n from patient_profiles where profile_id = 'a0000000-0000-4000-8000-000000000007'`);
    assert.equal(n, 0, 'no clinical record until onboarding is completed');
  });

  test('invents no model output and attaches no image', async () => {
    const reports = await rows(`select model_status, analysis, analysed_at, image_path, image_meta from screening_reports`);
    assert.equal(reports.length, 6);
    for (const report of reports) {
      assert.deepEqual(report, { model_status: 'not-run', analysis: null, analysed_at: null, image_path: null, image_meta: null });
    }
  });

  test('the triggers moved the screenings the way the application would', async () => {
    const byId = Object.fromEntries(
      (await rows(`select right(id::text, 1) as n, status from screenings`)).map((r) => [r.n, r.status]),
    );
    assert.deepEqual(byId, { 1: 'referred', 2: 'queued', 3: 'closed', 4: 'reviewed', 5: 'draft', 6: 'queued' });
  });

  test('referrals carry a history, and the follow-ups point at the same patient', async () => {
    const history = await rows(
      `select r.code, count(e.id)::int as events, min(e.to_status) filter (where e.from_status is null) as first
       from referrals r join referral_events e on e.referral_id = r.id group by r.code order by r.code`,
    );
    assert.equal(history.length, 3);
    assert.ok(history.every((h) => h.events >= 1 && h.first === 'pending'));
    const [{ stray }] = await rows(
      `select count(*)::int as stray from follow_up_records f
       join referrals r on r.id = f.referral_id where r.patient_id <> f.patient_id`,
    );
    assert.equal(stray, 0);
    const statuses = (await rows(`select distinct status from follow_up_records order by status`)).map((r) => r.status);
    assert.deepEqual(statuses, ['completed', 'in-progress', 'scheduled', 'unresolved']);
  });

  test('the audit trail mentions the sample activity, flagged as seed data', async () => {
    const actions = (await rows(`select distinct action from audit_logs where metadata ->> 'seed' = 'true' order by action`)).map((r) => r.action);
    for (const expected of ['screening.created', 'screening.reviewed', 'referral.created', 'followup.created', 'patient.created']) {
      assert.ok(actions.includes(expected), expected);
    }
  });

  test('access still follows the facility: the nurse sees only her own patient', async () => {
    await asUser(db, ID.nurse, async (c) => {
      assert.deepEqual((await c.rows(`select name from patient_profiles`)).map((r) => r.name), ['Dewi Anggraeni']);
      assert.equal((await c.rows(`select id from screenings`)).length, 1);
    });
    await asUser(db, ID.doctor, async (c) => {
      const names = (await c.rows(`select name from patient_profiles order by name`)).map((r) => r.name);
      assert.deepEqual(names, ['Maria Goreti', 'Siti Rahmawati', 'Yosef Banggur']);
      // Everything filed at her facility, the chw's draft included; Dewi's screening is elsewhere.
      assert.equal((await c.rows(`select id from screenings`)).length, 5);
    });
  });

  test('patients see their own state, administrators see no clinical content', async () => {
    await asUser(db, ID.siti, async (c) => {
      assert.equal((await c.rows(`select id from screenings`)).length, 1);
      assert.equal((await c.rows(`select screening_id from screening_reviews`)).length, 1);
      assert.equal((await c.rows(`select screening_id from screening_reports`)).length, 0);
      assert.equal((await c.rows(`select id from follow_up_records`)).length, 1);
    });
    await asUser(db, ID.admin, async (c) => {
      assert.equal((await c.rows(`select id from screenings`)).length, 6);
      assert.equal((await c.rows(`select screening_id from screening_reports`)).length, 0);
      assert.equal((await c.rows(`select screening_id from screening_reviews`)).length, 0);
      assert.equal((await c.rows(`select id from referrals`)).length, 0);
    });
  });

  test('is safe to run twice: nothing is added or changed', async () => {
    const before = {};
    for (const table of TABLES) before[table] = await count(table);
    const statuses = await rows(`select id, status from screenings order by id`);
    await db.exec(fullSeedSql());
    for (const table of TABLES) assert.equal(await count(table), before[table], `${table} changed on the second run`);
    assert.deepEqual(await rows(`select id, status from screenings order by id`), statuses);
  });
});
