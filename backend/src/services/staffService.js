import * as serialize from './serializers.js';
import { unwrap } from './db.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Staff directory. `list_staff()` decides what each role may see: everyone for
 * professionals and administrators, and for a patient only the staff who appear
 * on their own records, without contact details.
 */
export async function list(ctx) {
  const rows = unwrap(await ctx.db.rpc('list_staff'));
  return rows.map(serialize.staff);
}

/** Assignees must be staff. Keeps a patient id from being used as a worker id. */
export async function assertStaffMember(ctx, profileId, field = 'assignedWorkerId') {
  const rows = unwrap(await ctx.db.rpc('list_staff'));
  if (!rows.some((row) => row.id === profileId)) {
    throw ApiError.validation({ [field]: ['That person is not a staff member.'] });
  }
}
