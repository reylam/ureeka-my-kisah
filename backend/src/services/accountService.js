import * as serialize from './serializers.js';
import { unwrap, unwrapOne } from './db.js';
import { tokenIssuedAt } from '../middleware/auth.js';
import { pageMeta, sanitizeSearch, toRange } from '../utils/pagination.js';

const PROFILE_COLUMNS = 'id,email,full_name,role,status,created_at,last_sign_in_at';

/** The signed-in account. Also records a sign-in the first time a new token is seen. */
export async function me(ctx) {
  const issuedAt = tokenIssuedAt(ctx.token);
  let lastSignInAt = ctx.lastSignInAt;
  if (issuedAt) {
    const at = new Date(issuedAt * 1000);
    if (!lastSignInAt || new Date(lastSignInAt) < at) {
      const { error } = await ctx.db.rpc('touch_last_sign_in', { p_at: at.toISOString() });
      if (!error) lastSignInAt = at.toISOString();
    }
  }

  // The session was loaded before this request, so a clinical record created in
  // between (finishing onboarding) is not in ctx yet. Ask again when it is missing.
  let patientId = ctx.patientId;
  if (ctx.role === 'patient' && !patientId) {
    patientId =
      unwrap(await ctx.db.from('patient_profiles').select('id').eq('profile_id', ctx.userId).maybeSingle())?.id ?? null;
  }

  let onboardingRow = null;
  if (ctx.role === 'patient') {
    onboardingRow = unwrap(
      await ctx.db.from('patient_onboarding').select('*').eq('profile_id', ctx.userId).maybeSingle(),
    );
  }

  return serialize.account(
    {
      id: ctx.userId,
      email: ctx.email,
      full_name: ctx.fullName,
      role: ctx.role,
      status: ctx.status,
      created_at: ctx.createdAt,
      last_sign_in_at: lastSignInAt,
    },
    {
      staff: ctx.staff,
      patientId,
      onboarding: serialize.onboarding(onboardingRow),
    },
  );
}

/** Revoke the caller's refresh tokens so the session cannot be resumed elsewhere. */
export async function signOut(ctx) {
  const { error } = await ctx.admin.auth.admin.signOut(ctx.token, 'global');
  // A token that is already gone is not a failure of logging out.
  if (error && !/not found|invalid|expired/i.test(error.message ?? '')) throw error;
}

/* ── Administration ─────────────────────────────────────────────────────── */

async function decorate(ctx, profiles) {
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.id);
  const [staffRows, patientRows] = await Promise.all([
    ctx.db.from('healthcare_professional_profiles').select('profile_id,clinical_role,can_review,facility_id,phone').in('profile_id', ids),
    ctx.db.from('patient_profiles').select('id,profile_id,registered_at').in('profile_id', ids),
  ]);
  const staffById = new Map(unwrap(staffRows).map((row) => [row.profile_id, row]));
  const patientByProfile = new Map(unwrap(patientRows).map((row) => [row.profile_id, row]));

  return profiles.map((profile) => {
    const staffRow = staffById.get(profile.id);
    const patientRow = patientByProfile.get(profile.id);
    // Onboarding answers are private to the patient. An administrator only
    // learns whether the clinical record exists.
    const onboarding = patientRow
      ? { ...serialize.emptyOnboarding(), completedAt: new Date(patientRow.registered_at).toISOString(), step: 3 }
      : serialize.emptyOnboarding();
    return {
      ...serialize.account(profile, {
        staff: staffRow ? { clinicalRole: staffRow.clinical_role } : null,
        patientId: patientRow?.id ?? null,
        onboarding,
      }),
      staff: staffRow
        ? {
            clinicalRole: staffRow.clinical_role,
            canReview: staffRow.can_review === true,
            facilityId: staffRow.facility_id,
            phone: staffRow.phone ?? null,
          }
        : null,
    };
  });
}

export async function list(ctx, { page, pageSize, role, status, q }) {
  let query = ctx.db
    .from('profiles')
    .select(PROFILE_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  const term = sanitizeSearch(q);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { from, to } = toRange({ page, pageSize });
  const result = await query.range(from, to);
  const profiles = unwrap(result);
  return { items: await decorate(ctx, profiles), meta: pageMeta({ page, pageSize }, result.count) };
}

export async function get(ctx, id) {
  const profile = unwrapOne(await ctx.db.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle());
  const [item] = await decorate(ctx, [profile]);
  return item;
}

export async function setRole(ctx, id, role) {
  // The function re-checks admin, self-change and last-admin rules in SQL and
  // writes the audit entry in the same transaction.
  unwrap(await ctx.db.rpc('admin_set_account_role', { p_target: id, p_role: role }));
  return get(ctx, id);
}

export async function setStatus(ctx, id, status) {
  unwrap(await ctx.db.rpc('admin_set_account_status', { p_target: id, p_status: status }));

  // Suspension is enforced on every request (loadSession) and by RLS. Banning
  // the auth user as well stops a suspended person signing in again or
  // refreshing an open session; their current access token simply stops being
  // accepted by this API. Best effort: the database state is authoritative.
  const { error } = await ctx.admin.auth.admin.updateUserById(id, {
    ban_duration: status === 'suspended' ? '876000h' : 'none',
  });
  if (error) console.error({ message: 'auth ban sync failed', code: error.code ?? error.status });

  return get(ctx, id);
}
export async function upsertStaffProfile(ctx, id, input) {
  unwrap(
    await ctx.db.rpc('admin_upsert_staff_profile', {
      p_target: id,
      p_clinical_role: input.clinicalRole,
      p_facility_id: input.facilityId,
      p_can_review: input.canReview,
      p_phone: input.phone ?? null,
    }),
  );
  return get(ctx, id);
}

export async function removeStaffProfile(ctx, id) {
  unwrap(await ctx.db.rpc('admin_remove_staff_profile', { p_target: id }));
  return get(ctx, id);
}
