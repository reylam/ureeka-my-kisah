import { createClient } from '@supabase/supabase-js';

/**
 * Supabase clients.
 *
 * Three kinds, deliberately kept apart:
 *
 *   anon        verifies a JWT (auth.getUser) and serves public reads.
 *   forUser     carries the caller's JWT, so every query runs as that user
 *               and Row Level Security applies. This is the default for
 *               anything that reads or writes on a user's behalf.
 *   admin       the service role. It bypasses RLS, so it is used only for
 *               operations a user cannot do themselves (the public request form,
 *               image storage, model output) and only after the calling code
 *               has made its own authorisation decision.
 *
 * `createSupabaseGateway` returns a plain object so tests can substitute fakes.
 */

const baseOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function createSupabaseGateway({ url, anonKey, serviceRoleKey }) {
  const anon = createClient(url, anonKey, baseOptions);
  const admin = createClient(url, serviceRoleKey, baseOptions);

  return {
    anon,
    admin,
    forUser(token) {
      return createClient(url, anonKey, {
        ...baseOptions,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    },
  };
}
