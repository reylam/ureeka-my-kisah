import { randomUUID } from 'node:crypto';
import * as serialize from './serializers.js';
import { LABELS, toAnalysis, zoneFor } from './inferenceService.js';
import { readImageSize } from './imageInfo.js';
import { unwrap, unwrapOne } from './db.js';
import { sniffImage } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { pageMeta, toRange } from '../utils/pagination.js';

/**
 * Screenings: one row per visit, from the request to the queue.
 *
 *   waiting -> examining -> queued -> served
 *
 * Every step that moves a visit forward is a database function that checks
 * the caller itself (create_request, start_screening, submit_screening,
 * mark_served), so no client can set a status, a queue number or a code.
 *
 * Image bytes and model output are written with the service role, because no
 * client holds a grant on those columns. Each such write happens only after
 * the same request has loaded the screening through the caller's own
 * RLS-scoped client and checked that it is theirs to change.
 */

const SELECT = serialize.SCREENING_SELECT;

/** Today in the clinic's time zone, as YYYY-MM-DD. Matches the SQL functions. */
export function clinicToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
}

export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

/** Most urgent first; within a priority, whoever was submitted first. */
export const byQueueOrder = (a, b) =>
  PRIORITY_RANK[a.queue_priority] - PRIORITY_RANK[b.queue_priority] ||
  String(a.submitted_at).localeCompare(String(b.submitted_at));

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function list(ctx, { page, pageSize, status, patientId, date }) {
  const { from, to } = toRange({ page, pageSize });
  let query = ctx.db.from('screenings').select(SELECT, { count: 'exact' }).order('requested_at', { ascending: false });
  if (status?.length) query = query.in('status', status);
  if (patientId) query = query.eq('patient_id', patientId);
  if (date) query = query.eq('request_date', date);
  const result = await query.range(from, to);
  return { items: unwrap(result).map(serialize.screening), meta: pageMeta({ page, pageSize }, result.count) };
}

async function loadRow(ctx, id) {
  return unwrapOne(await ctx.db.from('screenings').select(SELECT).eq('id', id).maybeSingle());
}

export async function get(ctx, id) {
  return serialize.screening(await loadRow(ctx, id));
}

/** The queue for one day: still waiting to be called, and already called. */
export async function queue(ctx, { date }) {
  const day = date ?? clinicToday();
  const rows = unwrap(
    await ctx.db.from('screenings').select(SELECT).eq('queue_date', day).in('status', ['queued', 'served']),
  );
  const waiting = rows.filter((row) => row.status === 'queued').sort(byQueueOrder);
  const served = rows
    .filter((row) => row.status === 'served')
    .sort((a, b) => String(b.served_at).localeCompare(String(a.served_at)));
  return { date: day, items: waiting.map(serialize.screening), served: served.map(serialize.screening) };
}

/* ── The request ────────────────────────────────────────────────────────── */

/** A visit registered at the desk for a saved patient. Returns it with its code. */
export async function createRequest(ctx, { patientId, complaint }) {
  const row = unwrap(
    await ctx.db.rpc('create_request', { p_patient_id: patientId, p_applicant: null, p_complaint: complaint }),
  );
  return get(ctx, row.id);
}

/** Save which patient a request belongs to (a new record, or an existing one). */
export async function setPatient(ctx, id, patientId) {
  unwrap(await ctx.db.rpc('set_screening_patient', { p_screening_id: id, p_patient_id: patientId }));
  return get(ctx, id);
}

/** Cancel a request no one has started. Administrator only (route and RLS). */
export async function cancel(ctx, id) {
  const current = unwrapOne(await ctx.db.from('screenings').select('id,status').eq('id', id).maybeSingle());
  if (current.status !== 'waiting') {
    throw ApiError.conflict('Hanya permintaan yang belum diperiksa yang bisa dibatalkan.');
  }
  const deleted = unwrap(await ctx.db.from('screenings').delete().eq('id', id).select('id'));
  if (!deleted.length) throw ApiError.notFound();
}

/* ── The examination ────────────────────────────────────────────────────── */

export async function start(ctx, id) {
  unwrap(await ctx.db.rpc('start_screening', { p_screening_id: id }));
  return get(ctx, id);
}

/** A screening this radiologist has taken and not yet submitted, or an error saying why not. */
async function loadOwnExamination(ctx, id) {
  const row = await loadRow(ctx, id);
  if (row.status === 'waiting') throw ApiError.conflict('Mulai pemeriksaan terlebih dahulu.');
  if (row.status !== 'examining') throw ApiError.conflict('Screening ini sudah dikirim ke antrean.');
  if (row.operator_id !== ctx.userId) {
    throw ApiError.forbidden('Permintaan ini sedang diperiksa radiolog lain.');
  }
  return row;
}

export async function saveExamination(ctx, id, input) {
  await loadOwnExamination(ctx, id);
  unwrapOne(
    await ctx.db
      .from('screenings')
      .update({ symptoms: input.symptoms, vitals: input.vitals, image_quality: input.imageQuality })
      .eq('id', id)
      .select('id')
      .maybeSingle(),
  );
  return get(ctx, id);
}

/**
 * A storage failure the caller can be told about. The raw error is logged for
 * whoever runs the deployment; the response does not echo the storage
 * service's own wording.
 */
function storageFailure(error, logger = console) {
  logger.error({ message: 'storage request failed', status: error?.statusCode ?? error?.status, detail: error?.message });
  if (/not found/i.test(error?.message ?? '')) return ApiError.notFound('File rontgen tidak ada di penyimpanan.');
  return new ApiError(502, 'STORAGE_ERROR', 'Penyimpanan gambar tidak bisa menyelesaikan permintaan itu.');
}

export async function uploadImage(ctx, id, file, fields, { bucket }) {
  const row = await loadOwnExamination(ctx, id);

  const kind = sniffImage(file.buffer);
  if (!kind) throw ApiError.validation({ image: ['Hanya gambar JPEG dan PNG yang diterima.'] });
  const size = readImageSize(file.buffer);

  const path = `${row.patient_id}/${row.id}/${randomUUID()}.${kind.ext}`;
  const upload = await ctx.admin.storage.from(bucket).upload(path, file.buffer, { contentType: kind.mime, upsert: false });
  if (upload.error) throw storageFailure(upload.error);

  const meta = {
    fileName: (fields.fileName || file.originalname || 'image').replace(/[^\w.\- ]/g, '_').slice(0, 120),
    sizeBytes: file.size,
    mimeType: kind.mime,
    // Dimensions come from the file itself, not from the request.
    width: size?.width ?? null,
    height: size?.height ?? null,
  };

  const { error } = await ctx.admin
    .from('screenings')
    .update({
      image_path: path,
      image_meta: meta,
      // A new image invalidates any earlier model output.
      model_status: 'not-run',
      analysis: null,
      analysed_at: null,
    })
    .eq('id', id);
  if (error) {
    await ctx.admin.storage.from(bucket).remove([path]).catch(() => {});
    throw error;
  }
  if (row.image_path) await ctx.admin.storage.from(bucket).remove([row.image_path]).catch(() => {});

  return get(ctx, id);
}

/**
 * Short-lived signed URL for the X-ray. Staff only (route); a screening the
 * caller cannot read is a 404 because the database returns no row.
 */
export async function signedImageUrl(ctx, id, { bucket, ttlSeconds }) {
  const row = unwrapOne(await ctx.db.from('screenings').select('image_path').eq('id', id).maybeSingle());
  if (!row.image_path) throw ApiError.notFound('Screening ini belum punya rontgen.');
  const { data, error } = await ctx.admin.storage.from(bucket).createSignedUrl(row.image_path, ttlSeconds);
  if (error || !data?.signedUrl) throw storageFailure(error ?? new Error('Could not sign image URL'));
  return { url: data.signedUrl, expiresInSeconds: ttlSeconds };
}

/* ── The model ──────────────────────────────────────────────────────────── */

async function loadForAnalysis(ctx, id) {
  const row = await loadOwnExamination(ctx, id);
  if (!row.image_path) throw ApiError.conflict('Unggah rontgen terlebih dahulu.');
  return row;
}

const setModelState = async (ctx, id, patch) => {
  const { error } = await ctx.admin.from('screenings').update(patch).eq('id', id);
  if (error) throw error;
};

/** Have the model service read the stored image (when one is configured). */
export async function analyze(ctx, id, { inference, bucket, logger = console }) {
  const row = await loadForAnalysis(ctx, id);
  if (row.model_status === 'pending') throw ApiError.conflict('Model sedang membaca rontgen ini.');

  if (!inference.configured) {
    await setModelState(ctx, id, { model_status: 'unavailable' });
    throw ApiError.unavailable('MODEL_NOT_CONNECTED', 'Model screening tidak terhubung ke server ini.');
  }

  await setModelState(ctx, id, { model_status: 'pending' });
  try {
    const download = await ctx.admin.storage.from(bucket).download(row.image_path);
    if (download.error) throw download.error;
    const bytes = Buffer.from(await download.data.arrayBuffer());
    const kind = sniffImage(bytes);
    const raw = await inference.analyze({ bytes, mime: kind?.mime ?? 'image/png', fileName: `${id}.${kind?.ext ?? 'png'}` });
    const analysis = toAnalysis(raw, readImageSize(bytes));
    await setModelState(ctx, id, { model_status: 'completed', analysis, analysed_at: analysis.analysedAt });
  } catch (error) {
    await setModelState(ctx, id, { model_status: 'failed' }).catch((inner) =>
      logger.error({ message: 'could not record model failure', code: inner?.code }),
    );
    throw error;
  }
  return get(ctx, id);
}

/**
 * Record an analysis the radiologist's browser computed.
 *
 * A serverless deployment has no room for the model, so it runs in the
 * browser and reports the three class probabilities and the areas it leaned
 * on. This is the one place the server stores model output it did not compute
 * itself, so it is held to what it can check: the scores form a distribution
 * (validator), the caller is the radiologist examining this visit, and
 * everything derived (leading class, outcome, risk point, zone names) is
 * worked out here and never taken from the request.
 */
export async function recordBrowserAnalysis(ctx, id, { probabilities, model, regions }) {
  await loadForAnalysis(ctx, id);

  const prediction = LABELS.reduce((best, label) => (probabilities[label] > probabilities[best] ? label : best));
  const analysis = toAnalysis(
    { prediction, probabilities, model: { classifier: model.name, backbone: model.backbone, version: model.version } },
    null,
  );
  analysis.regions = regions.map((region, index) => ({
    id: `occ-${index + 1}`,
    box: region.box,
    score: region.score,
    zone: zoneFor(region.box),
    label: region.label,
  }));
  analysis.detectionNote =
    prediction === 'Healthy'
      ? 'Kelas teratas adalah Sehat, jadi tidak ada area yang ditandai.'
      : regions.length
        ? null
        : 'Model tidak bertumpu pada satu area tertentu, jadi tidak ada kotak yang digambar.';

  await setModelState(ctx, id, { model_status: 'completed', analysis, analysed_at: analysis.analysedAt });
  return get(ctx, id);
}

/* ── The queue ──────────────────────────────────────────────────────────── */

export async function submit(ctx, id, { priority }) {
  unwrap(await ctx.db.rpc('submit_screening', { p_screening_id: id, p_priority: priority }));
  return get(ctx, id);
}

export async function markServed(ctx, id) {
  unwrap(await ctx.db.rpc('mark_served', { p_screening_id: id }));
  return get(ctx, id);
}
