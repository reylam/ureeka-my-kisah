/**
 * A local stand-in for a Supabase project, good enough to run the real backend
 * and the real supabase-js client end to end:
 *
 *   Postgres      PGlite with the shipped migrations + seed.sql, exposed over the
 *                 Postgres wire protocol (pglite-socket)
 *   PostgREST     the real PostgREST 16 binary, so embedded selects, filters,
 *                 RPC, upserts and column grants behave as they do on Supabase
 *   gateway       one HTTP port that routes /rest/v1 to PostgREST and answers
 *                 the few /auth/v1 and /storage/v1 calls the backend makes
 *
 * What is faked, and therefore NOT proven by this stack: GoTrue (sign-up,
 * password hashing, token issuing; here tokens are minted directly with the
 * same HS256 secret PostgREST trusts) and Storage (an in-memory object map that
 * accepts only the service role, mirroring the bucket having no client policy).
 *
 * The PostgREST binary is not part of the repo: `npm run e2e:setup` downloads
 * it into backend/.tools/. Tests skip themselves when it is absent.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createDatabase } from '../helpers/db.js';

const here = dirname(fileURLToPath(import.meta.url));
export const POSTGREST_BIN = join(here, '..', '..', '.tools', 'postgrest', process.platform === 'win32' ? 'postgrest.exe' : 'postgrest');
export const stackAvailable = existsSync(POSTGREST_BIN);

export const JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-0123456789';

const b64url = (input) => Buffer.from(input).toString('base64url');

export function signJwt(claims, { expiresInSeconds = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now, exp: now + expiresInSeconds, ...claims }));
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyJwt(token) {
  const [header, payload, signature] = String(token).split('.');
  if (!header || !payload || !signature) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  if (expected !== signature) return null;
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return claims.exp && claims.exp < Date.now() / 1000 ? null : claims;
}

// Fixed issue/expiry times so the keys are the same on every run and can be
// pasted into .env files once.
const KEY_TIMES = { iat: 1_700_000_000, exp: 4_102_444_800, iss: 'supabase-local-stack' };
export const ANON_KEY = signJwt({ role: 'anon', ...KEY_TIMES });
export const SERVICE_KEY = signJwt({ role: 'service_role', ...KEY_TIMES });

/** What GoTrue would put in a signed-in user's access token. */
export const userToken = (id, email) =>
  signJwt({ sub: id, email, role: 'authenticated', aud: 'authenticated' });

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

const json = (response, status, body) => {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  response.end(text);
};

const SEED_PASSWORDS = {
  'admin@parupintas.test': 'Admin123!',
  'radiolog@parupintas.test': 'Radiolog123!',
  'radiolog2@parupintas.test': 'Radiolog123!',
};

/**
 * seed: true loads the base seed (what the tests expect), 'full' also loads the
 * sample visits (what `npm run dev:local` uses), false loads nothing.
 */
export async function startStack({ seed = true, gatewayPort = 0 } = {}) {
  // 1. Postgres
  const db = await createDatabase();
  if (seed) {
    const { baseSeedSql, fullSeedSql } = await import('../helpers/seed.js');
    await db.exec(seed === 'full' ? fullSeedSql() : baseSeedSql());
  }
  const pgPort = 54000 + Math.floor(Math.random() * 900);
  const pg = new PGLiteSocketServer({ db, port: pgPort, host: '127.0.0.1', maxConnections: 5 });
  await pg.start();

  // 2. PostgREST
  const restPort = pgPort + 1000;
  const rest = spawn(POSTGREST_BIN, [], {
    env: {
      ...process.env,
      PGRST_DB_URI: `postgres://postgres@127.0.0.1:${pgPort}/postgres?sslmode=disable`,
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_DB_POOL: '1',
      PGRST_DB_CHANNEL_ENABLED: 'false',
      PGRST_DB_CONFIG: 'false',
      PGRST_DB_PREPARED_STATEMENTS: 'false',
      PGRST_DB_MAX_ROWS: '1000',
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(restPort),
      PGRST_LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let restLog = '';
  rest.stdout.on('data', (d) => (restLog += d));
  rest.stderr.on('data', (d) => (restLog += d));

  const deadline = Date.now() + 40_000;
  for (;;) {
    try {
      const probe = await fetch(`http://127.0.0.1:${restPort}/`, { headers: { apikey: ANON_KEY } });
      if (probe.status < 500) break;
    } catch {
      // not up yet
    }
    if (rest.exitCode !== null) throw new Error(`PostgREST exited early:\n${restLog}`);
    if (Date.now() > deadline) throw new Error(`PostgREST did not start:\n${restLog}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Gateway: /rest/v1 -> PostgREST, /auth/v1 + /storage/v1 -> the fakes below
  const objects = new Map(); // "bucket/path" -> { bytes, contentType }
  const signed = new Map(); // token -> "bucket/path"
  const bans = new Map(); // user id -> ban_duration
  const log = []; // gateway-level events tests may assert on

  // GoTrue stand-in state (sign-in, sign-up and refresh), for browser testing.
  const passwords = new Map(Object.entries(SEED_PASSWORDS));
  const refreshTokens = new Map(); // refresh token -> { id, email }

  async function findUser(email) {
    const { rows } = await db.query(
      'select id, email, raw_user_meta_data, created_at from auth.users where lower(email) = lower($1)',
      [email],
    );
    return rows[0] ?? null;
  }
  function sessionFor(user) {
    const accessToken = userToken(user.id, user.email);
    const refresh = randomUUID();
    refreshTokens.set(refresh, { id: user.id, email: user.email });
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: refresh,
      user: {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: user.email,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: user.raw_user_meta_data ?? {},
        created_at: new Date().toISOString(),
      },
    };
  }

  const gateway = createServer(async (request, response) => {
    // The browser app calls this origin directly, so it needs CORS.
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'authorization, apikey, content-type, x-client-info, x-supabase-api-version, prefer, accept, accept-profile, content-profile, range, range-unit',
    );
    response.setHeader('Access-Control-Expose-Headers', 'content-range, content-location');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      return response.end();
    }
    try {
      const url = new URL(request.url, 'http://gateway');
      const path = url.pathname;
      const auth = request.headers.authorization?.replace(/^Bearer\s+/i, '');
      const claims = auth ? verifyJwt(auth) : null;

      if (path === '/auth/v1/token' && request.method === 'POST') {
        const grant = url.searchParams.get('grant_type');
        const body = JSON.parse((await readBody(request)).toString() || '{}');
        if (grant === 'password') {
          const user = await findUser(body.email ?? '');
          const ok = user && passwords.get(user.email.toLowerCase()) === body.password;
          if (!ok) {
            return json(response, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          }
          const ban = bans.get(user.id);
          if (ban && ban !== 'none') {
            return json(response, 400, { code: 400, error_code: 'user_banned', msg: 'User is banned' });
          }
          return json(response, 200, sessionFor(user));
        }
        if (grant === 'refresh_token') {
          const held = refreshTokens.get(body.refresh_token);
          if (!held) return json(response, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
          refreshTokens.delete(body.refresh_token);
          return json(response, 200, sessionFor(held));
        }
        return json(response, 400, { code: 400, error_code: 'validation_failed', msg: 'unsupported grant' });
      }
      if (path === '/auth/v1/signup' && request.method === 'POST') {
        const body = JSON.parse((await readBody(request)).toString() || '{}');
        if (!body.email || !body.password) return json(response, 422, { code: 422, error_code: 'validation_failed', msg: 'email and password required' });
        if (String(body.password).length < 8) return json(response, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters.' });
        if (await findUser(body.email)) return json(response, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const id = randomUUID();
        await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
          id, body.email.toLowerCase(), JSON.stringify(body.data ?? {}),
        ]);
        passwords.set(body.email.toLowerCase(), body.password);
        return json(response, 200, sessionFor({ id, email: body.email.toLowerCase(), raw_user_meta_data: body.data ?? {} }));
      }

      if (path.startsWith('/rest/v1')) {
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await readBody(request);
        const forward = () =>
          fetch(`http://127.0.0.1:${restPort}${path.slice('/rest/v1'.length) || '/'}${url.search}`, {
            method: request.method,
            headers: Object.fromEntries(
              Object.entries(request.headers).filter(([k]) => !['host', 'connection', 'content-length'].includes(k)),
            ),
            body,
          });
        let upstream = await forward();
        // pglite-socket sometimes drops the single pooled connection; PostgREST then
        // answers 503 PGRST001 while it reconnects. Reads are safe to repeat, writes are not.
        for (let attempt = 0; attempt < 3 && upstream.status === 503 && ['GET', 'HEAD'].includes(request.method); attempt += 1) {
          await new Promise((r) => setTimeout(r, 250));
          upstream = await forward();
        }
        const buffer = Buffer.from(await upstream.arrayBuffer());
        const headers = Object.fromEntries(upstream.headers.entries());
        delete headers['content-encoding'];
        delete headers['transfer-encoding'];
        headers['content-length'] = String(buffer.length);
        response.writeHead(upstream.status, headers);
        response.end(buffer);
        return;
      }

      if (path === '/auth/v1/user' && request.method === 'GET') {
        if (!claims?.sub) return json(response, 401, { msg: 'invalid JWT' });
        if (bans.get(claims.sub) && bans.get(claims.sub) !== 'none') return json(response, 403, { msg: 'banned' });
        return json(response, 200, { id: claims.sub, email: claims.email, aud: 'authenticated', role: 'authenticated' });
      }
      const adminUser = path.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
      if (adminUser && request.method === 'PUT') {
        if (claims?.role !== 'service_role') return json(response, 403, { msg: 'not allowed' });
        const attrs = JSON.parse((await readBody(request)).toString() || '{}');
        bans.set(adminUser[1], attrs.ban_duration ?? 'none');
        log.push({ type: 'auth.admin.update', id: adminUser[1], attrs });
        return json(response, 200, { id: adminUser[1] });
      }
      if (path === '/auth/v1/logout' && request.method === 'POST') {
        log.push({ type: 'auth.logout' });
        response.writeHead(204);
        return response.end();
      }

      // Storage: client roles have no policy, so only the service role gets in.
      const sign = path.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
      if (sign && request.method === 'POST') {
        if (claims?.role !== 'service_role') return json(response, 403, { message: 'forbidden' });
        const key = `${sign[1]}/${decodeURIComponent(sign[2])}`;
        if (!objects.has(key)) return json(response, 404, { message: 'Object not found' });
        const body = JSON.parse((await readBody(request)).toString() || '{}');
        const token = randomUUID();
        signed.set(token, { key, expires: Date.now() + (body.expiresIn ?? 60) * 1000 });
        return json(response, 200, { signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=${token}` });
      }
      if (sign && request.method === 'GET') {
        const entry = signed.get(url.searchParams.get('token'));
        if (!entry || entry.expires < Date.now()) return json(response, 400, { message: 'invalid or expired token' });
        const object = objects.get(entry.key);
        response.writeHead(200, { 'Content-Type': object.contentType });
        return response.end(object.bytes);
      }
      const object = path.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
      if (object && ['POST', 'PUT', 'GET'].includes(request.method)) {
        if (claims?.role !== 'service_role') return json(response, 403, { message: 'forbidden' });
        const key = `${object[1]}/${decodeURIComponent(object[2])}`;
        if (request.method === 'GET') {
          const found = objects.get(key);
          if (!found) return json(response, 404, { message: 'Object not found' });
          response.writeHead(200, { 'Content-Type': found.contentType });
          return response.end(found.bytes);
        }
        const raw = await readBody(request);
        const contentType = request.headers['content-type'] ?? 'application/octet-stream';
        let bytes = raw;
        let type = contentType;
        if (contentType.startsWith('multipart/form-data')) {
          const form = await new Response(raw, { headers: { 'content-type': contentType } }).formData();
          const file = [...form.values()].find((v) => typeof v !== 'string');
          bytes = Buffer.from(await file.arrayBuffer());
          type = file.type || 'application/octet-stream';
        }
        objects.set(key, { bytes, contentType: type });
        return json(response, 200, { Key: key, Id: randomUUID() });
      }
      const removal = path.match(/^\/storage\/v1\/object\/([^/]+)$/);
      if (removal && request.method === 'DELETE') {
        if (claims?.role !== 'service_role') return json(response, 403, { message: 'forbidden' });
        const { prefixes } = JSON.parse((await readBody(request)).toString());
        for (const p of prefixes) objects.delete(`${removal[1]}/${p}`);
        return json(response, 200, prefixes.map((name) => ({ name })));
      }

      json(response, 404, { message: `unhandled ${request.method} ${path}` });
    } catch (error) {
      json(response, 500, { message: String(error?.message ?? error) });
    }
  });
  await new Promise((resolve) => gateway.listen(gatewayPort, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${gateway.address().port}`;

  return {
    db,
    url,
    objects,
    restLog: () => restLog,
    bans,
    log,
    async stop() {
      gateway.close();
      rest.kill();
      await pg.stop().catch(() => {});
      await db.close().catch(() => {});
    },
  };
}

/** Read a file next to the repo root, for fixtures. */
export const readRepoFile = (...parts) => readFileSync(join(here, '..', '..', '..', ...parts));
