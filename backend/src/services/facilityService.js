import * as serialize from './serializers.js';
import * as audit from './auditService.js';
import { unwrap, unwrapOne } from './db.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeSearch } from '../utils/pagination.js';

/**
 * Facility directory.
 *
 * Reads run as the caller (anonymous visitors included), so RLS decides what
 * is visible: published entries for everyone, unpublished ones for
 * administrators and for a professional's own facility. Writes are
 * administrator-only in the policies as well as in the route table.
 */

const today = () => new Date().toISOString().slice(0, 10);

export async function list(client, { published, q, type, service }, { isAdmin }) {
  let query = client.from('healthcare_facilities').select('*').order('name', { ascending: true });
  // Only an administrator may ask for the unpublished set; everyone else is
  // narrowed to published entries regardless of what they ask for.
  if (published === true || !isAdmin) query = query.eq('published', true);
  else if (published === false) query = query.eq('published', false);
  if (type) query = query.eq('type', type);
  if (service) query = query.contains('services', [service]);
  const term = sanitizeSearch(q);
  if (term) query = query.or(`name.ilike.%${term}%,region.ilike.%${term}%,address.ilike.%${term}%`);
  return unwrap(await query).map(serialize.facility);
}

function toRow(draft) {
  return {
    name: draft.name,
    type: draft.type,
    province: draft.province,
    region: draft.region,
    address: draft.address,
    phone: draft.phone,
    operating_hours: draft.operatingHours,
    services: draft.services,
    tb_programme_contact: draft.tbProgrammeContact || null,
  };
}

export async function create(ctx, draft) {
  const row = unwrap(
    await ctx.db
      .from('healthcare_facilities')
      .insert({
        ...toRow(draft),
        // Unpublished until a person has checked it. Coordinates and travel
        // estimates stay empty until a real geocoding lookup exists.
        published: false,
        info_status: 'needs-review',
        info_updated_at: today(),
        created_by: ctx.userId,
      })
      .select('*')
      .single(),
  );
  await audit.recordAfter(ctx, { action: 'facility.created', subject: row.name, metadata: { facilityId: row.id } });
  return serialize.facility(row);
}

export async function update(ctx, id, draft) {
  const row = unwrapOne(
    await ctx.db
      .from('healthcare_facilities')
      .update({
        ...toRow(draft),
        // Any edit puts the entry back in the review queue.
        info_status: 'needs-review',
        info_updated_at: today(),
      })
      .eq('id', id)
      .select('*')
      .maybeSingle(),
  );
  await audit.recordAfter(ctx, { action: 'facility.updated', subject: row.name, metadata: { facilityId: row.id } });
  return serialize.facility(row);
}

export async function setPublished(ctx, id, published) {
  const row = unwrapOne(
    await ctx.db.from('healthcare_facilities').update({ published }).eq('id', id).select('*').maybeSingle(),
  );
  await audit.recordAfter(ctx, {
    action: published ? 'facility.published' : 'facility.unpublished',
    subject: row.name,
    metadata: { facilityId: row.id },
  });
  return serialize.facility(row);
}

export async function remove(ctx, id) {
  const existing = unwrapOne(
    await ctx.db.from('healthcare_facilities').select('id,name').eq('id', id).maybeSingle(),
  );
  const { error } = await ctx.db.from('healthcare_facilities').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw ApiError.conflict(
        'This facility is referenced by staff, patients or referrals. Unpublish it instead.',
      );
    }
    throw error;
  }
  await audit.recordAfter(ctx, { action: 'facility.deleted', subject: existing.name, metadata: { facilityId: id } });
}
