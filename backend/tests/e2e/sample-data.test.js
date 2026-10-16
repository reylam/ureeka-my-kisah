/**
 * The sample records in supabase/seed.sql, read back through the real API
 * (Express -> supabase-js -> PostgREST -> the migrations): the data must come
 * out in the shape the frontend expects, scoped to each role, and without any
 * model output. flows.test.js uses the base seed only; this one loads it all.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { startServer } from '../helpers/fakeGateway.js';
import { ANON_KEY, SERVICE_KEY, stackAvailable, startStack, userToken } from './stack.js';

const skip = stackAvailable ? false : 'PostgREST binary not found (run `npm run e2e:setup`)';

const WHO = {
  siti: ['a0000000-0000-4000-8000-000000000001', 'patient@parupintas.test'],
  doctor: ['a0000000-0000-4000-8000-000000000002', 'doctor@parupintas.test'],
  chw: ['a0000000-0000-4000-8000-000000000003', 'chw@parupintas.test'],
  admin: ['a0000000-0000-4000-8000-000000000004', 'admin@parupintas.test'],
  nurse: ['a0000000-0000-4000-8000-000000000005', 'nurse@parupintas.test'],
  dewi: ['a0000000-0000-4000-8000-000000000006', 'patient2@parupintas.test'],
  bernadus: ['a0000000-0000-4000-8000-000000000007', 'newpatient@parupintas.test'],
};
const token = (who) => userToken(...WHO[who]);

let stack;
let api;
let closeApi;

before(async () => {
  if (skip) return;
  stack = await startStack({ seed: 'full' });
  const config = loadConfig({
    NODE_ENV: 'test',
    SUPABASE_URL: stack.url,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    FRONTEND_ORIGIN: 'http://localhost:5173',
  });
  const server = await startServer(createApp({ config, logger: { error() {}, info() {}, warn() {} } }));
  api = server.call;
  closeApi = server.close;
});
after(async () => {
  await closeApi?.();
  await stack?.stop();
});

const get = async (path, who) => {
  const res = await api('GET', path, { token: token(who) });
  assert.equal(res.status, 200, `${who} GET ${path}`);
  return res.json;
};

describe('sample records through the API', { skip }, () => {
  test('the professional at Waerana sees the screenings, with no model output anywhere', async () => {
    const { data } = await get('/screenings?pageSize=100', 'doctor');
    assert.equal(data.length, 5);
    assert.deepEqual(data.map((s) => s.status).sort(), ['closed', 'draft', 'queued', 'referred', 'reviewed']);
    for (const screening of data) {
      assert.equal(screening.analysis, null);
      assert.equal(screening.modelStatus, 'not-run');
      assert.equal(screening.imageKey, null);
    }
    const reviewed = data.filter((s) => s.review);
    assert.equal(reviewed.length, 3);
    assert.ok(reviewed.every((s) => /^Sample review\./.test(s.review.notes)));
    assert.ok(reviewed.every((s) => s.review.reviewerId === WHO.doctor[0]));
  });

  test('referrals and follow-ups come with their history and attempts', async () => {
    const referrals = (await get('/referrals?pageSize=100', 'doctor')).data;
    assert.equal(referrals.length, 3);
    assert.ok(referrals.every((r) => r.history.length >= 1));
    assert.deepEqual(referrals.map((r) => r.status).sort(), ['appointment-scheduled', 'attended', 'pending']);
    const attended = referrals.find((r) => r.status === 'attended');
    assert.deepEqual(attended.history.map((h) => h.to), ['pending', 'appointment-scheduled', 'attended']);

    const followUps = (await get('/followups?pageSize=100', 'doctor')).data;
    assert.equal(followUps.length, 4, 'the fifth follow-up belongs to the other facility');
    assert.deepEqual([...new Set(followUps.map((f) => f.status))].sort(), ['completed', 'in-progress', 'scheduled', 'unresolved']);
    assert.ok(followUps.some((f) => f.attempts.length === 2));
  });

  test('the dashboard counts the sample records and nothing from the model', async () => {
    const { data } = await get('/dashboard/summary', 'doctor');
    assert.equal(data.totalScreenings, 5);
    assert.ok(data.pendingReferrals >= 1);
    assert.ok(data.overdueFollowUps >= 1);
    assert.equal(data.outcomeBreakdown.reduce((n, o) => n + o.count, 0), 0, 'no model output, so no outcomes');
  });

  test('the nurse at the other facility sees her own patient and nothing from Waerana', async () => {
    const patients = (await get('/patients', 'nurse')).data;
    assert.deepEqual(patients.map((p) => p.name), ['Dewi Anggraeni']);
    assert.equal((await get('/screenings', 'nurse')).data.length, 1);
    assert.equal((await get('/referrals', 'nurse')).data.length, 0);
    assert.equal((await get('/followups', 'nurse')).data.length, 1);
  });

  test('patients read their own state; the review is theirs to see, the clinical fields are not', async () => {
    const mine = (await get('/me/screenings', 'siti')).data;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].status, 'referred');
    assert.ok(mine[0].review);
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'imageKey']) assert.equal(hidden in mine[0], false, hidden);
    assert.equal((await get('/me/referrals', 'siti')).data.length, 1);

    assert.deepEqual((await get('/me/learning', 'siti')).data.read.sort(), ['symptoms', 'what-is-tb']);
    assert.deepEqual((await get('/me/learning', 'dewi')).data.read.sort(), ['prevention', 'symptoms', 'what-is-tb']);
  });

  test('the patient who stopped mid-onboarding has an account but no clinical record', async () => {
    const me = (await get('/auth/me', 'bernadus')).data.account;
    assert.equal(me.role, 'patient');
    assert.equal(me.patientId, null);
    assert.equal(me.onboarding.completedAt ?? null, null);
    assert.equal((await get('/me/patient', 'bernadus')).data, null);
  });

  test('the administrator sees seven accounts, record metadata and a populated audit log', async () => {
    const accounts = (await get('/accounts?pageSize=100', 'admin')).data;
    assert.equal(accounts.length, 7);
    const screenings = (await get('/screenings?pageSize=100', 'admin')).data;
    assert.equal(screenings.length, 6);
    for (const hidden of ['symptoms', 'vitals', 'analysis', 'review', 'imageKey']) {
      assert.ok(screenings.every((s) => !(hidden in s)), hidden);
    }
    const audit = await get('/audit?pageSize=100', 'admin');
    assert.ok(audit.data.length >= 20, `only ${audit.data.length} audit entries`);
    const actions = new Set(audit.data.map((e) => e.action));
    for (const expected of ['account.created', 'account.role-changed', 'screening.reviewed', 'referral.created', 'followup.created']) {
      assert.ok(actions.has(expected), expected);
    }
  });
});
