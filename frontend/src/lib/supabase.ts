import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isAuthConfigured } from './env';

/**
 * The one Supabase client. Used for authentication only (sign up, sign in,
 * session restore, sign out). All application data goes through the backend
 * API, never straight to the database, so the backend's checks always apply.
 *
 * `null` when the project is not configured; callers go through
 * `requireSupabase` so the failure is a readable message instead of a crash at
 * import time.
 */
export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'pulmo.auth',
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.',
    );
  }
  return supabase;
}
