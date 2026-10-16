/**
 * End-to-end: real Express app -> real supabase-js -> real PostgREST -> real
 * migrations (PGlite). Nothing between the HTTP request and the SQL is faked
 * except GoTrue (tokens are minted with the shared secret) and Storage (in
 * memory, service-role only).
 *
 * Requires the PostgREST binary: `npm run e2e:setup`. Skipped without it.
 *
 * Limitation worth knowing: pglite-socket drops the connection when Postgres
 * raises an error, so PostgREST answers 503 instead of the real error body.
 * Paths that depend on a raised SQL error (unique/check violations, RPC
 * `raise exception`) are therefore covered in rls.test.js, which talks to
 * Postgres directly, and not here.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createInferenceClient } from '../../src/services/inferenceService.js';
import { createRecorder } from '../helpers/coverage.js';
import { startServer } from '../helpers/fakeGateway.js';
import { ANON_KEY, SERVICE_KEY, stackAvailable, startStack, userToken } from './stack.js';

const skip = stackAvailable ? false : 'PostgREST binary not found (run `npm run e2e:setup`)';

// Seeded identities (backend/supabase/seed.sql)
const ID = {
  patient: 'a0000000-0000-4000-8000-000000000001',
  doctor: 'a0000000-0000-4000-8000-000000000002',
  chw: 'a0000000-0000-4000-8000-000000000003',
  admin: 'a0000000-0000-4000-8000-000000000004',
  sitiRecord: 'b0000000-0000-4000-8000-000000000001',
  yosefRecord: 'b0000000-0000-4000-8000-000000000002',
  waerana: 'f0000000-0000-4000-8000-000000000001',
  lembor: 'f0000000-0000-4000-8000-000000000004',
};
const EMAIL = {
  patient: 'patient@parupintas.test',
  doctor: 'doctor@parupintas.test',
  chw: 'chw@parupintas.test',
  admin: 'admin@parupintas.test',
};
const token = (who) => userToken(ID[who], EMAIL[who]);

// Field lists are the frontend's own domain types (frontend/src/types/*.ts).
const SHAPES = {
  facility: ['id', 'name', 'type', 'region', 'province', 'address', 'phone', 'coordinates', 'services', 'distanceKm', 'travelTimeMinutes', 'infoStatus', 'infoUpdatedAt', 'operatingHours', 'tbProgrammeContact', 'published'],
  patient: ['id', 'mrn', 'name', 'sex', 'birthDate', 'phone', 'village', 'district', 'province', 'homeFacilityId', 'riskFactors', 'householdContacts', 'registeredAt', 'notes'],
  screening: ['id', 'patientId', 'facilityId', 'operatorId', 'performedAt', 'status', 'symptoms', 'vitals', 'imageKey', 'sampleImage', 'imageMeta', 'imageQuality', 'modelStatus', 'analysis', 'review', 'referralId', 'sync', 'createdOffline'],
  referral: ['id', 'code', 'patientId', 'screeningId', 'fromFacilityId', 'toFacilityId', 'reason', 'requestedService', 'priority', 'status', 'createdAt', 'appointmentDate', 'assignedWorkerId', 'history', 'sync'],
  followUp: ['id', 'code', 'patientId', 'referralId', 'screeningId', 'reason', 'dueDate', 'status', 'assignedWorkerId', 'createdAt', 'completedAt', 'unresolvedReason', 'attempts', 'sync'],
  account: ['id', 'name', 'email', 'role', 'status', 'createdAt', 'lastSignInAt', 'staffUserId', 'patientId', 'onboarding'],
  staff: ['id', 'name', 'role', 'canReview', 'facilityId', 'email', 'phone'],
  audit: ['id', 'at', 'actorId', 'actorName', 'action', 'subject', 'detail'],
  dashboard: ['totalScreenings', 'screeningsThisWeek', 'awaitingReview', 'pendingReferrals', 'overdueFollowUps', 'dueTodayFollowUps', 'upcomingFollowUps', 'flaggedAwaitingReview', 'inconclusiveOpen', 'draftRecords', 'activity', 'outcomeBreakdown'],
};
function assertShape(value, shape, label) {
  const missing = SHAPES[shape].filter((key) => !(key in value));
  assert.deepEqual(missing, [], `${label}: fields the frontend expects but the API did not send`);
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  Buffer.from([0, 0, 0x02, 0x00, 0, 0, 0x01, 0x80]),
  Buffer.alloc(64, 7),
]);
const form = (bytes, type = 'image/png') => {
  const f = new FormData();
  f.append('image', new Blob([bytes], { type }), 'film.png');
  return f;
};
const SYMPTOMS = { coughWeeks: 4, hemoptysis: false, nightSweats: true, weightLoss: true, fever: false, chestPain: false, fatigue: true, appetiteLoss: false };
const VITALS = { weightKg: 52, heightCm: 160, temperatureC: 37.4, respiratoryRate: 20 };

const recorder = createRecorder();
let stack;
let api; // HTTP helper for the backend under test
let closeApi;
const ctx = {};

async function bootBackend({ inference } = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    SUPABASE_URL: stack.url,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    FRONTEND_ORIGIN: 'http://localhost:5173',
    ...(inference ? { INFERENCE_SERVICE_URL: inference.url, INFERENCE_API_KEY: inference.key } : {}),
  });
  const app = createApp({ config, logger: { error() {}, info() {}, warn() {} } });
  const server = await startServer(app);
  return {
    ...server,
    call: async (method, path, options) => {
      const res = await server.call(method, path, options);
      recorder.record(method, path, res.status);
      return res;
    },
  };
}

before(async () => {
  if (skip) return;
  stack = await startStack();
  const server = await bootBackend();
  api = server.call;
  closeApi = server.close;
});
after(async () => {
  await closeApi?.();
  await stack?.stop();
});

describe('public and session', { skip }, () => {
  test('anonymous visitors read the published facility directory in the shape the frontend expects', async () => {
    const res = await api('GET', '/facilities');
    assert.equal(res.status, 200);
    assert.equal(res.json.data.length, 14);
    assertShape(res.json.data[0], 'facility', 'facility');
    assert.ok(res.json.data.every((f) => f.published === true));
    const waerana = res.json.data.find((f) => f.id === ID.waerana);
    assert.deepEqual(waerana.coordinates, { lat: -8.6221, lng: 120.1894 });
    assert.deepEqual(waerana.services.sort(), ['cxr', 'general-outpatient', 'sputum-microscopy', 'tb-treatment']);
  });

  test('a stranger sees nothing private and a forged token is refused', async () => {
    assert.equal((await api('GET', '/patients')).status, 401);
    assert.equal((await api('GET', '/auth/me', { token: 'x.y.z' })).status, 401);
  });

  test('each seeded role gets its own account shape from /auth/me', async () => {
    for (const [who, role] of [['patient', 'patient'], ['doctor', 'professional'], ['chw', 'professional'], ['admin', 'admin']]) {
      const res = await api('GET', '/auth/me', { token: token(who) });
      assert.equal(res.status, 200, who);
      const { account } = res.json.data;
      assertShape(account, 'account', who);
      assert.equal(account.role, role);
      assert.equal('passwordHash' in account, false);
    }
    const patient = (await api('GET', '/auth/me', { token: token('patient') })).json.data.account;
    assert.equal(patient.patientId, ID.sitiRecord);
    assert.ok(patient.onboarding.completedAt);
    assert.equal(patient.onboarding.personal.fullName, 'Siti Rahmawati');
    assert.equal(patient.onboarding.consent.healthInfo, true);
    const doctor = (await api('GET', '/auth/me', { token: token('doctor') })).json.data.account;
    assert.equal(doctor.staffUserId, ID.doctor);
  });

  test('the first sign-in is recorded', async () => {
    const res = await api('GET', '/auth/me', { token: token('doctor') });
    assert.ok(res.json.data.account.lastSignInAt);
  });
});

describe('patient registration and onboarding', { skip }, () => {
  test('a new account starts as a patient with an empty onboarding, whatever the sign-up claimed', async () => {
    ctx.newId = '77777777-7777-4777-8777-777777777777';
    await stack.db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'newbie@e2e.test', $2)`,
      [ctx.newId, JSON.stringify({ full_name: 'Newbie Patient', role: 'admin' })],
    );
    ctx.newToken = userToken(ctx.newId, 'newbie@e2e.test');
    const res = await api('GET', '/auth/me', { token: ctx.newToken });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.account.role, 'patient');
    assert.equal(res.json.data.account.name, 'Newbie Patient');
    assert.equal(res.json.data.account.patientId, null);
    assert.equal(res.json.data.account.onboarding.completedAt, null);
    assert.equal((await api('GET', '/patients', { token: ctx.newToken })).status, 403);
    const before = await api('GET', '/me/patient', { token: ctx.newToken });
    assert.equal(before.status, 200);
    assert.equal(before.json.data, null, 'no record yet is null, not an error');
  });

  test('steps are saved one by one and resume', async () => {
    const t = ctx.newToken;
    const personal = await api('PATCH', '/me/onboarding/personal', { token: t, body: { fullName: 'Newbie Patient', birthDate: '1990-05-05', phone: '0812-0000-1111', sex: 'male' } });
    assert.equal(personal.status, 200);
    assert.equal(personal.json.data.onboarding.step, 1);
    const address = await api('PATCH', '/me/onboarding/address', { token: t, body: { province: 'Nusa Tenggara Timur', district: 'Manggarai Barat', village: 'Labuan Bajo', addressLine: 'Jl. Contoh 1' } });
    assert.equal(address.json.data.onboarding.step, 2);
    const health = await api('PATCH', '/me/onboarding/health', { token: t, body: { symptoms: ['cough'], symptomWeeks: 2, priorTb: 'never', householdContact: false, notes: '', shared: true } });
    assert.equal(health.json.data.onboarding.step, 3);

    const resumed = await api('GET', '/me/onboarding', { token: t });
    assert.equal(resumed.json.data.onboarding.personal.fullName, 'Newbie Patient');
    assert.deepEqual(resumed.json.data.onboarding.health.symptoms, ['cough']);
  });

  test('completing creates the clinical record, unplaced, and the profile can still be edited', async () => {
    const t = ctx.newToken;
    const done = await api('POST', '/me/onboarding/complete', { token: t, body: { dataUse: true, healthInfo: true } });
    assert.equal(done.status, 200);
    assert.ok(done.json.data.account.patientId);
    assert.ok(done.json.data.onboarding.completedAt);
    ctx.newPatientId = done.json.data.account.patientId;

    const record = await api('GET', '/me/patient', { token: t });
    assertShape(record.json.data, 'patient', 'own patient');
    assert.match(record.json.data.mrn, /^TB-\d{4}-\d{4}$/);
    assert.equal(record.json.data.homeFacilityId, null);
    assert.equal(record.json.data.village, 'Labuan Bajo');

    const edit = await api('PATCH', '/me/onboarding/personal', { token: t, body: { fullName: 'Newbie P. Renamed', birthDate: '1990-05-05', phone: '0812-9999-0000', sex: 'male' } });
    assert.equal(edit.status, 200);
    const after = await api('GET', '/me/patient', { token: t });
    assert.equal(after.json.data.name, 'Newbie P. Renamed');
    assert.equal(after.json.data.phone, '0812-9999-0000');

    // Other onboarding sections are locked once complete.
    const locked = await api('PATCH', '/me/onboarding/address', { token: t, body: { province: 'x', district: 'y', village: 'z', addressLine: '' } });
    assert.equal(locked.status, 409);
  });

  test('withdrawing health consent clears the answers, not just the flag', async () => {
    const res = await api('PATCH', '/me/consent/health', { token: ctx.newToken, body: { healthInfo: false } });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.onboarding.health, null);
    assert.equal(res.json.data.onboarding.consent.healthInfo, false);
  });

  test('an unplaced patient is invisible to professionals until an administrator places them', async () => {
    const before = await api('GET', '/patients', { token: token('doctor') });
    assert.ok(!before.json.data.some((p) => p.id === ctx.newPatientId));
    assert.equal((await api('GET', `/patients/${ctx.newPatientId}`, { token: token('doctor') })).status, 404);

    const asDoctor = await api('PATCH', `/patients/${ctx.newPatientId}/home-facility`, { token: token('doctor'), body: { homeFacilityId: ID.waerana } });
    assert.equal(asDoctor.status, 403);

    const placed = await api('PATCH', `/patients/${ctx.newPatientId}/home-facility`, { token: token('admin'), body: { homeFacilityId: ID.waerana } });
    assert.equal(placed.status, 200);
    assert.equal(placed.json.data.homeFacilityId, ID.waerana);

    const after = await api('GET', '/patients', { token: token('doctor') });
    assert.ok(after.json.data.some((p) => p.id === ctx.newPatientId));
  });
});

describe('clinical workflow', { skip }, () => {
  test('a professional lists, searches and opens assigned patients (opening is audited)', async () => {
    const list = await api('GET', '/patients?page=1&pageSize=2', { token: token('doctor') });
    assert.equal(list.status, 200);
    assert.equal(list.json.data.length, 2);
    assert.ok(list.json.meta.total >= 4);
    assert.equal(list.json.meta.pageSize, 2);
    assertShape(list.json.data[0], 'patient', 'listed patient');

    const search = await api('GET', '/patients?q=yosef', { token: token('doctor') });
    assert.deepEqual(search.json.data.map((p) => p.name), ['Yosef Banggur']);

    const detail = await api('GET', `/patients/${ID.sitiRecord}`, { token: token('doctor') });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.json.data.notes, []);

    const audit = await api('GET', '/audit?action=patient.viewed', { token: token('admin') });
    assert.ok(audit.json.data.some((e) => e.subject === 'TB-2601-0001' && e.actorId === ID.doctor));
  });

  test('registering a walk-in patient places them at the professional’s facility', async () => {
    const res = await api('POST', '/patients', {
      token: token('doctor'),
      body: { name: 'Walk In Patient', sex: 'male', birthDate: '1975-03-03', phone: '0813-111-222', village: 'Golo Mbu', district: 'Waerana', province: 'Nusa Tenggara Timur', riskFactors: ['smoker', 'diabetes'], householdContacts: 3 },
    });
    assert.equal(res.status, 201);
    assertShape(res.json.data, 'patient', 'created patient');
    assert.equal(res.json.data.homeFacilityId, ID.waerana);
    assert.deepEqual(res.json.data.riskFactors.sort(), ['diabetes', 'smoker']);
    ctx.walkInId = res.json.data.id;

    const note = await api('POST', `/patients/${ctx.walkInId}/notes`, { token: token('doctor'), body: { body: 'Referred by the village cadre.', context: 'general' } });
    assert.equal(note.status, 201);
    const reread = await api('GET', `/patients/${ctx.walkInId}`, { token: token('doctor') });
    assert.equal(reread.json.data.notes.length, 1);
    assert.equal(reread.json.data.notes[0].authorId, ID.doctor);
  });

  test('a screening goes draft -> queued, takes an image through private storage, and is not analysed without a model', async () => {
    const draft = await api('POST', '/screenings', { token: token('doctor'), body: { patientId: ID.sitiRecord, symptoms: SYMPTOMS, vitals: VITALS, imageQuality: 'adequate', asDraft: true } });
    assert.equal(draft.status, 201);
    assertShape(draft.json.data, 'screening', 'screening');
    assert.equal(draft.json.data.status, 'draft');
    assert.equal(draft.json.data.facilityId, ID.waerana);
    assert.equal(draft.json.data.operatorId, ID.doctor);
    assert.deepEqual(draft.json.data.symptoms, SYMPTOMS);
    assert.equal(draft.json.data.imageKey, null);
    assert.equal(draft.json.data.analysis, null);
    assert.equal(draft.json.data.modelStatus, 'not-run');
    ctx.screeningId = draft.json.data.id;

    // The patient cannot see a draft; a colleague cannot finish it.
    assert.deepEqual((await api('GET', '/me/screenings', { token: token('patient') })).json.data, []);

    const edited = await api('PATCH', `/screenings/${ctx.screeningId}`, { token: token('doctor'), body: { symptoms: { ...SYMPTOMS, coughWeeks: 6 }, vitals: VITALS, imageQuality: 'borderline', submit: true } });
    assert.equal(edited.status, 200);
    assert.equal(edited.json.data.status, 'queued');
    assert.equal(edited.json.data.symptoms.coughWeeks, 6);
    assert.equal(edited.json.data.imageQuality, 'borderline');

    const bad = await api('POST', `/screenings/${ctx.screeningId}/image`, { token: token('doctor'), form: form(Buffer.from('<html>not an image</html>')) });
    assert.equal(bad.status, 422);

    const upload = await api('POST', `/screenings/${ctx.screeningId}/image`, { token: token('doctor'), form: form(PNG) });
    assert.equal(upload.status, 200);
    assert.equal(upload.json.data.imageKey, ctx.screeningId);
    assert.equal(upload.json.data.imageMeta.width, 512);
    assert.equal(upload.json.data.imageMeta.height, 384);
    assert.equal(upload.json.data.imageMeta.mimeType, 'image/png');
    assert.equal('image_path' in upload.json.data, false);
    assert.ok([...stack.objects.keys()].some((k) => k.startsWith(`screening-images/${ID.sitiRecord}/${ctx.screeningId}/`)));

    const url = await api('GET', `/screenings/${ctx.screeningId}/image`, { token: token('doctor') });
    assert.equal(url.status, 200);
    const bytes = Buffer.from(await (await fetch(url.json.data.url)).arrayBuffer());
    assert.ok(bytes.equals(PNG), 'the signed URL serves exactly the uploaded file');

    const model = await api('POST', `/screenings/${ctx.screeningId}/analyze`, { token: token('doctor') });
    assert.equal(model.status, 503);
    assert.equal(model.json.error.code, 'MODEL_NOT_CONNECTED');
    const after = await api('GET', `/screenings/${ctx.screeningId}`, { token: token('doctor') });
    assert.equal(after.json.data.modelStatus, 'unavailable');
    assert.equal(after.json.data.analysis, null);
    assert.equal(after.json.data.status, 'queued');
  });

  test('only a reviewer with rights can sign off, and the sign-off drives the status', async () => {
    const body = { agreement: 'agrees', decision: 'refer', notes: 'Cavity suspected in the right upper zone.' };
    assert.equal((await api('POST', `/screenings/${ctx.screeningId}/review`, { token: token('chw'), body })).status, 403);
    assert.equal((await api('POST', `/screenings/${ctx.screeningId}/review`, { token: token('admin'), body })).status, 403);

    const res = await api('POST', `/screenings/${ctx.screeningId}/review`, { token: token('doctor'), body });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'reviewed');
    assert.equal(res.json.data.review.reviewerId, ID.doctor);
    assert.equal(res.json.data.review.decision, 'refer');

    const timeline = await api('GET', `/patients/${ID.sitiRecord}`, { token: token('doctor') });
    assert.ok(timeline.json.data.notes.some((n) => n.context === 'screening' && n.contextId === ctx.screeningId));
  });

  test('a referral records its history and moves the screening to referred', async () => {
    const created = await api('POST', '/referrals', {
      token: token('doctor'),
      body: { patientId: ID.sitiRecord, screeningId: ctx.screeningId, toFacilityId: ID.lembor, reason: 'Suspected cavity; needs Xpert.', requestedService: 'tcm-genexpert', priority: 'urgent', appointmentDate: null, assignedWorkerId: ID.chw, status: 'pending' },
    });
    assert.equal(created.status, 201);
    assertShape(created.json.data, 'referral', 'referral');
    assert.match(created.json.data.code, /^REF-\d{4}$/);
    assert.equal(created.json.data.fromFacilityId, ID.waerana);
    assert.equal(created.json.data.history.length, 1);
    assert.deepEqual([created.json.data.history[0].from, created.json.data.history[0].to], [null, 'pending']);
    ctx.referralId = created.json.data.id;

    const screening = await api('GET', `/screenings/${ctx.screeningId}`, { token: token('doctor') });
    assert.equal(screening.json.data.status, 'referred');
    assert.equal(screening.json.data.referralId, ctx.referralId);

    const moved = await api('PATCH', `/referrals/${ctx.referralId}/status`, { token: token('doctor'), body: { status: 'appointment-scheduled', note: 'Booked for Monday 08:00' } });
    assert.equal(moved.status, 200);
    assert.equal(moved.json.data.status, 'appointment-scheduled');
    assert.equal(moved.json.data.history.length, 2);
    assert.equal(moved.json.data.history[1].note, 'Booked for Monday 08:00');
    assert.equal(moved.json.data.history[1].actorId, ID.doctor);

    const edited = await api('PATCH', `/referrals/${ctx.referralId}`, { token: token('doctor'), body: { priority: 'soon', appointmentDate: '2026-12-01' } });
    assert.equal(edited.json.data.priority, 'soon');
    assert.equal(edited.json.data.appointmentDate, '2026-12-01');

    const worker = await api('POST', '/referrals', { token: token('doctor'), body: { patientId: ID.sitiRecord, screeningId: null, toFacilityId: ID.lembor, reason: '', requestedService: 'cxr', priority: 'routine', appointmentDate: null, assignedWorkerId: ID.sitiRecord, status: 'draft' } });
    assert.equal(worker.status, 422, 'an assignee must be a staff member');
  });

  test('follow-ups: schedule, attempt, reschedule, complete, unresolved, reassign', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const created = await api('POST', '/followups', { token: token('doctor'), body: { patientId: ID.sitiRecord, referralId: ctx.referralId, screeningId: ctx.screeningId, reason: 'referral-attendance', dueDate: today, assignedWorkerId: ID.chw } });
    assert.equal(created.status, 201);
    assertShape(created.json.data, 'followUp', 'follow-up');
    assert.equal(created.json.data.status, 'scheduled');
    const id = created.json.data.id;

    const attempt = await api('POST', `/followups/${id}/attempts`, { token: token('chw'), body: { channel: 'phone', outcome: 'no-answer', note: 'Rang four times.' } });
    assert.equal(attempt.status, 200);
    assert.equal(attempt.json.data.status, 'in-progress');
    assert.equal(attempt.json.data.attempts.length, 1);
    assert.equal(attempt.json.data.attempts[0].actorId, ID.chw);

    const moved = await api('PATCH', `/followups/${id}/schedule`, { token: token('doctor'), body: { dueDate: '2030-01-15', note: 'Patient asked for next week' } });
    assert.equal(moved.json.data.dueDate, '2030-01-15');
    assert.equal(moved.json.data.attempts.at(-1).outcome, 'rescheduled');

    const reassigned = await api('PATCH', `/followups/${id}/assignee`, { token: token('doctor'), body: { workerId: ID.doctor } });
    assert.equal(reassigned.json.data.assignedWorkerId, ID.doctor);

    const done = await api('POST', `/followups/${id}/complete`, { token: token('doctor'), body: { note: 'Attended Lembor on the booked day.' } });
    assert.equal(done.json.data.status, 'completed');
    assert.ok(done.json.data.completedAt);

    // Left open and long past due: this is what the dashboard must count as overdue.
    const overdue = await api('POST', '/followups', { token: token('doctor'), body: { patientId: ID.yosefRecord, referralId: null, screeningId: null, reason: 'symptom-recheck', dueDate: '2020-01-01', assignedWorkerId: ID.chw } });
    assert.equal(overdue.json.data.status, 'scheduled');
    const second = await api('POST', '/followups', { token: token('doctor'), body: { patientId: ID.yosefRecord, referralId: null, screeningId: null, reason: 'contact-tracing', dueDate: '2031-01-01', assignedWorkerId: ID.chw } });
    const unresolved = await api('POST', `/followups/${second.json.data.id}/unresolved`, { token: token('doctor'), body: { reason: 'Moved away, no forwarding number.' } });
    assert.equal(unresolved.json.data.status, 'unresolved');
    assert.equal(unresolved.json.data.unresolvedReason, 'Moved away, no forwarding number.');

    const list = await api('GET', '/followups?status=completed', { token: token('doctor') });
    assert.ok(list.json.data.some((f) => f.id === id));
  });

  test('screening list filters and the dashboard agree with the records', async () => {
    const list = await api('GET', '/screenings?status=referred', { token: token('doctor') });
    assert.ok(list.json.data.some((s) => s.id === ctx.screeningId));
    assert.ok(list.json.data.every((s) => s.status === 'referred'));
    assertShape(list.json.data[0], 'screening', 'listed screening');

    const dash = await api('GET', '/dashboard/summary?days=7&tz=Asia/Makassar', { token: token('doctor') });
    assert.equal(dash.status, 200);
    assertShape(dash.json.data, 'dashboard', 'dashboard');
    const all = await api('GET', '/screenings?pageSize=200', { token: token('doctor') });
    assert.equal(dash.json.data.totalScreenings, all.json.meta.total);
    assert.equal(dash.json.data.draftRecords, all.json.data.filter((s) => s.status === 'draft').length);
    assert.equal(dash.json.data.activity.length, 7);
    assert.ok(dash.json.data.pendingReferrals >= 1);
    assert.ok(dash.json.data.overdueFollowUps >= 1);
    assert.equal(dash.json.data.outcomeBreakdown.reduce((n, o) => n + o.count, 0), 0, 'no model output exists, so no outcomes are counted');
  });
});

describe('what each role is shown', { skip }, () => {
  test('the patient sees state and the clinician’s review, never the clinical fields or the image', async () => {
    const list = await api('GET', '/me/screenings', { token: token('patient') });
    assert.equal(list.status, 200);
    assert.equal(list.json.data.length, 1);
    const [item] = list.json.data;
    assert.equal(item.status, 'referred');
    assert.equal(item.review.notes, 'Cavity suspected in the right upper zone.');
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'imageKey', 'imageMeta', 'modelStatus']) assert.equal(hidden in item, false, hidden);

    const referrals = await api('GET', '/me/referrals', { token: token('patient') });
    assert.equal(referrals.json.data.length, 1);
    assert.equal(referrals.json.data[0].history.length, 2);
    const followUps = await api('GET', '/me/followups', { token: token('patient') });
    assert.ok(followUps.json.data.length >= 1);

    assert.equal((await api('GET', `/screenings/${ctx.screeningId}/image`, { token: token('patient') })).status, 403);
    assert.equal((await api('GET', `/screenings/${ctx.screeningId}`, { token: token('patient') })).status, 403);
  });

  test('the staff directory shows a patient only the staff on their own records, without contacts', async () => {
    const res = await api('GET', '/staff', { token: token('patient') });
    assert.equal(res.status, 200);
    assertShape(res.json.data[0], 'staff', 'staff');
    assert.deepEqual(res.json.data.map((s) => s.id).sort(), [ID.chw, ID.doctor].sort());
    assert.ok(res.json.data.every((s) => s.email === null && s.phone === null && s.canReview === false));

    const full = await api('GET', '/staff', { token: token('doctor') });
    assert.ok(full.json.data.length >= 3);
    assert.ok(full.json.data.find((s) => s.id === ID.doctor).canReview);
  });

  test('the administrator sees record metadata and nothing clinical', async () => {
    const list = await api('GET', '/screenings', { token: token('admin') });
    assert.equal(list.status, 200);
    const item = list.json.data.find((s) => s.id === ctx.screeningId);
    assert.ok(item);
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'review', 'imageKey', 'imageMeta']) assert.equal(hidden in item, false, hidden);

    for (const path of [`/screenings/${ctx.screeningId}/image`, '/referrals', '/followups', '/dashboard/summary']) {
      assert.equal((await api('GET', path, { token: token('admin') })).status, 403, path);
    }
    const notes = await api('GET', `/patients/${ID.sitiRecord}`, { token: token('admin') });
    assert.equal(notes.status, 200);
    assert.deepEqual(notes.json.data.notes, [], 'clinical notes are not readable by an administrator');
  });

  test('a professional at another facility sees none of it', async () => {
    const docB = '88888888-8888-4888-8888-888888888888';
    await stack.db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'docb@e2e.test', '{"full_name":"dr. Elsewhere"}')`, [docB]);
    await stack.db.query(`update profiles set role = 'professional' where id = $1`, [docB]);
    await stack.db.query(
      `insert into healthcare_professional_profiles (profile_id, clinical_role, can_review, facility_id) values ($1, 'physician', true, $2)`,
      [docB, ID.lembor],
    );
    const t = userToken(docB, 'docb@e2e.test');
    assert.deepEqual((await api('GET', '/patients', { token: t })).json.data, []);
    assert.equal((await api('GET', `/patients/${ID.sitiRecord}`, { token: t })).status, 404);
    assert.equal((await api('GET', `/screenings/${ctx.screeningId}`, { token: t })).status, 404);
    assert.equal((await api('GET', `/screenings/${ctx.screeningId}/image`, { token: t })).status, 404);
    assert.deepEqual((await api('GET', '/referrals', { token: t })).json.data, []);
    const dash = await api('GET', '/dashboard/summary', { token: t });
    assert.equal(dash.json.data.totalScreenings, 0);
    const review = await api('POST', `/screenings/${ctx.screeningId}/review`, { token: t, body: { agreement: 'agrees', decision: 'observe', notes: '' } });
    // The database refuses it (how that error reaches the client differs in this
    // harness, see the note at the top); what matters is that nothing was written.
    assert.notEqual(review.status, 201);
    const { rows } = await stack.db.query('select reviewer_id from screening_reviews where screening_id = $1', [ctx.screeningId]);
    assert.deepEqual(rows.map((r) => r.reviewer_id), [ID.doctor]);

    // pglite-socket drops the pooled connection when Postgres raises an error. Wait
    // until reads work again so the next test does not trip over the reconnect.
    // (Harness limitation only; a real Postgres keeps the connection.)
    let healthy = 0;
    for (let attempt = 0; attempt < 40 && healthy < 3; attempt += 1) {
      const probe = await api('GET', '/me/learning', { token: token('patient') });
      healthy = probe.status === 200 ? healthy + 1 : 0;
      if (healthy < 3) await new Promise((r) => setTimeout(r, 300));
    }
    assert.equal(healthy, 3, 'the REST layer recovered after the refused write');
  });

  test('learning progress is private and idempotent', async () => {
    const put = await api('PUT', '/me/learning/what-is-tb', { token: token('patient') });
    assert.deepEqual(put.json.data.read, ['what-is-tb']);
    const again = await api('PUT', '/me/learning/what-is-tb', { token: token('patient') });
    assert.deepEqual(again.json.data.read, ['what-is-tb']);
    assert.deepEqual((await api('GET', '/me/learning', { token: token('doctor') })).json.data.read, []);
    const del = await api('DELETE', '/me/learning/what-is-tb', { token: token('patient') });
    assert.deepEqual(del.json.data.read, []);
  });
});

describe('administration', { skip }, () => {
  test('the account directory carries staff records but no onboarding answers', async () => {
    const res = await api('GET', '/accounts?pageSize=100', { token: token('admin') });
    assert.equal(res.status, 200);
    assertShape(res.json.data[0], 'account', 'account');
    const doctor = res.json.data.find((a) => a.id === ID.doctor);
    assert.deepEqual(doctor.staff, { clinicalRole: 'physician', canReview: true, facilityId: ID.waerana, phone: '0812-5550-3302' });
    const siti = res.json.data.find((a) => a.id === ID.patient);
    assert.equal(siti.patientId, ID.sitiRecord);
    assert.equal(siti.onboarding.personal, null);
    assert.equal(siti.onboarding.health, null);

    const filtered = await api('GET', '/accounts?role=professional&q=hanif', { token: token('admin') });
    assert.deepEqual(filtered.json.data.map((a) => a.id), [ID.doctor]);
  });

  test('promoting a patient needs a role change and a staff record, both audited', async () => {
    const promote = await api('PATCH', `/accounts/${ctx.newId}/role`, { token: token('admin'), body: { role: 'professional' } });
    assert.equal(promote.status, 200);
    assert.equal(promote.json.data.role, 'professional');

    // Without a staff record the new professional has no facility and cannot act clinically.
    const early = await api('GET', '/referrals', { token: ctx.newToken });
    assert.equal(early.status, 403);

    const staff = await api('PUT', `/accounts/${ctx.newId}/staff-profile`, { token: token('admin'), body: { clinicalRole: 'nurse', facilityId: ID.waerana, canReview: true } });
    assert.equal(staff.status, 200);
    assert.equal(staff.json.data.staff.clinicalRole, 'nurse');
    const now = await api('GET', '/auth/me', { token: ctx.newToken });
    assert.equal(now.json.data.account.staffUserId, ctx.newId);
    assert.equal((await api('GET', '/referrals', { token: ctx.newToken })).status, 200);

    const audit = await api('GET', '/audit?action=account.role-changed', { token: token('admin') });
    assert.ok(audit.json.data.some((e) => e.subject === 'newbie@e2e.test' && /patient to professional/.test(e.detail)));
    assert.ok(audit.json.data.every((e) => e.actorId === ID.admin || e.actorId === null));
  });

  test('administrators cannot change themselves; only administrators change anyone', async () => {
    const own = await api('PATCH', `/accounts/${ID.admin}/role`, { token: token('admin'), body: { role: 'patient' } });
    assert.notEqual(own.status, 200);
    const asDoctor = await api('PATCH', `/accounts/${ctx.newId}/role`, { token: token('doctor'), body: { role: 'admin' } });
    assert.equal(asDoctor.status, 403);
    const me = await api('GET', '/auth/me', { token: ctx.newToken });
    assert.equal(me.json.data.account.role, 'professional', 'nothing changed');
  });

  test('suspension blocks the account at once, bans the auth user, and can be undone', async () => {
    const suspend = await api('PATCH', `/accounts/${ctx.newId}/status`, { token: token('admin'), body: { status: 'suspended' } });
    assert.equal(suspend.status, 200);
    assert.equal(suspend.json.data.status, 'suspended');
    // GoTrue refuses a banned user's token itself; the API turns that into 401.
    assert.notEqual(stack.bans.get(ctx.newId), 'none');
    assert.ok([401, 403].includes((await api('GET', '/auth/me', { token: ctx.newToken })).status));

    // And if the token were still accepted, the API's own status check stops it.
    const banned = stack.bans.get(ctx.newId);
    stack.bans.delete(ctx.newId);
    const blocked = await api('GET', '/auth/me', { token: ctx.newToken });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.error.code, 'ACCOUNT_SUSPENDED');
    assert.equal((await api('GET', '/patients', { token: ctx.newToken })).status, 403);
    stack.bans.set(ctx.newId, banned);

    const restore = await api('PATCH', `/accounts/${ctx.newId}/status`, { token: token('admin'), body: { status: 'active' } });
    assert.equal(restore.status, 200);
    assert.equal(stack.bans.get(ctx.newId), 'none');
    assert.equal((await api('GET', '/auth/me', { token: ctx.newToken })).status, 200);
  });

  test('facilities: created hidden, edits reset review state, publishing exposes them, deleting removes them', async () => {
    const created = await api('POST', '/facilities', { token: token('admin'), body: { name: 'Puskesmas Uji Coba', type: 'puskesmas', province: 'Nusa Tenggara Timur', region: 'Waerana', address: 'Jl. Uji 1', phone: '(0385) 555-9999', operatingHours: 'Mon–Fri', services: ['cxr', 'sputum-microscopy'], tbProgrammeContact: null } });
    assert.equal(created.status, 201);
    assertShape(created.json.data, 'facility', 'created facility');
    assert.equal(created.json.data.published, false);
    assert.equal(created.json.data.infoStatus, 'needs-review');
    assert.equal(created.json.data.coordinates, null);
    const id = created.json.data.id;

    assert.equal((await api('GET', '/facilities')).json.data.length, 14, 'the public directory is unchanged');
    assert.equal((await api('GET', '/facilities', { token: token('patient') })).json.data.length, 14);
    const adminView = await api('GET', '/facilities', { token: token('admin') });
    assert.equal(adminView.json.data.length, 15);
    assert.equal((await api('GET', '/facilities?published=false', { token: token('admin') })).json.data.length, 1);

    const shown = await api('PATCH', `/facilities/${id}/published`, { token: token('admin'), body: { published: true } });
    assert.equal(shown.json.data.published, true);
    assert.equal((await api('GET', '/facilities')).json.data.length, 15);

    await stack.db.query(`update healthcare_facilities set info_status = 'verified-sample' where id = $1`, [id]);
    const edited = await api('PATCH', `/facilities/${id}`, { token: token('admin'), body: { name: 'Puskesmas Uji Coba II', type: 'puskesmas', province: 'Nusa Tenggara Timur', region: 'Waerana', address: 'Jl. Uji 2', phone: '(0385) 555-9999', operatingHours: 'Mon–Sat', services: ['cxr'], tbProgrammeContact: 'dr. Uji' } });
    assert.equal(edited.json.data.infoStatus, 'needs-review');
    assert.equal(edited.json.data.name, 'Puskesmas Uji Coba II');
    assert.deepEqual(edited.json.data.services, ['cxr']);

    assert.equal((await api('PATCH', `/facilities/${id}/published`, { token: token('doctor'), body: { published: false } })).status, 403);
    assert.equal((await api('DELETE', `/facilities/${id}`, { token: token('admin') })).status, 204);
    assert.equal((await api('GET', '/facilities', { token: token('admin') })).json.data.length, 14);

    const audit = await api('GET', '/audit?q=Uji', { token: token('admin') });
    const actions = new Set(audit.json.data.map((e) => e.action));
    for (const a of ['facility.created', 'facility.published', 'facility.updated', 'facility.deleted']) assert.ok(actions.has(a), a);
  });

  test('the audit log is paginated, filterable, in the shape the frontend expects, and admin-only', async () => {
    const page = await api('GET', '/audit?page=1&pageSize=5', { token: token('admin') });
    assert.equal(page.status, 200);
    assert.equal(page.json.data.length, 5);
    assert.ok(page.json.meta.total > 5);
    assertShape(page.json.data[0], 'audit', 'audit entry');
    const times = page.json.data.map((e) => e.at);
    assert.deepEqual([...times].sort().reverse(), times, 'newest first');
    assert.equal((await api('GET', '/audit', { token: token('doctor') })).status, 403);

    const actions = new Set((await api('GET', '/audit?pageSize=200', { token: token('admin') })).json.data.map((e) => e.action));
    for (const a of ['screening.created', 'screening.image-attached', 'screening.image-viewed', 'screening.reviewed', 'referral.created', 'referral.status-changed', 'followup.created', 'onboarding.completed', 'consent.health-info-changed', 'patient.created']) {
      assert.ok(actions.has(a), `audit is missing ${a}`);
    }
  });
});

// The real model, when the Python service is running (see train/tb-train/tb_ai/serve.py).
const modelUrl = process.env.E2E_MODEL_URL;
describe('with the real screening model', { skip: skip || (modelUrl ? false : 'set E2E_MODEL_URL (and E2E_MODEL_KEY) to run') }, () => {
  test('an uploaded radiograph is analysed by the trained model and stored verbatim', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), '..', 'train', 'tb-train', 'tbx11k', 'imgs');
    const pick = (folder) => {
      for (const name of readdirSync(folder)) {
        const full = join(folder, name);
        if (statSync(full).isDirectory()) {
          const found = pick(full);
          if (found) return found;
        } else if (/\.(png|jpe?g)$/i.test(name)) return full;
      }
      return null;
    };
    const file = pick(dir);
    assert.ok(file, 'a dataset image is needed');
    const bytes = readFileSync(file);

    const server = await bootBackend({ inference: { url: modelUrl, key: process.env.E2E_MODEL_KEY ?? 'testkey123testkey' } });
    try {
      const make = await server.call('POST', '/screenings', { token: token('doctor'), body: { patientId: ID.yosefRecord, symptoms: SYMPTOMS, vitals: VITALS, imageQuality: 'adequate', asDraft: false } });
      const id = make.json.data.id;
      const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
      const up = await server.call('POST', `/screenings/${id}/image`, { token: token('doctor'), form: form(bytes, type) });
      assert.equal(up.status, 200);

      const run = await server.call('POST', `/screenings/${id}/analyze`, { token: token('doctor') });
      assert.equal(run.status, 200, JSON.stringify(run.json));
      const { analysis } = run.json.data;
      assert.equal(analysis.simulated, false);
      assert.ok(['Healthy', 'Sick-non-TB', 'TB'].includes(analysis.predictedLabel));
      const sum = Object.values(analysis.probabilities).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 0.01, 'class probabilities sum to 1');
      assert.equal(analysis.model.name, 'tb_cls.pt');
      assert.equal(analysis.model.validation, null);
      assert.equal(run.json.data.modelStatus, 'completed');
      assert.equal(run.json.data.status, 'awaiting-review', 'a real result moves the record to review');
      assert.doesNotMatch(JSON.stringify(analysis), /[A-Za-z]:\\|\/Users\//);

      const again = await server.call('POST', `/screenings/${id}/analyze`, { token: token('doctor') });
      assert.equal(again.status, 409, 'results are not silently recomputed');
    } finally {
      await server.close();
    }
  });
});

describe('the remaining endpoints', { skip }, () => {
  test('health needs no sign-in and says whether a model is connected', async () => {
    const res = await api('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.data.status, 'ok');
    assert.equal(typeof res.json.data.modelConnected, 'boolean');
  });

  test('logout acknowledges a signed-in caller and refuses an anonymous one', async () => {
    assert.equal((await api('POST', '/auth/logout')).status, 401);
    const res = await api('POST', '/auth/logout', { token: token('patient') });
    assert.ok([200, 204].includes(res.status), `status ${res.status}`);
  });

  test('an administrator reads one account', async () => {
    const res = await api('GET', `/accounts/${ID.doctor}`, { token: token('admin') });
    assert.equal(res.status, 200);
    assertShape(res.json.data, 'account', 'account');
    assert.equal(res.json.data.email, 'doctor@parupintas.test');
    assert.equal((await api('GET', `/accounts/${ID.doctor}`, { token: token('doctor') })).status, 403);
  });

  test('a referral and a follow-up can be opened by id', async () => {
    const referral = (await api('GET', '/referrals', { token: token('doctor') })).json.data[0];
    const one = await api('GET', `/referrals/${referral.id}`, { token: token('doctor') });
    assert.equal(one.status, 200);
    assertShape(one.json.data, 'referral', 'referral');
    assert.equal(one.json.data.id, referral.id);

    const followUp = (await api('GET', '/followups', { token: token('doctor') })).json.data[0];
    const two = await api('GET', `/followups/${followUp.id}`, { token: token('doctor') });
    assert.equal(two.status, 200);
    assertShape(two.json.data, 'followUp', 'follow-up');
    assert.equal(two.json.data.id, followUp.id);
  });

  test('a patient opens one of their own screenings and sees no clinical fields', async () => {
    const mine = (await api('GET', '/me/screenings', { token: token('patient') })).json.data;
    assert.ok(mine.length >= 1);
    const res = await api('GET', `/me/screenings/${mine[0].id}`, { token: token('patient') });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.id, mine[0].id);
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'imageKey']) assert.equal(hidden in res.json.data, false, hidden);
  });

  test('a professional edits a patient record', async () => {
    const res = await api('PATCH', `/patients/${ctx.walkInId}`, { token: token('doctor'), body: { phone: '0813-777-8888', householdContacts: 4 } });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.phone, '0813-777-8888');
    assert.equal(res.json.data.householdContacts, 4);
    assert.equal((await api('PATCH', `/patients/${ctx.walkInId}`, { token: token('patient'), body: { phone: '0' } })).status, 403);
  });

  test('a draft screening can be deleted by its operator', async () => {
    const draft = await api('POST', '/screenings', { token: token('doctor'), body: { patientId: ctx.walkInId, symptoms: SYMPTOMS, vitals: VITALS, imageQuality: 'adequate', asDraft: true } });
    assert.equal(draft.status, 201);
    const gone = await api('DELETE', `/screenings/${draft.json.data.id}`, { token: token('doctor') });
    assert.ok([200, 204].includes(gone.status), `status ${gone.status}`);
    assert.equal((await api('GET', `/screenings/${draft.json.data.id}`, { token: token('doctor') })).status, 404);
  });

  test('a patient reopens a finished onboarding and completes it again', async () => {
    const reopened = await api('POST', '/me/onboarding/reopen', { token: token('patient'), body: { step: 1 } });
    assert.equal(reopened.status, 200);
    assert.equal(reopened.json.data.onboarding.completedAt, null);
    const again = await api('POST', '/me/onboarding/complete', { token: token('patient'), body: { dataUse: true, healthInfo: true } });
    assert.equal(again.status, 200);
    assert.ok(again.json.data.onboarding.completedAt);
  });

  test('an administrator removes a staff record, and the person loses clinical access', async () => {
    const res = await api('DELETE', `/accounts/${ctx.newId}/staff-profile`, { token: token('admin') });
    assert.ok([200, 204].includes(res.status), `status ${res.status}`);
    assert.equal((await api('GET', '/referrals', { token: ctx.newToken })).status, 403);
  });
});

// Every endpoint the router registers must have answered a request successfully
// somewhere in this file. A route added without a test fails here.
describe('endpoint coverage', { skip }, () => {
  test('every registered endpoint was exercised', () => {
    // Analysis needs a running model; without one the route is covered by its
    // 503 MODEL_NOT_CONNECTED answer in the screening test instead.
    const exempt = modelUrl ? [] : ['POST /screenings/:id/analyze'];
    const missing = recorder.missing().filter((route) => !exempt.includes(route));
    assert.deepEqual(missing, [], 'endpoints with no successful request in the e2e tests');
    assert.deepEqual(recorder.unmatched(), [], 'requests that match no registered route (only 404 probes belong here)');
  });
});
