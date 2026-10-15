import { randomUUID } from 'node:crypto';
import * as serialize from './serializers.js';
import * as audit from './auditService.js';
import { toAnalysis } from './inferenceService.js';
import { readImageSize } from './imageInfo.js';
import { unwrap, unwrapOne } from './db.js';
import { sniffImage } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { pageMeta, toRange } from '../utils/pagination.js';

/**
 * Screenings.
 *
 * Three statuses are deliberately separate (see the schema comments):
 *   status          workflow state of the record
 *   modelStatus     what the model step did: not-run | pending | completed |
 *                   failed | unavailable
 *   review          present once a clinician has signed off
 *
 * Image bytes and model output are written with the service role, because no
 * client holds a grant on those columns. Every such write happens only after
 * the same request has loaded the screening through the caller's own
 * RLS-scoped client, so "can this person touch this screening" is answered by
 * the database first.
 */

const FULL = '*, screening_reports(*), screening_reviews(*), referrals(id)';
const WITH_REVIEW = '*, screening_reviews(*), referrals(id)';

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function list(ctx, { page, pageSize, status, patientId }) {
  const { from, to } = toRange({ page, pageSize });

  if (ctx.role === 'admin') {
    // Metadata only. The clinical tables are not even selected.
    let query = ctx.db
      .from('screenings')
      .select('id,patient_id,facility_id,operator_id,performed_at,status,image_quality,created_offline', {
        count: 'exact',
      })
      .order('performed_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (patientId) query = query.eq('patient_id', patientId);
    const result = await query.range(from, to);
    return { items: unwrap(result).map(serialize.adminScreening), meta: pageMeta({ page, pageSize }, result.count) };
  }

  let query = ctx.db.from('screenings').select(FULL, { count: 'exact' }).order('performed_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (patientId) query = query.eq('patient_id', patientId);
  const result = await query.range(from, to);
  return { items: unwrap(result).map(serialize.screening), meta: pageMeta({ page, pageSize }, result.count) };
}

export async function get(ctx, id) {
  if (ctx.role === 'admin') {
    const row = unwrapOne(
      await ctx.db
        .from('screenings')
        .select('id,patient_id,facility_id,operator_id,performed_at,status,image_quality,created_offline')
        .eq('id', id)
        .maybeSingle(),
    );
    return serialize.adminScreening(row);
  }
  const row = unwrapOne(await ctx.db.from('screenings').select(FULL).eq('id', id).maybeSingle());
  return serialize.screening(row);
}

/** A patient's own screenings: state and the clinician's review, nothing more. */
export async function listOwn(ctx) {
  const rows = unwrap(
    await ctx.db.from('screenings').select(WITH_REVIEW).order('performed_at', { ascending: false }),
  );
  return rows.map(serialize.patientScreening);
}

export async function getOwn(ctx, id) {
  const row = unwrapOne(await ctx.db.from('screenings').select(WITH_REVIEW).eq('id', id).maybeSingle());
  return serialize.patientScreening(row);
}

/* ── Create and edit ────────────────────────────────────────────────────── */

export async function create(ctx, input) {
  const screening = unwrap(
    await ctx.db
      .from('screenings')
      .insert({
        patient_id: input.patientId,
        facility_id: ctx.staff.facilityId,
        operator_id: ctx.userId,
        status: input.asDraft ? 'draft' : 'queued',
        image_quality: input.imageQuality,
        created_offline: input.createdOffline,
        ...(input.performedAt ? { performed_at: input.performedAt } : {}),
      })
      .select('id')
      .single(),
  );

  const { error } = await ctx.db
    .from('screening_reports')
    .insert({ screening_id: screening.id, symptoms: input.symptoms, vitals: input.vitals });
  if (error) {
    // Do not leave a screening with no clinical content behind.
    await ctx.db.from('screenings').delete().eq('id', screening.id);
    throw error;
  }

  await audit.recordAfter(ctx, {
    action: 'screening.created',
    subject: screening.id,
    metadata: { patientId: input.patientId, asDraft: input.asDraft },
  });
  return get(ctx, screening.id);
}

/** Edit a draft, and optionally submit it. Only the operator, only while it is a draft. */
export async function finalize(ctx, id, input) {
  const current = unwrapOne(
    await ctx.db.from('screenings').select('id,operator_id,status').eq('id', id).maybeSingle(),
  );
  if (current.operator_id !== ctx.userId) throw ApiError.forbidden('Only the person who started this screening can edit it.');
  if (current.status !== 'draft') throw ApiError.conflict('Only a draft can be edited.');

  unwrapOne(
    await ctx.db
      .from('screening_reports')
      .update({ symptoms: input.symptoms, vitals: input.vitals })
      .eq('screening_id', id)
      .select('screening_id')
      .maybeSingle(),
  );
  unwrapOne(
    await ctx.db
      .from('screenings')
      .update({ image_quality: input.imageQuality, ...(input.submit ? { status: 'queued' } : {}) })
      .eq('id', id)
      .select('id')
      .maybeSingle(),
  );
  return get(ctx, id);
}

export async function removeDraft(ctx, id, { bucket }) {
  const report = unwrap(
    await ctx.db.from('screening_reports').select('image_path').eq('screening_id', id).maybeSingle(),
  );
  const deleted = unwrap(await ctx.db.from('screenings').delete().eq('id', id).select('id'));
  if (!deleted.length) {
    // Either it does not exist for this caller, or it is not a draft of theirs.
    throw ApiError.notFound();
  }
  if (report?.image_path) {
    await ctx.admin.storage.from(bucket).remove([report.image_path]).catch(() => {});
  }
  await audit.recordAfter(ctx, { action: 'screening.deleted', subject: id });
}

/* ── Image ──────────────────────────────────────────────────────────────── */

export async function uploadImage(ctx, id, file, fields, { bucket }) {
  const screening = unwrapOne(
    await ctx.db.from('screenings').select('id,patient_id,operator_id,status').eq('id', id).maybeSingle(),
  );
  if (screening.operator_id !== ctx.userId) {
    throw ApiError.forbidden('Only the person who recorded this screening can attach its image.');
  }
  if (!['draft', 'queued'].includes(screening.status)) {
    throw ApiError.conflict('The image can no longer be changed.');
  }

  const kind = sniffImage(file.buffer);
  if (!kind) throw ApiError.validation({ image: ['Only JPEG and PNG images are accepted.'] });
  const size = readImageSize(file.buffer);

  const path = `${screening.patient_id}/${screening.id}/${randomUUID()}.${kind.ext}`;
  const upload = await ctx.admin.storage.from(bucket).upload(path, file.buffer, {
    contentType: kind.mime,
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const previous = unwrap(
    await ctx.admin.from('screening_reports').select('image_path').eq('screening_id', id).maybeSingle(),
  );

  const meta = {
    fileName: (fields.fileName || file.originalname || 'image').replace(/[^\w.\- ]/g, '_').slice(0, 120),
    sizeBytes: file.size,
    mimeType: kind.mime,
    // Dimensions come from the file itself, not from the request.
    width: size?.width ?? null,
    height: size?.height ?? null,
  };

  const { error } = await ctx.admin
    .from('screening_reports')
    .update({
      image_path: path,
      image_meta: meta,
      // A new image invalidates any earlier model output.
      model_status: 'not-run',
      analysis: null,
      analysed_at: null,
    })
    .eq('screening_id', id);
  if (error) {
    await ctx.admin.storage.from(bucket).remove([path]).catch(() => {});
    throw error;
  }
  if (previous?.image_path) {
    await ctx.admin.storage.from(bucket).remove([previous.image_path]).catch(() => {});
  }

  await audit.recordAfter(ctx, { action: 'screening.image-attached', subject: id });
  return get(ctx, id);
}

/**
 * Short-lived signed URL for the screening's image.
 *
 * Professionals assigned to the patient only. The route also rejects
 * administrators outright, and the database would return no report row for
 * them anyway: the answer is a 403 for roles that must never see images and a
 * 404 for a professional with no access to this particular screening.
 */
export async function signedImageUrl(ctx, id, { bucket, ttlSeconds }) {
  if (ctx.role !== 'professional') throw ApiError.forbidden('Images are only available to the treating team.');

  const report = unwrapOne(
    await ctx.db.from('screening_reports').select('image_path').eq('screening_id', id).maybeSingle(),
  );
  if (!report.image_path) throw ApiError.notFound('This screening has no image.');

  // Fails closed: no audit entry, no URL.
  await audit.record(ctx, { action: 'screening.image-viewed', subject: id });

  const { data, error } = await ctx.admin.storage.from(bucket).createSignedUrl(report.image_path, ttlSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not sign image URL');
  return { url: data.signedUrl, expiresInSeconds: ttlSeconds };
}

/* ── Model ──────────────────────────────────────────────────────────────── */

export async function analyze(ctx, id, { inference, bucket, logger = console }) {
  const row = unwrapOne(await ctx.db.from('screenings').select(FULL).eq('id', id).maybeSingle());
  const report = Array.isArray(row.screening_reports) ? row.screening_reports[0] : row.screening_reports;
  if (!report?.image_path) throw ApiError.conflict('Attach an image before running the model.');
  if (report.model_status === 'completed') throw ApiError.conflict('This screening has already been analysed.');
  if (report.model_status === 'pending') throw ApiError.conflict('Analysis is already running.');
  if (!['queued', 'awaiting-review'].includes(row.status)) {
    throw ApiError.conflict('Only a submitted screening can be analysed.');
  }

  const setModelState = async (patch) => {
    const { error } = await ctx.admin.from('screening_reports').update(patch).eq('screening_id', id);
    if (error) throw error;
  };

  if (!inference.configured) {
    await setModelState({ model_status: 'unavailable' });
    throw ApiError.unavailable(
      'MODEL_NOT_CONNECTED',
      'The screening model is not connected to this server. The record is saved and can be reviewed without it.',
    );
  }

  await setModelState({ model_status: 'pending' });
  try {
    const download = await ctx.admin.storage.from(bucket).download(report.image_path);
    if (download.error) throw download.error;
    const bytes = Buffer.from(await download.data.arrayBuffer());
    const kind = sniffImage(bytes);

    const raw = await inference.analyze({ bytes, mime: kind?.mime ?? 'image/png', fileName: `${id}.${kind?.ext ?? 'png'}` });
    const analysis = toAnalysis(raw, readImageSize(bytes));

    await setModelState({ model_status: 'completed', analysis, analysed_at: analysis.analysedAt });
  } catch (error) {
    await setModelState({ model_status: 'failed' }).catch((inner) =>
      logger.error({ message: 'could not record model failure', code: inner?.code }),
    );
    throw error;
  }

  await audit.recordAfter(ctx, { action: 'screening.analysed', subject: id });
  return get(ctx, id);
}

/* ── Review ─────────────────────────────────────────────────────────────── */

export async function review(ctx, id, { agreement, decision, notes }) {
  // The trigger moves the status; RLS demands an assigned reviewer with
  // can_review, so a CHW or an administrator is refused by the database too.
  unwrap(
    await ctx.db
      .from('screening_reviews')
      .insert({ screening_id: id, reviewer_id: ctx.userId, agreement, decision, notes })
      .select('screening_id')
      .single(),
  );

  if (notes) {
    const patientId = unwrap(await ctx.db.from('screenings').select('patient_id').eq('id', id).maybeSingle())?.patient_id;
    if (patientId) {
      await ctx.db
        .from('patient_notes')
        .insert({ patient_id: patientId, author_id: ctx.userId, body: notes, context: 'screening', context_id: id });
    }
  }

  await audit.recordAfter(ctx, { action: 'screening.reviewed', subject: id, detail: decision });
  return get(ctx, id);
}
