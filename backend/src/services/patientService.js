import * as serialize from './serializers.js';
import * as audit from './auditService.js';
import { unwrap, unwrapOne } from './db.js';
import { ApiError } from '../utils/ApiError.js';
import { pageMeta, sanitizeSearch, toRange } from '../utils/pagination.js';

/**
 * Patient records.
 *
 * "Which patients can this caller see" is decided by RLS (assigned facility for
 * a professional, own record for a patient, everything for an administrator),
 * so these queries carry no scoping logic of their own. A record outside the
 * caller's scope simply is not returned, and reads as 404.
 */

export async function list(ctx, { page, pageSize, q }) {
  let query = ctx.db
    .from('patient_profiles')
    .select('*', { count: 'exact' })
    .order('registered_at', { ascending: false });
  const term = sanitizeSearch(q);
  if (term) query = query.or(`name.ilike.%${term}%,mrn.ilike.%${term}%,village.ilike.%${term}%`);
  const { from, to } = toRange({ page, pageSize });
  const result = await query.range(from, to);
  return { items: unwrap(result).map((row) => serialize.patient(row)), meta: pageMeta({ page, pageSize }, result.count) };
}

export async function get(ctx, id) {
  const row = unwrapOne(await ctx.db.from('patient_profiles').select('*').eq('id', id).maybeSingle());
  const notes = unwrap(
    await ctx.db.from('patient_notes').select('*').eq('patient_id', id).order('created_at', { ascending: false }),
  );

  // Reading a patient's record is itself an auditable event.
  await audit.record(ctx, {
    action: 'patient.viewed',
    subject: row.mrn,
    detail: null,
    metadata: { patientId: row.id },
  });

  return serialize.patient(row, notes);
}

export async function getOwn(ctx) {
  if (!ctx.patientId) throw ApiError.notFound('No clinical record yet. Finish onboarding first.');
  const row = unwrapOne(await ctx.db.from('patient_profiles').select('*').eq('id', ctx.patientId).maybeSingle());
  return serialize.patient(row);
}

export async function create(ctx, input) {
  const facilityId = ctx.role === 'professional' ? ctx.staff.facilityId : null;
  const row = unwrap(
    await ctx.db
      .from('patient_profiles')
      .insert({
        name: input.name,
        sex: input.sex,
        birth_date: input.birthDate,
        phone: input.phone || null,
        village: input.village,
        district: input.district,
        province: input.province,
        risk_factors: input.riskFactors,
        household_contacts: input.householdContacts,
        home_facility_id: facilityId,
        created_by: ctx.userId,
      })
      .select('*')
      .single(),
  );
  await audit.recordAfter(ctx, { action: 'patient.created', subject: row.mrn, metadata: { patientId: row.id } });
  return serialize.patient(row);
}

export async function update(ctx, id, input) {
  const patch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.sex !== undefined) patch.sex = input.sex;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.village !== undefined) patch.village = input.village;
  if (input.district !== undefined) patch.district = input.district;
  if (input.province !== undefined) patch.province = input.province;
  if (input.riskFactors !== undefined) patch.risk_factors = input.riskFactors;
  if (input.householdContacts !== undefined) patch.household_contacts = input.householdContacts;
  if (!Object.keys(patch).length) throw ApiError.badRequest('Nothing to update.');

  const row = unwrapOne(
    await ctx.db.from('patient_profiles').update(patch).eq('id', id).select('*').maybeSingle(),
  );
  await audit.recordAfter(ctx, { action: 'patient.updated', subject: row.mrn, metadata: { patientId: row.id } });
  return serialize.patient(row);
}

/** Administrators decide which facility a patient belongs to (and so who is assigned). */
export async function setHomeFacility(ctx, id, homeFacilityId) {
  const row = unwrapOne(
    await ctx.db
      .from('patient_profiles')
      .update({ home_facility_id: homeFacilityId })
      .eq('id', id)
      .select('*')
      .maybeSingle(),
  );
  await audit.recordAfter(ctx, {
    action: 'patient.facility-changed',
    subject: row.mrn,
    detail: homeFacilityId ? `Placed at facility ${homeFacilityId}` : 'Removed from facility',
    metadata: { patientId: row.id },
  });
  return serialize.patient(row);
}

export async function addNote(ctx, patientId, { body, context, contextId }) {
  const row = unwrap(
    await ctx.db
      .from('patient_notes')
      .insert({
        patient_id: patientId,
        author_id: ctx.userId,
        body,
        context,
        context_id: contextId ?? null,
      })
      .select('*')
      .single(),
  );
  return serialize.note(row);
}
