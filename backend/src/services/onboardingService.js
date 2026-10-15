import * as serialize from './serializers.js';
import { unwrap } from './db.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Patient onboarding, saved per step so the wizard resumes.
 *
 * Writes go through the caller's own client: the RLS policy only lets a
 * patient touch their own row, and consent / completion columns are not
 * grantable, so they change only inside the SQL functions below.
 */

async function currentRow(ctx) {
  return unwrap(await ctx.db.from('patient_onboarding').select('*').eq('profile_id', ctx.userId).maybeSingle());
}

export async function get(ctx) {
  return serialize.onboarding(await currentRow(ctx));
}

async function saveStep(ctx, column, value, step) {
  const existing = await currentRow(ctx);
  if (existing?.completed_at) {
    // After completion only the contact details can be edited in place (the
    // profile page). Anything else goes through "reopen", so the wizard and
    // the route guard stay in step with what the record says.
    if (column !== 'personal') {
      throw ApiError.conflict('Onboarding is already complete. Reopen it to make changes.');
    }
    unwrap(await ctx.db.from('patient_onboarding').update({ personal: value }).eq('profile_id', ctx.userId));
    unwrap(await ctx.db.from('profiles').update({ full_name: value.fullName }).eq('id', ctx.userId));
    unwrap(
      await ctx.db
        .from('patient_profiles')
        .update({
          name: value.fullName,
          phone: value.phone || null,
          sex: value.sex,
          birth_date: value.birthDate,
        })
        .eq('profile_id', ctx.userId),
    );
    return get(ctx);
  }

  if (existing) {
    unwrap(
      await ctx.db
        .from('patient_onboarding')
        .update({ [column]: value, step: Math.max(existing.step ?? 0, step) })
        .eq('profile_id', ctx.userId),
    );
  } else {
    unwrap(
      await ctx.db.from('patient_onboarding').insert({ profile_id: ctx.userId, step, [column]: value }),
    );
  }

  if (column === 'personal' && value.fullName) {
    unwrap(await ctx.db.from('profiles').update({ full_name: value.fullName }).eq('id', ctx.userId));
  }
  return get(ctx);
}

export const savePersonal = (ctx, value) => saveStep(ctx, 'personal', value, 1);
export const saveAddress = (ctx, value) => saveStep(ctx, 'address', value, 2);
export const saveHealth = (ctx, value) => saveStep(ctx, 'health', value, 3);

export async function complete(ctx, { dataUse, healthInfo }) {
  unwrap(await ctx.db.rpc('complete_patient_onboarding', { p_data_use: dataUse, p_health_info: healthInfo }));
  return get(ctx);
}

export async function reopen(ctx, step) {
  unwrap(await ctx.db.rpc('reopen_patient_onboarding', { p_step: step }));
  return get(ctx);
}

export async function setHealthConsent(ctx, healthInfo) {
  unwrap(await ctx.db.rpc('set_health_consent', { p_health_info: healthInfo }));
  return get(ctx);
}
