/**
 * Response envelope.
 *
 *   success  { success: true,  data, meta? }
 *   failure  { success: false, error: { code, message, details? } }
 */

export function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res, data) {
  return ok(res, data, undefined, 201);
}

export function noContent(res) {
  return res.status(204).end();
}

export function failure(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(status).json({ success: false, error });
}
