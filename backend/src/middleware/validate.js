import { ApiError } from '../utils/ApiError.js';

/**
 * Validate params, query and body against Zod schemas.
 *
 * Parsed values land on `req.valid` rather than overwriting `req.body` /
 * `req.query` (Express 5 makes `req.query` read-only), and unknown keys are
 * stripped, so a handler can only ever see fields the schema names. That is
 * also what keeps a stray `role` in a payload from going anywhere.
 */
export function validate({ params, query, body } = {}) {
  return (req, _res, next) => {
    const valid = {};
    const issues = {};

    for (const [key, schema, input] of [
      ['params', params, req.params],
      ['query', query, req.query],
      ['body', body, req.body],
    ]) {
      if (!schema) continue;
      const result = schema.safeParse(input ?? {});
      if (result.success) {
        valid[key] = result.data;
      } else {
        for (const issue of result.error.issues) {
          const path = [key === 'body' ? null : key, ...issue.path].filter((p) => p !== null).join('.');
          (issues[path || key] ??= []).push(issue.message);
        }
      }
    }

    if (Object.keys(issues).length) return next(ApiError.validation(issues));
    req.valid = valid;
    next();
  };
}
