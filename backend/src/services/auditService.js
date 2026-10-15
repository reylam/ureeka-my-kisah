import { auditEntry } from './serializers.js';
import { unwrap } from './db.js';
import { pageMeta, sanitizeSearch, toRange } from '../utils/pagination.js';

/**
 * Audit trail.
 *
 * Rows are written with the service role because no client holds an INSERT
 * grant on audit_logs, and the actor is always taken from the verified
 * session, never from the request. The table itself is append-only.
 */

/**
 * Record an event and fail if it cannot be recorded. Used where the audit
 * entry is the point: reads of patient records and clinical images. If the
 * trail cannot be written, the read does not happen.
 */
export async function record(ctx, { action, subject, detail = null, metadata = {} }) {
  const { error } = await ctx.admin.from('audit_logs').insert({
    actor_id: ctx.userId,
    actor_name: ctx.fullName ?? '',
    action,
    subject,
    detail,
    metadata,
  });
  if (error) throw error;
}

/** Record an event after an action that has already happened; never blocks it. */
export async function recordAfter(ctx, event, logger = console) {
  try {
    await record(ctx, event);
  } catch (error) {
    logger.error({ message: 'audit write failed', action: event.action, code: error?.code });
  }
}

export async function list(ctx, { page, pageSize, action, q }) {
  let query = ctx.db
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('at', { ascending: false });
  if (action) query = query.eq('action', action);
  const term = sanitizeSearch(q);
  if (term) {
    query = query.or(`subject.ilike.%${term}%,actor_name.ilike.%${term}%,detail.ilike.%${term}%`);
  }
  const { from, to } = toRange({ page, pageSize });
  const result = await query.range(from, to);
  const rows = unwrap(result);
  return { items: rows.map(auditEntry), meta: pageMeta({ page, pageSize }, result.count) };
}
