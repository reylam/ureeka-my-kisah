import { ApiError, fromDbError } from '../utils/ApiError.js';

/**
 * Authentication.
 *
 * The browser signs in with Supabase Auth and sends the access token as a
 * Bearer token. This middleware:
 *
 *   1. asks Supabase to verify the token (auth.getUser), so a forged,
 *      expired or revoked token is rejected whatever its claims say;
 *   2. loads the caller's profile through a client that carries their JWT
 *      (so even this read is subject to RLS);
 *   3. refuses suspended accounts;
 *   4. exposes `req.auth` with the role, the staff record and the patient id.
 *
 * The role comes from `profiles.role` in the database. Nothing in the token's
 * user_metadata or in the request is ever used for authorisation, because the
 * client controls both.
 */

const PROFILE_COLUMNS = 'id,email,full_name,role,status,created_at,last_sign_in_at';

function readBearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length) return null;
  return token;
}

/** `iat` of a token that has already been verified. Used only for bookkeeping. */
export function tokenIssuedAt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.iat === 'number' ? payload.iat : null;
  } catch {
    return null;
  }
}

export async function loadSession(gateway, token) {
  const { data, error } = await gateway.anon.auth.getUser(token);
  if (error || !data?.user) throw ApiError.unauthorized('Your session is not valid. Please sign in again.');

  const db = gateway.forUser(token);

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw fromDbError(profileError) ?? profileError;
  if (!profile) throw ApiError.unauthorized('Your session is not valid. Please sign in again.');
  if (profile.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended. Contact an administrator.');
  }

  let staff = null;
  if (profile.role === 'professional' || profile.role === 'admin') {
    const { data: row, error: staffError } = await db
      .from('healthcare_professional_profiles')
      .select('clinical_role,can_review,facility_id,phone')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (staffError) throw fromDbError(staffError) ?? staffError;
    if (row) {
      staff = {
        clinicalRole: row.clinical_role,
        // An administrator never holds clinical sign-off, whatever the row says.
        canReview: profile.role === 'professional' && row.can_review === true,
        facilityId: row.facility_id,
        phone: row.phone,
      };
    }
  }

  let patientId = null;
  if (profile.role === 'patient') {
    const { data: row, error: patientError } = await db
      .from('patient_profiles')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (patientError) throw fromDbError(patientError) ?? patientError;
    patientId = row?.id ?? null;
  }

  return {
    token,
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status,
    createdAt: profile.created_at,
    lastSignInAt: profile.last_sign_in_at,
    staff,
    patientId,
    db,
    admin: gateway.admin,
  };
}

/** Require a valid session. */
export function requireAuth() {
  return async (req, _res, next) => {
    try {
      const token = readBearer(req);
      if (!token) throw ApiError.unauthorized();
      req.auth = await loadSession(req.app.locals.supabase, token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Attach a session if a token is present, but let anonymous callers through.
 * A token that is present and invalid is still a 401, so a broken client is
 * told instead of silently seeing public data.
 */
export function optionalAuth() {
  return async (req, _res, next) => {
    try {
      const token = readBearer(req);
      req.auth = token ? await loadSession(req.app.locals.supabase, token) : null;
      next();
    } catch (error) {
      next(error);
    }
  };
}
