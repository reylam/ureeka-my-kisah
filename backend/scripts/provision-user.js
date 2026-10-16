/**
 * Create or promote a privileged account (health professional or administrator).
 *
 * Self-registration can only ever produce a patient, by design. Privileged
 * roles come from here (or from an existing administrator in the app), using
 * the service-role key from backend/.env. Run it from a trusted machine.
 *
 *   npm run provision -- --email admin@example.org --name "Rina Hartati" --role admin
 *   npm run provision -- --email doc@example.org --name "dr. Hanif" --role professional \
 *       --clinical-role physician --facility <facility-uuid> --can-review
 *
 * If the e-mail already has an account it is promoted; otherwise one is
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
    'clinical-role': { type: 'string' },
    facility: { type: 'string' },
    'can-review': { type: 'boolean', default: false },
  },
});

const ROLES = ['professional', 'admin'];
const CLINICAL = ['chw', 'nurse', 'physician', 'coordinator'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('--email is required and must be an address');
if (!ROLES.includes(values.role)) fail(`--role must be one of: ${ROLES.join(', ')}`);

const staffRequested = values.role === 'professional' || values['clinical-role'] || values.facility;
if (staffRequested) {
  if (!CLINICAL.includes(values['clinical-role'])) fail(`--clinical-role must be one of: ${CLINICAL.join(', ')}`);
  if (!values.facility || !UUID.test(values.facility)) fail('--facility must be the uuid of a healthcare_facilities row');
}
if (values.role === 'admin' && values['can-review']) {
  fail('administrators are not clinical and cannot hold review rights; use --role professional');
}

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
  profile = { id: data.user.id, role: 'patient' };
  console.log(`created auth user ${profile.id}`);
}

{
  const { error } = await admin.from('profiles').update({ role: values.role, status: 'active' }).eq('id', profile.id);
  if (error) fail(error.message);
}

if (staffRequested) {
  const { error } = await admin.from('healthcare_professional_profiles').upsert(
    {
      profile_id: profile.id,
      clinical_role: values['clinical-role'],
      facility_id: values.facility,
      can_review: values.role === 'professional' && values['can-review'],
    },
    { onConflict: 'profile_id' },
  );
  if (error) fail(`could not write the staff record: ${error.message}`);
}

const { error: auditError } = await admin.from('audit_logs').insert({
  actor_id: null,
  actor_name: 'provision-user script',
  action: 'account.role-changed',
  subject: email,
  detail: `Provisioned as ${values.role} from the command line`,
});
if (auditError) console.warn(`warning: audit entry not written: ${auditError.message}`);

console.log(`${email} is now ${values.role}.`);
if (generatedPassword && !values.password) {
  console.log(`temporary password (shown once, change it after first sign-in): ${generatedPassword}`);
}
