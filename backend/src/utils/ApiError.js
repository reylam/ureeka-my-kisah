/**
 * An error that is safe to show to the caller.
 *
 * Anything that is not an ApiError is treated as a bug: it is logged in full
 * and answered with a generic 500, so internals never reach the response.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'The request is not valid.', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication is required.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'The request conflicts with the current state.', details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static validation(details, message = 'Validation failed.') {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
  static unavailable(code, message) {
    return new ApiError(503, code, message);
  }
}

/**
 * Translate a Postgres / PostgREST error into an ApiError.
 *
 * Row Level Security turns "not allowed to see this row" into "no row", which
 * is why a missing row is reported as 404 and never as 403: the API must not
 * confirm that a record the caller cannot read exists.
 */
export function fromDbError(error) {
  if (!error) return null;
  if (error instanceof ApiError) return error;

  const code = error.code ?? '';
  const message = String(error.message ?? '');

  if (code === 'PGRST116' || code === 'P0002') return ApiError.notFound();
  if (code === '42501') {
    if (/administrator|own role|own status|Forbidden|Illegal|Immutable/i.test(message)) {
      return ApiError.forbidden(safeMessage(message));
    }
    return ApiError.forbidden();
  }
  if (code === '23505') return ApiError.conflict('That record already exists.');
  if (code === '23503') return ApiError.conflict('The record refers to something that does not exist or is still in use.');
  if (code === '23514') return ApiError.conflict(safeMessage(message));
  if (code === '22023' || code === '22P02' || code === '22007' || code === '23502') {
    return ApiError.badRequest('A value in the request is not valid.');
  }
  return null;
}

// Messages raised by our own SQL functions are written to be shown. Anything
// else is replaced rather than echoed.
function safeMessage(message) {
  const known = [
    /The last active administrator cannot be (demoted|suspended)/i,
    /You cannot change your own (role|status)/i,
    /Only an administrator can change the home facility/i,
    /Consent to data use is required/i,
    /Personal and address details are required before completing/i,
    /Screening is not open for review/i,
    /Screening does not belong to this patient/i,
    /Referral does not belong to this patient/i,
    /Illegal screening status change/i,
    /Immutable (patient|screening) fields cannot be changed/i,
  ];
  const hit = known.find((pattern) => pattern.test(message));
  return hit ? message.match(hit)[0] : 'The request conflicts with the current state.';
}
