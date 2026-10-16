/**
 * The clinic workflow against the real migrations (PGlite).
 *
 * Statements run as a given user with role `authenticated` (or `anon`), so Row
 * Level Security, column grants and the workflow functions are all in force,
 * as they are for a browser holding a JWT. "Service" means a trusted server
 * context with no auth.uid(), which is how the backend's public routes reach
 * the database.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createDatabase, createUser, expectDenied } from './helpers/db.js';

let db;
const ids = {};

const su = async (sql, params) => (await db.query(sql, params)).rows;

const APPLICANT = JSON.stringify({ name: 'Fransiskus Jehaut', sex: 'male', birthDate: '1971-05-09', phone: null, address: '' });

/** A request from the public form, as the backend makes it. */
async function publicRequest() {
  const [row] = await su(`select * from create_request(null, $1::jsonb, 'Batuk tiga minggu')`, [APPLICANT]);
  return row;
}

const attachImage = (id) => su(`update screenings set image_path = $2 where id = $1`, [id, `p/${id}.png`]);

before(async () => {
  db = await createDatabase();
  ids.admin = await createUser(db, { email: 'admin@t.test', fullName: 'Admin' });
  ids.rad = await createUser(db, { email: 'rad@t.test', fullName: 'dr. Radiolog' });
  ids.rad2 = await createUser(db, { email: 'rad2@t.test', fullName: 'dr. Lain' });
  // Anyone can sign up on a Supabase project. The result has no role.
  ids.stranger = await createUser(db, { email: 'stranger@t.test', fullName: 'Stranger' });
  await su(`update profiles set role = 'admin' where id = $1`, [ids.admin]);
  await su(`update profiles set role = 'radiologist' where id = any($1)`, [[ids.rad, ids.rad2]]);

  const [patient] = await su(
    `insert into patients (name, sex, birth_date) values ('Maria Ndiwa', 'female', '1995-07-21') returning id`,
  );
  ids.patient = patient.id;
});

after(async () => {
  await db?.close();
});

describe('accounts', () => {
  test('a new sign-up has no role', async () => {
    const [row] = await su(`select role from profiles where id = $1`, [ids.stranger]);
    assert.equal(row.role, null);
  });

  test('a role in the sign-up metadata is ignored', async () => {
    const id = await createUser(db, { email: 'sneaky@t.test', metadata: { role: 'admin' } });
    const [row] = await su(`select role from profiles where id = $1`, [id]);
    assert.equal(row.role, null);
  });

  test('staff see each other; an account with no role sees only itself', async () => {
    const seen = await asUser(db, ids.rad, (c) => c.rows(`select id from profiles`));
    assert.ok(seen.some((row) => row.id === ids.admin));
    assert.ok(!seen.some((row) => row.id === ids.stranger));

    const own = await asUser(db, ids.stranger, (c) => c.rows(`select id from profiles`));
    assert.deepEqual(own.map((row) => row.id), [ids.stranger]);
  });

  test('nobody can give themselves a role', async () => {
    await expectDenied(asUser(db, ids.stranger, (c) => c.query(`update profiles set role = 'admin' where id = $1`, [ids.stranger])));
    await expectDenied(asUser(db, ids.rad, (c) => c.query(`update profiles set role = 'admin' where id = $1`, [ids.rad])));
  });
});

describe('the request', () => {
  test('the public form makes a waiting request with an access code', async () => {
    const row = await publicRequest();
    assert.equal(row.status, 'waiting');
    assert.equal(row.patient_id, null);
    assert.match(row.access_code, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(row.applicant.name, 'Fransiskus Jehaut');
  });

  test('every request gets a different code', async () => {
    const codes = new Set();
    for (let i = 0; i < 25; i += 1) codes.add((await publicRequest()).access_code);
    assert.equal(codes.size, 25);
  });

  test('anon and accounts without a role cannot make requests or read any', async () => {
    await expectDenied(
      asUser(db, null, (c) => c.query(`select create_request(null, $1::jsonb, '')`, [APPLICANT])),
    );
    await expectDenied(asUser(db, null, (c) => c.query(`select id from screenings`)));

    await expectDenied(
      asUser(db, ids.stranger, (c) => c.query(`select create_request(null, $1::jsonb, '')`, [APPLICANT])),
    );
    const seen = await asUser(db, ids.stranger, (c) => c.rows(`select id from screenings`));
    assert.equal(seen.length, 0);
  });

  test('staff register a visit for a saved patient', async () => {
    const [row] = await asUser(db, ids.admin, (c) =>
      c.rows(`select * from create_request($1, null, 'Kontrol')`, [ids.patient]),
    );
    assert.equal(row.patient_id, ids.patient);
    assert.equal(row.applicant, null);
    assert.equal(row.created_by, ids.admin);
  });

  test('a request needs a person', async () => {
    await expectDenied(su(`select create_request(null, null, '')`));
    await expectDenied(su(`select create_request(null, '{"name":" "}'::jsonb, '')`));
  });

  test('a client cannot write the status, queue or code columns', async () => {
    const { id } = await publicRequest();
    for (const column of ["status = 'queued'", "access_code = 'AAAAAAAA'", "queue_number = 'A-999'", "image_path = 'x'"]) {
      await expectDenied(asUser(db, ids.admin, (c) => c.query(`update screenings set ${column} where id = $1`, [id])));
    }
  });
});

describe('saving the patient', () => {
  test('staff save a patient and link the request to them', async () => {
    const { id } = await publicRequest();
    const [patient] = await asUser(db, ids.admin, (c) =>
      c.rows(
        `insert into patients (name, sex, birth_date, created_by) values ('Fransiskus Jehaut', 'male', '1971-05-09', $1) returning id, mrn`,
        [ids.admin],
      ),
    );
    assert.match(patient.mrn, /^RM-\d{4}-\d{4}$/);

    const [linked] = await asUser(db, ids.admin, (c) => c.rows(`select * from set_screening_patient($1, $2)`, [id, patient.id]));
    assert.equal(linked.patient_id, patient.id);
  });

  test('a patient row cannot claim someone else as its author', async () => {
    await expectDenied(
      asUser(db, ids.rad, (c) =>
        c.query(`insert into patients (name, sex, birth_date, created_by) values ('X Y', 'male', '1990-01-01', $1)`, [ids.admin]),
      ),
    );
  });

  test('an account with no role cannot read or write patients', async () => {
    const seen = await asUser(db, ids.stranger, (c) => c.rows(`select id from patients`));
    assert.equal(seen.length, 0);
    await expectDenied(
      asUser(db, ids.stranger, (c) =>
        c.query(`insert into patients (name, sex, birth_date, created_by) values ('X Y', 'male', '1990-01-01', $1)`, [ids.stranger]),
      ),
    );
  });
});

describe('the examination and the queue', () => {
  test('the whole visit: start, record, submit, call', async () => {
    const [request] = await asUser(db, ids.admin, (c) => c.rows(`select * from create_request($1, null, '')`, [ids.patient]));

    // Only a radiologist starts it.
    await expectDenied(asUser(db, ids.admin, (c) => c.query(`select start_screening($1)`, [request.id])));
    const [started] = await asUser(db, ids.rad, (c) => c.rows(`select * from start_screening($1)`, [request.id]));
    assert.equal(started.status, 'examining');
    assert.equal(started.operator_id, ids.rad);

    // Starting again is harmless; another radiologist is told it is taken.
    await asUser(db, ids.rad, (c) => c.query(`select start_screening($1)`, [request.id]));
    const taken = await expectDenied(asUser(db, ids.rad2, (c) => c.query(`select start_screening($1)`, [request.id])));
    assert.match(taken.message, /sedang diperiksa radiolog lain/);

    // Only the radiologist who took it records the examination.
    const symptoms = JSON.stringify({ coughWeeks: 4 });
    const mine = await asUser(db, ids.rad, (c) =>
      c.rows(`update screenings set symptoms = $2::jsonb where id = $1 returning id`, [request.id, symptoms]),
    );
    assert.equal(mine.length, 1);
    for (const other of [ids.rad2, ids.admin]) {
      const rows = await asUser(db, other, (c) =>
        c.rows(`update screenings set symptoms = '{}'::jsonb where id = $1 returning id`, [request.id]),
      );
      assert.equal(rows.length, 0);
    }

    // Not without an image, and not by someone else.
    const noImage = await expectDenied(asUser(db, ids.rad, (c) => c.query(`select submit_screening($1, 'high')`, [request.id])));
    assert.match(noImage.message, /Unggah rontgen/);
    await attachImage(request.id);
    await expectDenied(asUser(db, ids.rad2, (c) => c.query(`select submit_screening($1, 'high')`, [request.id])));
    await expectDenied(asUser(db, ids.rad, (c) => c.query(`select submit_screening($1, 'urgent')`, [request.id])));

    const [queued] = await asUser(db, ids.rad, (c) => c.rows(`select * from submit_screening($1, 'high')`, [request.id]));
    assert.equal(queued.status, 'queued');
    assert.equal(queued.queue_priority, 'high');
    assert.match(queued.queue_number, /^A-\d{3}$/);
    assert.ok(queued.submitted_at);

    // Submitted means fixed.
    const again = await expectDenied(asUser(db, ids.rad, (c) => c.query(`select submit_screening($1, 'low')`, [request.id])));
    assert.match(again.message, /sudah dikirim/);
    const relink = await expectDenied(
      asUser(db, ids.admin, (c) => c.query(`select set_screening_patient($1, $2)`, [request.id, ids.patient])),
    );
    assert.match(relink.message, /tidak bisa diganti/);
    const edits = await asUser(db, ids.rad, (c) =>
      c.rows(`update screenings set symptoms = '{}'::jsonb where id = $1 returning id`, [request.id]),
    );
    assert.equal(edits.length, 0);

    // Called from the queue.
    await expectDenied(asUser(db, ids.stranger, (c) => c.query(`select mark_served($1)`, [request.id])));
    const [served] = await asUser(db, ids.admin, (c) => c.rows(`select * from mark_served($1)`, [request.id]));
    assert.equal(served.status, 'served');
    assert.ok(served.served_at);
  });

  test('a request without a saved patient cannot be started', async () => {
    const { id } = await publicRequest();
    const error = await expectDenied(asUser(db, ids.rad, (c) => c.query(`select start_screening($1)`, [id])));
    assert.match(error.message, /Simpan data pasien/);
  });

  test('queue numbers count up within the day, and only from submit', async () => {
    const numbers = [];
    for (let i = 0; i < 3; i += 1) {
      const [request] = await asUser(db, ids.admin, (c) => c.rows(`select * from create_request($1, null, '')`, [ids.patient]));
      await asUser(db, ids.rad2, (c) => c.query(`select start_screening($1)`, [request.id]));
      await attachImage(request.id);
      const [row] = await asUser(db, ids.rad2, (c) => c.rows(`select * from submit_screening($1, 'low')`, [request.id]));
      numbers.push(row.queue_seq);
    }
    assert.deepEqual(numbers, [numbers[0], numbers[0] + 1, numbers[0] + 2]);
  });

  test('a waiting request can be cancelled by the administrator only', async () => {
    const { id } = await publicRequest();
    const byRad = await asUser(db, ids.rad, (c) => c.rows(`delete from screenings where id = $1 returning id`, [id]));
    assert.equal(byRad.length, 0);
    const byAdmin = await asUser(db, ids.admin, (c) => c.rows(`delete from screenings where id = $1 returning id`, [id]));
    assert.equal(byAdmin.length, 1);
  });

  test('a started request cannot be cancelled', async () => {
    const [request] = await asUser(db, ids.admin, (c) => c.rows(`select * from create_request($1, null, '')`, [ids.patient]));
    await asUser(db, ids.rad, (c) => c.query(`select start_screening($1)`, [request.id]));
    const rows = await asUser(db, ids.admin, (c) => c.rows(`delete from screenings where id = $1 returning id`, [request.id]));
    assert.equal(rows.length, 0);
  });

  test('a suspended radiologist is refused', async () => {
    const [request] = await asUser(db, ids.admin, (c) => c.rows(`select * from create_request($1, null, '')`, [ids.patient]));
    await su(`update profiles set status = 'suspended' where id = $1`, [ids.rad2]);
    try {
      await expectDenied(asUser(db, ids.rad2, (c) => c.query(`select start_screening($1)`, [request.id])));
      const seen = await asUser(db, ids.rad2, (c) => c.rows(`select id from screenings`));
      assert.equal(seen.length, 0);
    } finally {
      await su(`update profiles set status = 'active' where id = $1`, [ids.rad2]);
    }
  });
});
