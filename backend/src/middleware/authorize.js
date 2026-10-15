import { ApiError } from '../utils/ApiError.js';

/**
 * Role and capability guards. They run after `requireAuth` and give a clear
 * 403 early; the database policies remain the enforcement of last resort.
 */

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}

/**
 * Professionals must also have a staff record to act clinically: it carries
 * the facility that decides which patients they are assigned to.
 */
export function requireStaffRecord() {
  return (req, _res, next) => {
    if (!req.auth?.staff) {
      return next(
        ApiError.forbidden('Your account has no staff record yet. Ask an administrator to set one up.'),
      );
    }
    next();
  };
}

/** Only staff whose record allows clinical sign-off (never an administrator). */
export function requireCanReview() {
  return (req, _res, next) => {
    if (req.auth?.role !== 'professional' || !req.auth.staff?.canReview) {
      return next(ApiError.forbidden('Only a reviewing clinician can sign off a screening.'));
    }
    next();
  };
}
