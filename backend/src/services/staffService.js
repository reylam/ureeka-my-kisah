import * as serialize from './serializers.js';
import { unwrap } from './db.js';

/** Staff names, for "diperiksa oleh". RLS shows staff rows to staff only. */
export async function list(ctx) {
  const rows = unwrap(
    await ctx.db.from('profiles').select('id,full_name,role').not('role', 'is', null).order('full_name'),
  );
  return rows.map(serialize.staff);
}
