/**
 * In-process Postgres for testing the migrations and Row Level Security.
 *
 * PGlite is a real Postgres compiled to WASM, so the SQL under
 * supabase/migrations runs unchanged. What it lacks is Supabase itself, so a
 * small prelude stubs the pieces the migrations lean on: the `auth` schema
 * (users table and auth.uid()), the `storage.buckets` table and the three API
 * roles. Everything else is the migration files as shipped.
 *
 * This verifies the policies and triggers. It does not verify PostgREST,
 * GoTrue or Storage, which only a real Supabase project can.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'supabase', 'migrations');

const PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid
    language sql stable
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
`;

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(PRELUDE);

  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (error) {
      error.message = `Migration ${file} failed: ${error.message}`;
      throw error;
    }
  }
  return db;
}

/** Create an auth user the way GoTrue does; the profile trigger does the rest. */
export async function createUser(db, { email, fullName = '', metadata = {} }) {
  const meta = { full_name: fullName, ...metadata };
  const result = await db.query(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [email, JSON.stringify(meta)],
  );
  return result.rows[0].id;
}

/**
 * Run a callback as a given user: role `authenticated`, JWT subject set, and
 * RLS in force. Pass `null` to run as `anon`. Always restores the superuser
 * afterwards so one failing statement cannot leak a role into the next test.
 */
export async function asUser(db, userId, fn) {
  const role = userId ? 'authenticated' : 'anon';
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  const client = {
    query: (sql, params) => db.query(sql, params),
    rows: async (sql, params) => (await db.query(sql, params)).rows,
  };
  try {
    return await fn(client);
  } finally {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Expect a statement to be rejected by Postgres; returns the error. */
export async function expectDenied(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the statement to be rejected, but it succeeded');
}
