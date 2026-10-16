import { unwrap } from './db.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Dashboard figures for the clinical dashboard.
 *
 * Computed by `public.dashboard_summary()` (see migration 20260101000400) as
 * the caller, so Row Level Security decides what is counted. Nothing is
 * estimated or filled in here: no records means zeros.
 */
export async function summary(ctx, { days, tz }) {
  if (ctx.role !== 'professional') {
    throw ApiError.forbidden('The clinical dashboard is for health professionals.');
  }
  return unwrap(await ctx.db.rpc('dashboard_summary', { p_days: days, p_tz: tz }));
}
