/**
 * A stand-in for the Supabase gateway, so the real Express app (middleware,
 * validation, routing, authorisation, error handling) can be exercised
 * without a network or a database.
 *
 * It records every query as a plain object, which lets tests assert both what
 * the API answered and what it did (or, more importantly, did NOT do) on the
 * way. Row Level Security is not simulated here; that is what rls.test.js
 * covers against the real migrations.
 */

import { loadConfig } from '../../src/config/env.js';

export const TEST_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon-key-for-tests-0000000000',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key-for-tests-000000000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

export const testConfig = (overrides = {}) => loadConfig({ ...TEST_ENV, ...overrides });

/** Distinct, valid v4 UUIDs. */
export const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const USERS = {
  patient: {
    token: 'tok-patient',
    profile: { id: uid(1), email: 'patient@t.test', full_name: 'Siti', role: 'patient', status: 'active' },
    patient: { id: uid(101) },
  },
  doctor: {
    token: 'tok-doctor',
    profile: { id: uid(2), email: 'doctor@t.test', full_name: 'dr. Hanif', role: 'professional', status: 'active' },
    staff: { clinical_role: 'physician', can_review: true, facility_id: uid(201), phone: null },
  },
  chw: {
    token: 'tok-chw',
    profile: { id: uid(3), email: 'chw@t.test', full_name: 'Ayu', role: 'professional', status: 'active' },
    staff: { clinical_role: 'chw', can_review: false, facility_id: uid(201), phone: null },
  },
  admin: {
    token: 'tok-admin',
    profile: { id: uid(4), email: 'admin@t.test', full_name: 'Rina', role: 'admin', status: 'active' },
    // An admin whose staff row claims can_review must still not review.
    staff: { clinical_role: 'coordinator', can_review: true, facility_id: uid(201), phone: null },
  },
  unstaffed: {
    token: 'tok-unstaffed',
    profile: { id: uid(5), email: 'new@t.test', full_name: 'New Pro', role: 'professional', status: 'active' },
    staff: null,
  },
  suspended: {
    token: 'tok-suspended',
    profile: { id: uid(6), email: 'gone@t.test', full_name: 'Gone', role: 'patient', status: 'suspended' },
    patient: null,
  },
};

/**
 * @param {object} options
 * @param {(call: object) => any} [options.onQuery] return rows (array), `{ error }`,
 *        or `{ data, count }`; undefined means "no rows".
 * @param {(name: string, args: object, call: object) => any} [options.onRpc]
 */
export function createFakeGateway({ onQuery = () => undefined, onRpc = () => undefined } = {}) {
  const calls = [];
  const storageCalls = [];
  const authAdminCalls = [];
  const tokens = new Map(Object.values(USERS).map((entry) => [entry.token, entry]));
  const byProfileId = (id) => Object.values(USERS).find((entry) => entry.profile.id === id);

  function run(call) {
    calls.push(call);

    // Session bootstrap used by loadSession().
    if (call.table === 'profiles' && call.op === 'select' && call.filters.some((f) => f[0] === 'eq' && f[1] === 'id')) {
      const entry = byProfileId(call.filters.find((f) => f[1] === 'id')[2]);
      if (entry) return [entry.profile];
    }
    if (call.table === 'healthcare_professional_profiles' && call.op === 'select' && call.filters.some((f) => f[1] === 'profile_id')) {
      const entry = byProfileId(call.filters.find((f) => f[1] === 'profile_id')[2]);
      return entry?.staff ? [entry.staff] : [];
    }
    if (
      call.table === 'patient_profiles' &&
      call.op === 'select' &&
      call.columns === 'id' &&
      call.filters.some((f) => f[1] === 'profile_id' && f[0] === 'eq')
    ) {
      const entry = byProfileId(call.filters.find((f) => f[1] === 'profile_id')[2]);
      return entry?.patient ? [entry.patient] : [];
    }
    return onQuery(call);
  }

  function shape(call, raw) {
    if (raw && raw.error) return { data: null, error: raw.error, count: null };
    const wrapped = raw && !Array.isArray(raw) && typeof raw === 'object' && 'data' in raw;
    let rows = wrapped ? raw.data : raw;
    const count = wrapped && 'count' in raw ? raw.count : null;
    rows = rows === undefined ? [] : rows;
    if (call.single === 'single') {
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row
        ? { data: row, error: null, count }
        : { data: null, error: { code: 'PGRST116', message: 'no rows' }, count };
    }
    if (call.single === 'maybe') {
      return { data: (Array.isArray(rows) ? rows[0] : rows) ?? null, error: null, count };
    }
    return { data: Array.isArray(rows) ? rows : [rows], error: null, count };
  }

  function builder(label, table) {
    const call = { client: label, table, op: 'select', columns: null, filters: [], payload: null, single: null };
    const api = {
      select(columns = '*', options) {
        if (call.op === 'select') call.columns = columns;
        else call.returning = columns;
        call.options = options;
        return api;
      },
      insert(payload) { call.op = 'insert'; call.payload = payload; return api; },
      update(payload) { call.op = 'update'; call.payload = payload; return api; },
      upsert(payload, options) { call.op = 'upsert'; call.payload = payload; call.options = options; return api; },
      delete() { call.op = 'delete'; return api; },
      eq(column, value) { call.filters.push(['eq', column, value]); return api; },
      in(column, value) { call.filters.push(['in', column, value]); return api; },
      or(expression) { call.filters.push(['or', expression]); return api; },
      contains(column, value) { call.filters.push(['contains', column, value]); return api; },
      order(column, options) { call.order = [column, options]; return api; },
      range(from, to) { call.range = [from, to]; return api; },
      limit() { return api; },
      single() { call.single = 'single'; return api; },
      maybeSingle() { call.single = 'maybe'; return api; },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => shape(call, run({ ...call, filters: [...call.filters] })))
          .then(resolve, reject);
      },
    };
    return api;
  }

  function client(label) {
    return {
      label,
      from: (table) => builder(label, table),
      rpc(name, args) {
        const call = { client: label, rpc: name, args };
        calls.push(call);
        return Promise.resolve(shape({ single: null }, onRpc(name, args, call)));
      },
      auth: {
        getUser: async (token) => {
          const entry = tokens.get(token);
          return entry
            ? { data: { user: { id: entry.profile.id, email: entry.profile.email } }, error: null }
            : { data: { user: null }, error: { message: 'invalid JWT' } };
        },
        admin: {
          signOut: async () => ({ error: null }),
          updateUserById: async (id, attributes) => {
            authAdminCalls.push({ id, attributes });
            return { error: null };
          },
        },
      },
      storage: {
        from: (bucket) => ({
          upload: async (path, body, options) => {
            storageCalls.push({ op: 'upload', bucket, path, size: body?.length, options });
            return { data: { path }, error: null };
          },
          remove: async (paths) => {
            storageCalls.push({ op: 'remove', bucket, paths });
            return { data: [], error: null };
          },
          download: async (path) => {
            storageCalls.push({ op: 'download', bucket, path });
            return { data: new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])]), error: null };
          },
          createSignedUrl: async (path, ttl) => {
            storageCalls.push({ op: 'sign', bucket, path, ttl });
            return { data: { signedUrl: `http://storage.test/${path}?token=abc` }, error: null };
          },
        }),
      },
    };
  }

  const gateway = {
    anon: client('anon'),
    admin: client('admin'),
    forUser: () => client('user'),
  };
  return { gateway, calls, storageCalls, authAdminCalls };
}

/** Real HTTP calls against the app on an ephemeral port. */
export async function startServer(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function call(method, path, { token, body, headers = {}, form } = {}) {
    const init = { method, headers: { ...headers } };
    if (token) init.headers.Authorization = `Bearer ${token}`;
    if (form) init.body = form;
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const response = await fetch(`${base}${path}`, init);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, headers: response.headers };
  }

  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}
