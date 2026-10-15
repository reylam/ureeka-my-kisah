import * as serialize from './serializers.js';
import * as audit from './auditService.js';
import { unwrap, unwrapOne } from './db.js';
import * as staff from './staffService.js';
import { ApiError } from '../utils/ApiError.js';
import { pageMeta, toRange } from '../utils/pagination.js';

const WITH_EVENTS = '*, referral_events(*)';

export async function list(ctx, { page, pageSize, status, patientId }) {
  let query = ctx.db.from('referrals').select(WITH_EVENTS, { count: 'exact' }).order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (patientId) query = query.eq('patient_id', patientId);
  const { from, to } = toRange({ page, pageSize });
  const result = await query.range(from, to);
  return { items: unwrap(result).map((row) => serialize.referral(row)), meta: pageMeta({ page, pageSize }, result.count) };
}

/** A patient's own referrals. RLS scopes the rows; no filter is needed or trusted here. */
export async function listOwn(ctx) {
  const rows = unwrap(await ctx.db.from('referrals').select(WITH_EVENTS).order('created_at', { ascending: false }));
  return rows.map((row) => serialize.referral(row));
}

export async function get(ctx, id) {
  const row = unwrapOne(await ctx.db.from('referrals').select(WITH_EVENTS).eq('id', id).maybeSingle());
  return serialize.referral(row);
}

export async function create(ctx, input) {
  await staff.assertStaffMember(ctx, input.assignedWorkerId);
  const row = unwrap(
    await ctx.db
      .from('referrals')
      .insert({
        patient_id: input.patientId,
        screening_id: input.screeningId,
        from_facility_id: ctx.staff.facilityId,
        to_facility_id: input.toFacilityId,
        reason: input.reason,
        requested_service: input.requestedService,
        priority: input.priority,
        status: input.status,
        appointment_date: input.appointmentDate,
        assigned_worker_id: input.assignedWorkerId,
        created_by: ctx.userId,
      })
      .select('id')
      .single(),
  );
  await audit.recordAfter(ctx, {
    action: 'referral.created',
    subject: row.id,
    metadata: { patientId: input.patientId, priority: input.priority },
  });
  return get(ctx, row.id);
}

export async function update(ctx, id, input) {
  const patch = {};
  if (input.toFacilityId !== undefined) patch.to_facility_id = input.toFacilityId;
  if (input.reason !== undefined) patch.reason = input.reason;
  if (input.requestedService !== undefined) patch.requested_service = input.requestedService;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.appointmentDate !== undefined) patch.appointment_date = input.appointmentDate;
  if (input.assignedWorkerId !== undefined) patch.assigned_worker_id = input.assignedWorkerId;
  if (!Object.keys(patch).length) throw ApiError.badRequest('Nothing to update.');
  if (input.assignedWorkerId) await staff.assertStaffMember(ctx, input.assignedWorkerId);

  unwrapOne(await ctx.db.from('referrals').update(patch).eq('id', id).select('id').maybeSingle());
  return get(ctx, id);
}

export async function setStatus(ctx, id, { status, note }) {
  // Authorised and recorded inside the function (status + history event).
  unwrap(await ctx.db.rpc('set_referral_status', { p_referral_id: id, p_status: status, p_note: note ?? null }));
  await audit.recordAfter(ctx, { action: 'referral.status-changed', subject: id, detail: status });
  return get(ctx, id);
}
