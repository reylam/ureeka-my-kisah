/**
 * Create a staff account, or give an existing one its role.
 *
 * Patients have no account, and an account created any other way has no role
 * and reaches nothing. Staff roles come from here, using the service-role key
 * from backend/.env. Run it from a trusted machine.
 *
 *   npm run provision -- --email admin@example.org --name "Rina Hartati" --role admin
 *   npm run provision -- --email rad@example.org --name "dr. Hanif, Sp.Rad" --role radiologist
 *
 * If the e-mail already has an account it gets the role; otherwise one is
 * created with a random password that is printed once. Pass --password to set
 * your own.
 */

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    password: { type: 'string' },
  },
});

const ROLES = ['admin', 'radiologist'];

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('--email is required and must be an address');
if (!ROLES.includes(values.role)) fail(`--role must be one of: ${ROLES.join(', ')}`);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (backend/.env)');

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findProfile() {
  const { data, error } = await admin.from('profiles').select('id,role').ilike('email', email).maybeSingle();
  if (error) fail(error.message);
  return data;
}

let profile = await findProfile();
let generatedPassword = null;

if (!profile) {
  generatedPassword = values.password ?? randomBytes(12).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { full_name: values.name ?? '' },
  });
  if (error) fail(`could not create the auth user: ${error.message}`);
  profile = { id: data.user.id, role: null };
  console.log(`created auth user ${profile.id}`);
}

{
  const { error } = await admin.from('profiles').update({ role: values.role, status: 'active' }).eq('id', profile.id);
  if (error) fail(error.message);
}

console.log(`${email} is now ${values.role}.`);
if (generatedPassword && !values.password) {
  console.log(`temporary password (shown once, change it after first sign-in): ${generatedPassword}`);
}
