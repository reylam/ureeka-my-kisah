import { ApiError, fromDbError } from '../utils/ApiError.js';

/**
 * Authentication, for staff only. Patients have no account: they use an access
 * code on the public routes.
 *
 * The browser signs in with Supabase Auth and sends the access token as a
 * Bearer token. This middleware:
 *
 *   1. asks Supabase to verify the token (auth.getUser), so a forged, expired
 *      or revoked token is rejected whatever its claims say;
 *   2. loads the caller's profile through a client that carries their JWT, so
 *      even this read is subject to RLS;
 *   3. refuses suspended accounts and accounts with no role;
 *   4. exposes `req.auth`.
 *
 * The role comes from `profiles.role` in the database, never from the token's
 * metadata or the request, because the client controls both.
 */

const PROFILE_COLUMNS = 'id,email,full_name,role,status';

function readBearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length) return null;
  return token;
}

export async function loadSession(gateway, token) {
  const { data, error } = await gateway.anon.auth.getUser(token);
  if (error || !data?.user) throw ApiError.unauthorized('Sesi kamu tidak valid. Silakan masuk lagi.');

  const db = gateway.forUser(token);
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw fromDbError(profileError) ?? profileError;
  if (!profile) throw ApiError.unauthorized('Sesi kamu tidak valid. Silakan masuk lagi.');
  if (profile.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Akun ini ditangguhkan. Hubungi administrator.');
  }
  if (!profile.role) {
    throw new ApiError(403, 'NO_ROLE', 'Akun ini belum diberi akses petugas. Hubungi administrator.');
  }

  return {
    token,
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    db,
    admin: gateway.admin,
  };
}

/** Require a valid staff session. */
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
