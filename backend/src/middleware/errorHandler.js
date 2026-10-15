import { ZodError } from 'zod';
import { ApiError, fromDbError } from '../utils/ApiError.js';
import { failure } from '../utils/response.js';

export function notFoundHandler(_req, _res, next) {
  next(ApiError.notFound('No such endpoint.'));
}

/**
 * Single place errors become responses.
 *
 * Expected failures (ApiError, validation, upload limits, database rules) are
 * answered with their own status. Everything else is a bug: log it with the
 * request id and answer with a generic message so no internals leak.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, _next) => {
    if (res.headersSent) return;

    if (error instanceof ApiError) {
      return failure(res, error.status, error.code, error.message, error.details);
    }

    if (error instanceof ZodError) {
      const details = {};
      for (const issue of error.issues) (details[issue.path.join('.') || 'body'] ??= []).push(issue.message);
      return failure(res, 422, 'VALIDATION_ERROR', 'Validation failed.', details);
    }

    // body-parser
    if (error?.type === 'entity.parse.failed') {
      return failure(res, 400, 'BAD_REQUEST', 'The request body is not valid JSON.');
    }
    if (error?.type === 'entity.too.large') {
      return failure(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }

    // multer
    if (error?.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return failure(res, 413, 'PAYLOAD_TOO_LARGE', 'The file is too large.');
      }
      return failure(res, 400, 'BAD_REQUEST', 'The upload could not be read.');
    }

    // CORS
    if (error?.code === 'CORS_ORIGIN_DENIED') {
      return failure(res, 403, 'FORBIDDEN', 'This origin is not allowed.');
    }

    const mapped = fromDbError(error);
    if (mapped) return failure(res, mapped.status, mapped.code, mapped.message, mapped.details);

    logger.error({
      requestId: req.id,
      method: req.method,
      path: req.path,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return failure(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side.');
  };
}
