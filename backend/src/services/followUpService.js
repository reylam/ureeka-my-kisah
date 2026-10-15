import * as serialize from './serializers.js';
import * as audit from './auditService.js';
import { unwrap, unwrapOne } from './db.js';
import * as staff from './staffService.js';
import { pageMeta, toRange } from '../utils/pagination.js';

const WITH_ATTEMPTS = '*, follow_up_attempts(*)';

export async function list(ctx, { page, pageSize, status, patientId }) {
  let query = ctx.db
    .from('follow_up_records')
    .select(WITH_ATTEMPTS, { count: 'exact' })
    .order('due_date', { ascending: true });
  if (status) query = query.eq('status', status);
  if (patientId) query = query.eq('patient_id', patientId);
  const { from, to } = toRange({ page, pageSize });
  const result = await query.range(from, to);
  return { items: unwrap(result).map((row) => serialize.followUp(row)), meta: pageMeta({ page, pageSize }, result.count) };
}

export async function listOwn(ctx) {
  const rows = unwrap(await ctx.db.from('follow_up_records').select(WITH_ATTEMPTS).order('due_date', { ascending: true }));
  return rows.map((row) => serialize.followUp(row));
}

export async function get(ctx, id) {
  const row = unwrapOne(await ctx.db.from('follow_up_records').select(WITH_ATTEMPTS).eq('id', id).maybeSingle());
  return serialize.followUp(row);
}

export async function create(ctx, input) {
  await staff.assertStaffMember(ctx, input.assignedWorkerId);
  const row = unwrap(
    await ctx.db
      .from('follow_up_records')
      .insert({
        patient_id: input.patientId,
        referral_id: input.referralId,
        screening_id: input.screeningId,
        reason: input.reason,
        due_date: input.dueDate,
        assigned_worker_id: input.assignedWorkerId,
        created_by: ctx.userId,
      })
      .select('id')
      .single(),
  );
  await audit.recordAfter(ctx, { action: 'followup.created', subject: row.id, metadata: { patientId: input.patientId } });
  return get(ctx, row.id);
}

async function current(ctx, id) {
  return unwrapOne(await ctx.db.from('follow_up_records').select('*').eq('id', id).maybeSingle());
}

async function patch(ctx, id, values) {
  unwrapOne(await ctx.db.from('follow_up_records').update(values).eq('id', id).select('id').maybeSingle());
}

async function addAttempt(ctx, id, { channel, outcome, note }) {
  unwrap(
    await ctx.db
      .from('follow_up_attempts')
      .insert({ follow_up_id: id, actor_id: ctx.userId, channel, outcome, note: note?.trim() || null }),
  );
}

export async function reschedule(ctx, id, { dueDate, note }) {
  const row = await current(ctx, id);
  await patch(ctx, id, {
    due_date: dueDate,
    status: row.status === 'completed' ? 'scheduled' : row.status,
    completed_at: null,
  });
  if (note?.trim()) await addAttempt(ctx, id, { channel: 'phone', outcome: 'rescheduled', note });
  return get(ctx, id);
}

export async function logAttempt(ctx, id, input) {
  const row = await current(ctx, id);
  await addAttempt(ctx, id, input);
  // Logging an attempt moves a scheduled task into progress.
  if (row.status === 'scheduled') await patch(ctx, id, { status: 'in-progress' });
  return get(ctx, id);
}

export async function complete(ctx, id, { note }) {
  const row = await current(ctx, id);
  await patch(ctx, id, { status: 'completed', completed_at: new Date().toISOString(), unresolved_reason: null });
  if (note?.trim()) {
    unwrap(
      await ctx.db.from('patient_notes').insert({
        patient_id: row.patient_id,
        author_id: ctx.userId,
        body: note.trim(),
        context: 'followup',
        context_id: id,
      }),
    );
  }
  return get(ctx, id);
}

export async function markUnresolved(ctx, id, { reason }) {
  await current(ctx, id);
  await patch(ctx, id, { status: 'unresolved', unresolved_reason: reason, completed_at: null });
  return get(ctx, id);
}

export async function reassign(ctx, id, { workerId }) {
  await current(ctx, id);
  await staff.assertStaffMember(ctx, workerId, 'workerId');
  await patch(ctx, id, { assigned_worker_id: workerId });
  return get(ctx, id);
}
