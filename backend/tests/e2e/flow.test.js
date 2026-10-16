/**
 * End to end: real Express app -> real supabase-js -> real PostgREST -> the
 * real migrations (PGlite). Nothing between the HTTP request and the SQL is
 * faked except GoTrue (tokens are minted with the shared secret) and Storage
 * (in memory, service role only).
 *
 * Requires the PostgREST binary: `npm run e2e:setup`. Skipped without it.
 *
 * pglite-socket drops the connection when Postgres raises an error, so
 * PostgREST then answers 503 instead of the real error. Paths that depend on a
 * raised SQL error are covered in tests/queue.test.js, which talks to Postgres
 * directly; this file covers the happy path and the API's own refusals.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createRecorder } from '../helpers/coverage.js';
import { startServer } from '../helpers/fakeGateway.js';
import { ANON_KEY, SERVICE_KEY, readRepoFile, stackAvailable, startStack, userToken } from './stack.js';

const skip = stackAvailable ? false : 'PostgREST binary not found (run `npm run e2e:setup`)';

// Seeded identities (backend/supabase/seed.sql)
const STAFF = {
  admin: ['a0000000-0000-4000-8000-000000000001', 'admin@parupintas.test'],
  rad: ['a0000000-0000-4000-8000-000000000002', 'radiolog@parupintas.test'],
  rad2: ['a0000000-0000-4000-8000-000000000003', 'radiolog2@parupintas.test'],
};
const token = (who) => userToken(...STAFF[who]);

// Field lists are the frontend's own domain types (frontend/src/types/domain.ts).
const SHAPES = {
  patient: ['id', 'mrn', 'name', 'sex', 'birthDate', 'phone', 'address', 'createdAt'],
  screening: [
    'id', 'patientId', 'patient', 'applicant', 'complaint', 'accessCode', 'requestDate', 'requestedAt',
    'createdBy', 'status', 'operatorId', 'startedAt', 'symptoms', 'vitals', 'imageQuality', 'hasImage',
    'imageMeta', 'modelStatus', 'analysis', 'queuePriority', 'queueNumber', 'queueDate', 'submittedAt', 'servedAt',
  ],
  publicStatus: ['status', 'name', 'requestDate', 'requestedAt', 'ahead', 'queueNumber', 'priority', 'outcome', 'submittedAt', 'servedAt'],
};
function assertShape(value, shape) {
  const missing = SHAPES[shape].filter((key) => !(key in value));
  assert.deepEqual(missing, [], `${shape}: fields the frontend expects but the API did not send`);
}

const FORM = { name: 'Fransiskus Jehaut', sex: 'male', birthDate: '1971-05-09', phone: '0852-5550-1111', address: 'Desa Wae Nioka', complaint: 'Batuk tiga minggu.' };
const SYMPTOMS = { coughWeeks: 4, hemoptysis: false, nightSweats: true, weightLoss: true, fever: false, chestPain: false, fatigue: true, appetiteLoss: false };
const VITALS = { weightKg: 52, heightCm: 160, temperatureC: 37.4, respiratoryRate: 20 };

const recorder = createRecorder();
let stack;
let api;
let closeApi;

before(async () => {
  if (skip) return;
  stack = await startStack();
  const config = loadConfig({
    NODE_ENV: 'test',
    SUPABASE_URL: stack.url,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    FRONTEND_ORIGIN: 'http://localhost:5173',
  });
  const app = createApp({ config, logger: { error() {}, info() {}, warn() {} } });
  const server = await startServer(app);
  api = async (method, path, options) => {
    const res = await server.call(method, path, options);
    recorder.record(method, path, res.status);
    return res;
  };
  closeApi = server.close;
});

after(async () => {
  await closeApi?.();
  await stack?.stop();
});

describe('a visit, from the request form to the queue', { skip }, () => {
  const visit = {};

  test('the patient sends the form and gets an access code', async () => {
    const res = await api('POST', '/public/requests', { body: FORM });
    assert.equal(res.status, 201);
    assert.match(res.json.data.code, /^[A-HJ-NP-Z2-9]{8}$/);
    visit.code = res.json.data.code;
  });

  test('the code shows the request waiting, with a masked name', async () => {
    // Grouped and lower-case, the way a person types it from a slip.
    const typed = `${visit.code.slice(0, 4)}-${visit.code.slice(4)}`.toLowerCase();
    const res = await api('POST', '/public/result', { body: { code: typed } });
    assert.equal(res.status, 200);
    assertShape(res.json.data, 'publicStatus');
    assert.equal(res.json.data.status, 'waiting');
    assert.equal(res.json.data.name, 'Fransiskus J.');
    assert.equal(res.json.data.ahead, 0);
    assert.equal(res.json.data.queueNumber, null);
  });

  test('the admin sees it among the waiting requests, with what the patient typed', async () => {
    const res = await api('GET', '/screenings?status=waiting,examining', { token: token('admin') });
    assert.equal(res.status, 200);
    const found = res.json.data.find((item) => item.accessCode === visit.code);
    assert.ok(found);
    assertShape(found, 'screening');
    assert.equal(found.patient, null);
    assert.equal(found.applicant.name, FORM.name);
    assert.equal(found.complaint, FORM.complaint);
    visit.id = found.id;
  });

  test('the admin saves the patient and links the request to them', async () => {
    const created = await api('POST', '/patients', {
      token: token('admin'),
      body: { name: FORM.name, sex: FORM.sex, birthDate: FORM.birthDate, phone: FORM.phone, address: FORM.address },
    });
    assert.equal(created.status, 201);
    assertShape(created.json.data, 'patient');
    visit.patientId = created.json.data.id;

    const linked = await api('PUT', `/screenings/${visit.id}/patient`, { token: token('admin'), body: { patientId: visit.patientId } });
    assert.equal(linked.status, 200);
    assert.equal(linked.json.data.patient.id, visit.patientId);

    const found = await api('GET', `/patients?q=${encodeURIComponent('Jehaut')}`, { token: token('admin') });
    assert.ok(found.json.data.some((p) => p.id === visit.patientId));
    const one = await api('GET', `/patients/${visit.patientId}`, { token: token('rad') });
    assert.equal(one.status, 200);
    const edited = await api('PATCH', `/patients/${visit.patientId}`, {
      token: token('admin'),
      body: { name: FORM.name, sex: FORM.sex, birthDate: FORM.birthDate, phone: '0852-0000-0000', address: FORM.address },
    });
    assert.equal(edited.json.data.phone, '0852-0000-0000');
  });

  test('the radiologist examines: start, record, upload, model, submit', async () => {
    const started = await api('POST', `/screenings/${visit.id}/start`, { token: token('rad') });
    assert.equal(started.status, 200);
    assert.equal(started.json.data.status, 'examining');

    const saved = await api('PATCH', `/screenings/${visit.id}`, {
      token: token('rad'),
      body: { symptoms: SYMPTOMS, vitals: VITALS, imageQuality: 'adequate' },
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.json.data.symptoms, SYMPTOMS);

    const form = new FormData();
    form.append('image', new Blob([readRepoFile('frontend', 'public', 'test', 'tb0003.png')], { type: 'image/png' }), 'tb0003.png');
    const uploaded = await api('POST', `/screenings/${visit.id}/image`, { token: token('rad'), form });
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.json.data.hasImage, true);
    assert.equal(uploaded.json.data.imageMeta.width, 512);
    assert.ok(!('image_path' in uploaded.json.data));

    const analysed = await api('POST', `/screenings/${visit.id}/analysis`, {
      token: token('rad'),
      body: {
        probabilities: { Healthy: 0.01, 'Sick-non-TB': 0.04, TB: 0.95 },
        model: { name: 'tb_student.onnx', version: 'ptq-int8-test', backbone: 'mobilenet_v3_small' },
        regions: [{ box: { x: 0.55, y: 0.1, width: 0.25, height: 0.15 }, score: 1, label: 'TB' }],
      },
    });
    assert.equal(analysed.status, 200);
    const analysis = analysed.json.data.analysis;
    assert.equal(analysis.outcome, 'flagged-for-review');
    assert.equal(analysis.riskPoint, 95);
    // The zone is named on the server, from the box.
    assert.equal(analysis.regions[0].zone, 'zona kiri atas');

    const submitted = await api('POST', `/screenings/${visit.id}/submit`, { token: token('rad'), body: { priority: 'high' } });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.json.data.status, 'queued');
    assert.match(submitted.json.data.queueNumber, /^A-\d{3}$/);
    visit.queueNumber = submitted.json.data.queueNumber;
  });

  test('the code now shows the queue number, the priority and the first reading', async () => {
    const res = await api('POST', '/public/result', { body: { code: visit.code } });
    assert.equal(res.json.data.status, 'queued');
    assert.equal(res.json.data.queueNumber, visit.queueNumber);
    assert.equal(res.json.data.priority, 'high');
    assert.equal(res.json.data.outcome, 'flagged-for-review');
    assert.equal(res.json.data.ahead, 0);
    // Nothing clinical beyond the outcome word.
    assert.ok(!('analysis' in res.json.data) && !('symptoms' in res.json.data));
  });

  test('both staff roles see it in the queue, and the image opens', async () => {
    for (const who of ['admin', 'rad']) {
      const res = await api('GET', '/queue', { token: token(who) });
      assert.equal(res.status, 200);
      assert.ok(res.json.data.items.some((item) => item.id === visit.id));
    }
    const signed = await api('GET', `/screenings/${visit.id}/image`, { token: token('admin') });
    assert.equal(signed.status, 200);
    const image = await fetch(new URL(signed.json.data.url, stack.url));
    assert.equal(image.status, 200);

    const history = await api('GET', `/screenings?patientId=${visit.patientId}`, { token: token('admin') });
    assert.deepEqual(history.json.data.map((s) => s.id), [visit.id]);
    const one = await api('GET', `/screenings/${visit.id}`, { token: token('admin') });
    assert.equal(one.json.data.queueNumber, visit.queueNumber);
  });

  test('the admin calls the patient', async () => {
    const res = await api('POST', `/screenings/${visit.id}/served`, { token: token('admin') });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, 'served');

    const queue = await api('GET', '/queue', { token: token('admin') });
    assert.ok(!queue.json.data.items.some((item) => item.id === visit.id));
    assert.ok(queue.json.data.served.some((item) => item.id === visit.id));

    const status = await api('POST', '/public/result', { body: { code: visit.code } });
    assert.equal(status.json.data.status, 'served');
    assert.equal(status.json.data.queueNumber, visit.queueNumber);
  });
});

describe('the desk, and what is refused', { skip }, () => {
  test('staff register a walk-in for a saved patient and it gets its own code', async () => {
    const res = await api('POST', '/screenings', {
      token: token('admin'),
      body: { patientId: 'b0000000-0000-4000-8000-000000000003', complaint: 'Kontrol' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'waiting');
    assert.match(res.json.data.accessCode, /^[A-HJ-NP-Z2-9]{8}$/);

    const ahead = await api('POST', '/public/result', { body: { code: res.json.data.accessCode } });
    assert.ok(ahead.json.data.ahead >= 0);

    // Only the administrator cancels, and only a waiting request.
    assert.equal((await api('DELETE', `/screenings/${res.json.data.id}`, { token: token('rad') })).status, 403);
    assert.equal((await api('DELETE', `/screenings/${res.json.data.id}`, { token: token('admin') })).status, 204);
    assert.equal((await api('GET', `/screenings/${res.json.data.id}`, { token: token('admin') })).status, 404);
  });

  test('health says whether the model is wired on the server', async () => {
    const res = await api('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.data.modelConnected, false);
  });

  test('the session and the staff directory', async () => {
    const me = await api('GET', '/auth/me', { token: token('rad') });
    assert.deepEqual(me.json.data.account, {
      id: STAFF.rad[0],
      name: 'dr. Hanif Ramadhan, Sp.Rad',
      email: STAFF.rad[1],
      role: 'radiologist',
    });
    const staff = await api('GET', '/staff', { token: token('admin') });
    assert.equal(staff.json.data.length, 3);
    assert.equal((await api('POST', '/auth/logout', { token: token('rad2') })).status, 204);
  });

  test('without a session, nothing private answers', async () => {
    for (const [method, path] of [['GET', '/patients'], ['GET', '/screenings'], ['GET', '/queue'], ['GET', '/staff']]) {
      assert.equal((await api(method, path)).status, 401, `${method} ${path}`);
    }
    assert.equal((await api('GET', '/auth/me', { token: 'x.y.z' })).status, 401);
  });

  test('the administrator cannot examine, and a radiologist cannot cancel', async () => {
    const id = 'c0000000-0000-4000-8000-000000000001';
    assert.equal((await api('POST', `/screenings/${id}/start`, { token: token('admin') })).status, 403);
    assert.equal((await api('POST', `/screenings/${id}/submit`, { token: token('admin'), body: { priority: 'high' } })).status, 403);
  });

  test('the radiologist cannot record on a request they have not taken', async () => {
    const res = await api('PATCH', '/screenings/c0000000-0000-4000-8000-000000000001', {
      token: token('rad'),
      body: { symptoms: SYMPTOMS, vitals: VITALS, imageQuality: 'adequate' },
    });
    assert.equal(res.status, 404); // not in the base seed
  });

  test('the public form refuses fields it does not know, and bad values', async () => {
    assert.equal((await api('POST', '/public/requests', { body: { ...FORM, status: 'queued' } })).status, 422);
    assert.equal((await api('POST', '/public/requests', { body: { ...FORM, birthDate: '2999-01-01' } })).status, 422);
    assert.equal((await api('POST', '/public/requests', { body: { ...FORM, name: 'A' } })).status, 422);
  });

  test('an unknown or malformed code is the same 404', async () => {
    const unknown = await api('POST', '/public/result', { body: { code: 'ZZZZ-ZZZZ' } });
    const malformed = await api('POST', '/public/result', { body: { code: 'not a code' } });
    assert.equal(unknown.status, 404);
    assert.equal(malformed.status, 404);
    assert.equal(unknown.json.error.message, malformed.json.error.message);
  });

  test('the browser model must report a real distribution', async () => {
    const res = await api('POST', '/screenings/c0000000-0000-4000-8000-000000000001/analysis', {
      token: token('rad'),
      body: { probabilities: { Healthy: 0.5, 'Sick-non-TB': 0.5, TB: 0.5 }, model: { name: 'x', version: 'y', backbone: 'z' } },
    });
    assert.equal(res.status, 422);
  });
});

describe('route coverage', { skip }, () => {
  test('every route answered at least one request successfully', () => {
    // POST /screenings/:id/analyze needs a model service; it is unit-tested.
    const missing = recorder.missing().filter((route) => route !== 'POST /screenings/:id/analyze');
    assert.deepEqual(missing, []);
    assert.deepEqual(recorder.unmatched(), []);
  });
});
