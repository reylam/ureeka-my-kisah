import { ApiError } from '../utils/ApiError.js';

/**
 * Role guard. Runs after `requireAuth` and gives a clear 403 early; the
 * database policies and functions remain the enforcement of last resort.
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}
