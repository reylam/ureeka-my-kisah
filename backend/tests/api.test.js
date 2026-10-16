/**
 * API tests: the real Express app (routing, auth middleware, role guards,
 * validation, error handling, services) running over a fake Supabase gateway.
 *
 * These prove what the API itself decides: who is let through, what input is
 * accepted, what is written where, and what is refused before any clinical
 * table is touched. They do not prove Row Level Security (rls.test.js does,
 * against the real migrations) and they do not prove PostgREST / GoTrue /
 * Storage behave as assumed; that needs a real Supabase project.
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createFakeGateway, startServer, testConfig, uid, USERS } from './helpers/fakeGateway.js';

const SESSION_TABLES = new Set(['profiles', 'healthcare_professional_profiles', 'patient_profiles']);
const silent = { error() {}, info() {}, warn() {} };

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  Buffer.from([0, 0, 0x02, 0x00, 0, 0, 0x01, 0x80]), // 512 x 384
  Buffer.alloc(16),
]);

const SCREENING_ID = uid(900);
const PATIENT_ID = uid(901);

let state; // { call, close, calls, storageCalls, queries }
let handlers;

async function boot({ inference } = {}) {
  handlers = { onQuery: () => undefined, onRpc: () => undefined };
  const fake = createFakeGateway({
    onQuery: (call) => handlers.onQuery(call),
    onRpc: (name, args, call) => handlers.onRpc(name, args, call),
  });
  const app = createApp({
    config: testConfig(),
    gateway: fake.gateway,
    inference: inference ?? { configured: false, analyze: async () => assert.fail('model must not be called') },
    logger: silent,
  });
  const server = await startServer(app);
  state = { ...server, calls: fake.calls, storageCalls: fake.storageCalls, authAdminCalls: fake.authAdminCalls };
}

before(boot);
after(async () => state?.close());
beforeEach(() => {
  state.calls.length = 0;
  state.storageCalls.length = 0;
  state.authAdminCalls.length = 0;
  handlers.onQuery = () => undefined;
  handlers.onRpc = () => undefined;
});

/** Queries that went beyond loading the caller's own session. */
const dataQueries = () =>
  state.calls.filter((c) => (c.table && !SESSION_TABLES.has(c.table)) || c.rpc);

describe('platform basics', () => {
  test('health is public and reports whether the model is wired', async () => {
    const res = await state.call('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.modelConnected, false);
  });

  test('sends security headers and hides the framework', async () => {
    const res = await state.call('GET', '/health');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
    assert.ok(res.headers.get('x-request-id'));
  });

  test('unknown routes use the error envelope', async () => {
    const res = await state.call('GET', '/nope');
    assert.equal(res.status, 404);
    assert.equal(res.json.success, false);
    assert.equal(res.json.error.code, 'NOT_FOUND');
  });

  test('malformed JSON is a 400, not a stack trace', async () => {
    const res = await state.call('POST', '/patients', {
      token: USERS.doctor.token,
      body: '{not json',
      headers: {},
    });
    assert.equal(res.status, 400);
    assert.equal(res.json.error.code, 'BAD_REQUEST');
  });

  test('CORS allows the frontend origin and refuses others', async () => {
    const ok = await state.call('GET', '/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const bad = await state.call('GET', '/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });
});

describe('authentication', () => {
  test('protected routes need a token', async () => {
    for (const path of ['/auth/me', '/patients', '/accounts', '/audit', '/me/screenings', '/staff']) {
      const res = await state.call('GET', path);
      assert.equal(res.status, 401, path);
      assert.equal(res.json.error.code, 'UNAUTHORIZED');
    }
    assert.equal(dataQueries().length, 0);
  });

  test('a forged or expired token is rejected', async () => {
    const res = await state.call('GET', '/auth/me', { token: 'not-a-real-token' });
    assert.equal(res.status, 401);
  });

  test('a malformed Authorization header is rejected', async () => {
    const res = await state.call('GET', '/auth/me', { headers: { Authorization: 'Token abc' } });
    assert.equal(res.status, 401);
  });

  test('a suspended account is refused even with a valid token', async () => {
    const res = await state.call('GET', '/auth/me', { token: USERS.suspended.token });
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, 'ACCOUNT_SUSPENDED');
  });

  test('/auth/me returns the account without any credential field', async () => {
    const res = await state.call('GET', '/auth/me', { token: USERS.doctor.token });
    assert.equal(res.status, 200);
    const account = res.json.data.account;
    assert.equal(account.role, 'professional');
    assert.equal(account.email, 'doctor@t.test');
    assert.equal(account.staffUserId, USERS.doctor.profile.id);
    assert.equal('passwordHash' in account, false);
    assert.equal('password' in account, false);
  });
});

describe('authorization by role', () => {
  test('a patient is refused every staff and admin route before any data is read', async () => {
    const routes = [
      ['GET', '/patients'],
      ['GET', `/patients/${PATIENT_ID}`],
      ['GET', '/accounts'],
      ['GET', '/audit'],
      ['GET', '/screenings'],
      ['GET', `/screenings/${SCREENING_ID}`],
      ['GET', `/screenings/${SCREENING_ID}/image`],
      ['GET', '/referrals'],
      ['GET', '/followups'],
      ['GET', '/dashboard/summary'],
    ];
    for (const [method, path] of routes) {
      const res = await state.call(method, path, { token: USERS.patient.token });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(dataQueries().length, 0, 'no data table was touched');
  });

  test('a patient cannot write facilities, roles or reviews', async () => {
    const attempts = [
      ['POST', '/facilities', { name: 'X', type: 'clinic' }],
      ['PATCH', `/accounts/${uid(1)}/role`, { role: 'admin' }],
      ['POST', `/screenings/${SCREENING_ID}/review`, { agreement: 'agrees', decision: 'refer', notes: '' }],
    ];
    for (const [method, path, body] of attempts) {
      const res = await state.call(method, path, { token: USERS.patient.token, body });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(dataQueries().length, 0);
  });

  test('a professional cannot reach administration', async () => {
    for (const [method, path, body] of [
      ['GET', '/accounts'],
      ['GET', '/audit'],
      ['PATCH', `/accounts/${uid(1)}/role`, { role: 'admin' }],
      ['PATCH', `/accounts/${uid(1)}/status`, { status: 'suspended' }],
      ['POST', '/facilities', { name: 'Rogue Clinic', type: 'clinic' }],
    ]) {
      const res = await state.call(method, path, { token: USERS.doctor.token, body });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(dataQueries().length, 0);
  });

  test('an administrator is refused the radiograph, reviews and every clinical write', async () => {
    const attempts = [
      ['GET', `/screenings/${SCREENING_ID}/image`],
      ['POST', `/screenings/${SCREENING_ID}/review`, { agreement: 'agrees', decision: 'refer', notes: 'x' }],
      ['POST', `/screenings/${SCREENING_ID}/analyze`],
      ['POST', '/screenings', { patientId: PATIENT_ID }],
      ['GET', '/referrals'],
      ['GET', '/followups'],
      ['GET', '/dashboard/summary'],
      ['POST', `/patients/${PATIENT_ID}/notes`, { body: 'hello there' }],
    ];
    for (const [method, path, body] of attempts) {
      const res = await state.call(method, path, { token: USERS.admin.token, body });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(dataQueries().length, 0, 'the clinical tables were never queried');
    assert.equal(state.storageCalls.length, 0, 'storage was never touched');
  });

  test('a community health worker (cannot review) is refused sign-off', async () => {
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/review`, {
      token: USERS.chw.token,
      body: { agreement: 'agrees', decision: 'refer', notes: 'looks fine' },
    });
    assert.equal(res.status, 403);
    assert.equal(dataQueries().length, 0);
  });

  test('a professional with no staff record cannot act clinically', async () => {
    const res = await state.call('GET', '/referrals', { token: USERS.unstaffed.token });
    assert.equal(res.status, 403);
    assert.match(res.json.error.message, /staff record/i);
  });
});

describe('input validation', () => {
  test('rejects a role outside the three stored roles', async () => {
    const res = await state.call('PATCH', `/accounts/${uid(1)}/role`, {
      token: USERS.admin.token,
      body: { role: 'superuser' },
    });
    assert.equal(res.status, 422);
    assert.equal(res.json.error.code, 'VALIDATION_ERROR');
    assert.equal(dataQueries().length, 0);
  });

  test('rejects unknown keys instead of ignoring them', async () => {
    const res = await state.call('PATCH', `/accounts/${uid(1)}/role`, {
      token: USERS.admin.token,
      body: { role: 'professional', status: 'active' },
    });
    assert.equal(res.status, 422);
  });

  test('rejects a malformed id', async () => {
    const res = await state.call('GET', '/accounts/not-a-uuid', { token: USERS.admin.token });
    assert.equal(res.status, 422);
    assert.ok(res.json.error.details['params.id']);
  });

  test('a facility cannot be created already published', async () => {
    const res = await state.call('POST', '/facilities', {
      token: USERS.admin.token,
      body: { name: 'Eager Clinic', type: 'clinic', published: true },
    });
    assert.equal(res.status, 422);
  });

  test('a review cannot be filed in someone else’s name', async () => {
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/review`, {
      token: USERS.doctor.token,
      body: { agreement: 'agrees', decision: 'refer', notes: 'ok', reviewerId: uid(99) },
    });
    assert.equal(res.status, 422);
    assert.equal(dataQueries().length, 0);
  });

  test('screening input is range-checked', async () => {
    const res = await state.call('POST', '/screenings', {
      token: USERS.doctor.token,
      body: {
        patientId: PATIENT_ID,
        symptoms: {
          coughWeeks: 9999, hemoptysis: false, nightSweats: false, weightLoss: false,
          fever: false, chestPain: false, fatigue: false, appetiteLoss: false,
        },
        vitals: { weightKg: -5, heightCm: null, temperatureC: null, respiratoryRate: null },
        imageQuality: 'excellent',
      },
    });
    assert.equal(res.status, 422);
    assert.ok(Object.keys(res.json.error.details).length >= 2);
  });
});

describe('administration', () => {
  test('a role change calls the database function with the validated arguments', async () => {
    handlers.onRpc = (name) => (name === 'admin_set_account_role' ? { data: { id: uid(1) } } : undefined);
    const res = await state.call('PATCH', `/accounts/${uid(1)}/role`, {
      token: USERS.admin.token,
      body: { role: 'professional' },
    });
    assert.equal(res.status, 200);
    const rpc = state.calls.find((c) => c.rpc === 'admin_set_account_role');
    assert.deepEqual(rpc.args, { p_target: uid(1), p_role: 'professional' });
    assert.equal(rpc.client, 'user', 'runs as the administrator, not the service role');
  });

  test('a database refusal (self-change, last admin) surfaces as a safe 403', async () => {
    handlers.onRpc = () => ({ error: { code: '42501', message: 'You cannot change your own role' } });
    const res = await state.call('PATCH', `/accounts/${USERS.admin.profile.id}/role`, {
      token: USERS.admin.token,
      body: { role: 'patient' },
    });
    assert.equal(res.status, 403);
    assert.match(res.json.error.message, /own role/);
  });

  test('suspension also bans the auth user so sessions cannot be refreshed', async () => {
    handlers.onRpc = () => ({ data: { id: uid(1) } });
    const suspend = await state.call('PATCH', `/accounts/${uid(1)}/status`, {
      token: USERS.admin.token,
      body: { status: 'suspended' },
    });
    assert.equal(suspend.status, 200);
    assert.deepEqual(state.calls.find((c) => c.rpc === 'admin_set_account_status').args, {
      p_target: uid(1),
      p_status: 'suspended',
    });
    assert.equal(state.authAdminCalls[0].id, uid(1));
    assert.notEqual(state.authAdminCalls[0].attributes.ban_duration, 'none');

    const reactivate = await state.call('PATCH', `/accounts/${uid(1)}/status`, {
      token: USERS.admin.token,
      body: { status: 'active' },
    });
    assert.equal(reactivate.status, 200);
    assert.equal(state.authAdminCalls[1].attributes.ban_duration, 'none');
  });

  test('a new facility is written unpublished and flagged for review', async () => {
    handlers.onQuery = (call) =>
      call.table === 'healthcare_facilities' && call.op === 'insert'
        ? [{ id: uid(500), ...call.payload, latitude: null, longitude: null }]
        : undefined;
    const res = await state.call('POST', '/facilities', {
      token: USERS.admin.token,
      body: { name: 'Puskesmas Baru', type: 'puskesmas', services: ['cxr'] },
    });
    assert.equal(res.status, 201);
    const insert = state.calls.find((c) => c.table === 'healthcare_facilities' && c.op === 'insert');
    assert.equal(insert.payload.published, false);
    assert.equal(insert.payload.info_status, 'needs-review');
    assert.equal(res.json.data.published, false);
    assert.equal(res.json.data.coordinates, null, 'no guessed position');
    const audit = state.calls.find((c) => c.table === 'audit_logs' && c.op === 'insert');
    assert.equal(audit.client, 'admin');
    assert.equal(audit.payload.actor_id, USERS.admin.profile.id, 'actor comes from the session');
    assert.equal(audit.payload.action, 'facility.created');
  });

  test('the audit trail is administrator-only and paginated', async () => {
    handlers.onQuery = (call) => (call.table === 'audit_logs' ? { data: [], count: 0 } : undefined);
    const res = await state.call('GET', '/audit?page=2&pageSize=25&action=facility.created', {
      token: USERS.admin.token,
    });
    assert.equal(res.status, 200);
    const query = state.calls.find((c) => c.table === 'audit_logs');
    assert.deepEqual(query.range, [25, 49]);
    assert.deepEqual(res.json.meta, { page: 2, pageSize: 25, total: 0, pageCount: 1 });
  });
});

describe('facilities directory', () => {
  test('anonymous visitors only ever get published entries, whatever they ask for', async () => {
    const res = await state.call('GET', '/facilities?published=false');
    assert.equal(res.status, 200);
    const query = state.calls.find((c) => c.table === 'healthcare_facilities');
    assert.equal(query.client, 'anon');
    assert.deepEqual(query.filters.find((f) => f[1] === 'published'), ['eq', 'published', true]);
  });

  test('a patient cannot widen the list to unpublished entries either', async () => {
    await state.call('GET', '/facilities?published=false', { token: USERS.patient.token });
    const query = state.calls.find((c) => c.table === 'healthcare_facilities');
    assert.deepEqual(query.filters.find((f) => f[1] === 'published'), ['eq', 'published', true]);
  });

  test('an administrator can ask for the unpublished set', async () => {
    await state.call('GET', '/facilities?published=false', { token: USERS.admin.token });
    const query = state.calls.find((c) => c.table === 'healthcare_facilities');
    assert.deepEqual(query.filters.find((f) => f[1] === 'published'), ['eq', 'published', false]);
  });

  test('search text cannot inject PostgREST filter syntax', async () => {
    await state.call('GET', '/facilities?q=' + encodeURIComponent('x,id.eq.1)(*%'), {});
    const query = state.calls.find((c) => c.table === 'healthcare_facilities');
    const or = query.filters.find((f) => f[0] === 'or')[1];
    const term = or.split('ilike.%')[1].split('%')[0];
    assert.doesNotMatch(term, /[,()*%]/);
  });
});

describe('patient records', () => {
  test('listing paginates and reports totals', async () => {
    handlers.onQuery = (call) => (call.table === 'patient_profiles' ? { data: [], count: 37 } : undefined);
    const res = await state.call('GET', '/patients?page=2&pageSize=10', { token: USERS.doctor.token });
    assert.equal(res.status, 200);
    const query = state.calls.find((c) => c.table === 'patient_profiles' && c.range);
    assert.deepEqual(query.range, [10, 19]);
    assert.deepEqual(res.json.meta, { page: 2, pageSize: 10, total: 37, pageCount: 4 });
  });

  test('opening a record is audited, and no audit means no record', async () => {
    const row = {
      id: PATIENT_ID, mrn: 'TB-2601-0001', name: 'Siti', sex: 'female', birth_date: '1991-04-18',
      phone: null, village: 'V', district: 'D', province: 'P', home_facility_id: uid(201),
      risk_factors: [], household_contacts: 0, registered_at: '2026-01-01T00:00:00Z',
    };
    handlers.onQuery = (call) => (call.table === 'patient_profiles' ? [row] : undefined);

    const ok = await state.call('GET', `/patients/${PATIENT_ID}`, { token: USERS.doctor.token });
    assert.equal(ok.status, 200);
    const audit = state.calls.find((c) => c.table === 'audit_logs' && c.op === 'insert');
    assert.equal(audit.payload.action, 'patient.viewed');
    assert.equal(audit.payload.actor_id, USERS.doctor.profile.id);

    state.calls.length = 0;
    handlers.onQuery = (call) => {
      if (call.table === 'patient_profiles') return [row];
      if (call.table === 'audit_logs') return { error: { code: 'XX000', message: 'disk full' } };
      return undefined;
    };
    const failed = await state.call('GET', `/patients/${PATIENT_ID}`, { token: USERS.doctor.token });
    assert.equal(failed.status, 500, 'fails closed when the read cannot be recorded');
    assert.equal(failed.json.error.message, 'Something went wrong on our side.');
  });

  test('a record outside the caller’s scope reads as not found', async () => {
    handlers.onQuery = () => []; // what RLS returns for a patient at another facility
    const res = await state.call('GET', `/patients/${uid(777)}`, { token: USERS.doctor.token });
    assert.equal(res.status, 404);
  });
});

describe('screenings: images, model and review', () => {
  const screeningRow = (overrides = {}) => ({
    id: SCREENING_ID,
    patient_id: PATIENT_ID,
    facility_id: uid(201),
    operator_id: USERS.doctor.profile.id,
    performed_at: '2026-02-01T08:00:00Z',
    status: 'queued',
    image_quality: 'adequate',
    created_offline: false,
    screening_reports: { symptoms: {}, vitals: {}, image_path: null, image_meta: null, model_status: 'not-run', analysis: null },
    screening_reviews: null,
    referrals: [],
    ...overrides,
  });

  function multipart(bytes, name = 'film.png', type = 'image/png') {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), name);
    return form;
  }

  test('rejects a file that only claims to be an image', async () => {
    handlers.onQuery = (call) => (call.table === 'screenings' ? [screeningRow()] : undefined);
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/image`, {
      token: USERS.doctor.token,
      form: multipart(Buffer.from('<script>alert(1)</script> not an image at all'), 'x.png', 'image/png'),
    });
    assert.equal(res.status, 422);
    assert.equal(state.storageCalls.length, 0);
  });

  test('stores a real PNG under the patient’s folder, using the service role only after the access check', async () => {
    handlers.onQuery = (call) => {
      if (call.table === 'screenings') return [screeningRow()];
      if (call.table === 'screening_reports') return [{ image_path: null, ...screeningRow().screening_reports }];
      return undefined;
    };
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/image`, {
      token: USERS.doctor.token,
      form: multipart(PNG),
    });
    assert.equal(res.status, 200);

    const upload = state.storageCalls.find((c) => c.op === 'upload');
    assert.match(upload.path, new RegExp(`^${PATIENT_ID}/${SCREENING_ID}/[0-9a-f-]+\\.png$`));
    assert.equal(upload.bucket, 'screening-images');
    assert.equal(upload.options.contentType, 'image/png');

    const write = state.calls.find((c) => c.table === 'screening_reports' && c.op === 'update');
    assert.equal(write.client, 'admin');
    assert.equal(write.payload.image_path, upload.path);
    assert.equal(write.payload.image_meta.width, 512, 'dimensions are read from the file, not the request');
    assert.equal(write.payload.image_meta.height, 384);
    assert.equal(write.payload.model_status, 'not-run');
    assert.equal(write.payload.analysis, null, 'a new image invalidates old model output');
  });

  test('only the operator can attach the image', async () => {
    handlers.onQuery = (call) =>
      call.table === 'screenings' ? [screeningRow({ operator_id: uid(42) })] : undefined;
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/image`, {
      token: USERS.doctor.token,
      form: multipart(PNG),
    });
    assert.equal(res.status, 403);
    assert.equal(state.storageCalls.length, 0);
  });

  test('a signed URL is issued only after the access is audited', async () => {
    handlers.onQuery = (call) =>
      call.table === 'screening_reports' ? [{ image_path: `${PATIENT_ID}/${SCREENING_ID}/a.png` }] : undefined;
    const res = await state.call('GET', `/screenings/${SCREENING_ID}/image`, { token: USERS.doctor.token });
    assert.equal(res.status, 200);
    assert.match(res.json.data.url, /^http:\/\/storage\.test\//);
    assert.equal(res.json.data.expiresInSeconds, 60);

    const order = [];
    state.calls.forEach((c) => c.table === 'audit_logs' && order.push('audit'));
    assert.equal(order.length, 1);
    assert.equal(state.calls.find((c) => c.table === 'audit_logs').payload.action, 'screening.image-viewed');
    assert.equal(state.storageCalls.find((c) => c.op === 'sign').ttl, 60);
  });

  test('no audit entry, no image URL', async () => {
    handlers.onQuery = (call) => {
      if (call.table === 'screening_reports') return [{ image_path: 'p/q/a.png' }];
      if (call.table === 'audit_logs') return { error: { code: 'XX000', message: 'down' } };
      return undefined;
    };
    const res = await state.call('GET', `/screenings/${SCREENING_ID}/image`, { token: USERS.doctor.token });
    assert.equal(res.status, 500);
    assert.equal(state.storageCalls.filter((c) => c.op === 'sign').length, 0);
  });

  test('analysis without a connected model answers 503 and records that it did not run', async () => {
    handlers.onQuery = (call) =>
      call.table === 'screenings'
        ? [screeningRow({ screening_reports: { ...screeningRow().screening_reports, image_path: 'p/q/a.png' } })]
        : undefined;
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/analyze`, { token: USERS.doctor.token });
    assert.equal(res.status, 503);
    assert.equal(res.json.error.code, 'MODEL_NOT_CONNECTED');
    const write = state.calls.find((c) => c.table === 'screening_reports' && c.op === 'update');
    assert.deepEqual(write.payload, { model_status: 'unavailable' });
    assert.equal(
      state.calls.filter((c) => c.payload && c.payload.analysis).length,
      0,
      'nothing resembling a model result was ever written',
    );
  });

  test('a clinician with review rights signs off, and the reviewer id is theirs', async () => {
    handlers.onQuery = (call) => {
      if (call.table === 'screenings') return [screeningRow({ status: 'reviewed' })];
      if (call.table === 'screening_reviews') return [{ screening_id: SCREENING_ID }];
      return undefined;
    };
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/review`, {
      token: USERS.doctor.token,
      body: { agreement: 'agrees', decision: 'observe', notes: 'Recheck in four weeks' },
    });
    assert.equal(res.status, 201);
    const insert = state.calls.find((c) => c.table === 'screening_reviews' && c.op === 'insert');
    assert.equal(insert.client, 'user');
    assert.equal(insert.payload.reviewer_id, USERS.doctor.profile.id);
    const note = state.calls.find((c) => c.table === 'patient_notes' && c.op === 'insert');
    assert.equal(note.payload.context, 'screening');
  });

  test('a database refusal on review (not assigned, already reviewed) maps to a safe error', async () => {
    handlers.onQuery = (call) =>
      call.table === 'screening_reviews'
        ? { error: { code: '42501', message: 'new row violates row-level security policy for table "screening_reviews"' } }
        : undefined;
    const res = await state.call('POST', `/screenings/${SCREENING_ID}/review`, {
      token: USERS.doctor.token,
      body: { agreement: 'agrees', decision: 'observe', notes: '' },
    });
    assert.equal(res.status, 403);
    assert.doesNotMatch(res.json.error.message, /row-level security|screening_reviews/i);
  });
});

describe('patient self-service', () => {
  test('a patient lists their own screenings and gets no clinical fields', async () => {
    handlers.onQuery = (call) =>
      call.table === 'screenings'
        ? [
            {
              id: SCREENING_ID, patient_id: uid(101), facility_id: uid(201), operator_id: uid(2),
              performed_at: '2026-02-01T08:00:00Z', status: 'reviewed', image_quality: 'adequate',
              screening_reviews: { reviewer_id: uid(2), reviewed_at: '2026-02-02T08:00:00Z', agreement: 'agrees', decision: 'observe', notes: 'Fine' },
              referrals: [],
            },
          ]
        : undefined;
    const res = await state.call('GET', '/me/screenings', { token: USERS.patient.token });
    assert.equal(res.status, 200);
    const [item] = res.json.data;
    assert.equal(item.review.notes, 'Fine');
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'imageKey', 'imageMeta', 'modelStatus']) {
      assert.equal(hidden in item, false, `${hidden} must not be sent to a patient`);
    }
    assert.equal(
      state.calls.find((c) => c.table === 'screenings').columns.includes('screening_reports'),
      false,
      'the clinical table is not even selected',
    );
  });

  test('onboarding steps are validated and cannot carry a role', async () => {
    const res = await state.call('PATCH', '/me/onboarding/personal', {
      token: USERS.patient.token,
      body: { fullName: 'Siti', birthDate: '1991-04-18', phone: '0812', sex: 'female', role: 'admin' },
    });
    assert.equal(res.status, 422);
    assert.equal(dataQueries().length, 0);
  });

  test('completing onboarding calls the database function, not a direct update', async () => {
    handlers.onRpc = () => ({ data: { profile_id: USERS.patient.profile.id } });
    const res = await state.call('POST', '/me/onboarding/complete', {
      token: USERS.patient.token,
      body: { dataUse: true, healthInfo: false },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(state.calls.find((c) => c.rpc === 'complete_patient_onboarding').args, {
      p_data_use: true,
      p_health_info: false,
    });
  });

  test('learning progress ids are restricted to slugs', async () => {
    const bad = await state.call('PUT', '/me/learning/..%2F..%2Fetc', { token: USERS.patient.token });
    assert.equal(bad.status, 422);
    const good = await state.call('PUT', '/me/learning/what-is-tb', { token: USERS.patient.token });
    assert.equal(good.status, 200);
  });
});

describe('database error handling', () => {
  test('a unique violation becomes 409', async () => {
    handlers.onQuery = (call) =>
      call.table === 'patient_profiles' ? { error: { code: '23505', message: 'duplicate key value' } } : undefined;
    const res = await state.call('GET', '/patients', { token: USERS.doctor.token });
    assert.equal(res.status, 409);
  });

  test('an unexpected error never leaks internals', async () => {
    handlers.onQuery = (call) =>
      call.table === 'patient_profiles'
        ? { error: { code: 'XX000', message: 'connection string postgres://user:secret@host' } }
        : undefined;
    const res = await state.call('GET', '/patients', { token: USERS.doctor.token });
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(res.json), /secret|postgres:/);
  });
});
