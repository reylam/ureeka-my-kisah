import * as serialize from './serializers.js';
import { unwrap, unwrapOne } from './db.js';
import { pageMeta, sanitizeSearch, toRange } from '../utils/pagination.js';

/**
 * Saved patients. Both staff roles read and save them (one clinic); RLS
 * enforces the same.
 */

const COLUMNS = 'id,mrn,name,sex,birth_date,phone,address,created_at';

const toRow = (input) => ({
  name: input.name,
  sex: input.sex,
  birth_date: input.birthDate,
  phone: input.phone || null,
  address: input.address ?? '',
});

export async function list(ctx, { page, pageSize, q }) {
  const { from, to } = toRange({ page, pageSize });
  let query = ctx.db.from('patients').select(COLUMNS, { count: 'exact' }).order('name');
  const text = sanitizeSearch(q);
  if (text) query = query.or(`name.ilike.*${text}*,mrn.ilike.*${text}*,phone.ilike.*${text}*`);
  const result = await query.range(from, to);
  return { items: unwrap(result).map(serialize.patient), meta: pageMeta({ page, pageSize }, result.count) };
}

export async function get(ctx, id) {
  return serialize.patient(unwrapOne(await ctx.db.from('patients').select(COLUMNS).eq('id', id).maybeSingle()));
}

export async function create(ctx, input) {
  const row = unwrap(
    await ctx.db
      .from('patients')
      .insert({ ...toRow(input), created_by: ctx.userId })
      .select(COLUMNS)
      .single(),
  );
  return serialize.patient(row);
}

export async function update(ctx, id, input) {
  const row = unwrapOne(
    await ctx.db.from('patients').update(toRow(input)).eq('id', id).select(COLUMNS).maybeSingle(),
  );
  return serialize.patient(row);
}
