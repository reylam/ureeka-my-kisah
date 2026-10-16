/**
 * Browser-visible configuration.
 *
 * Only values that are safe to ship to every visitor belong here: the API
 * address, the Supabase project URL and the Supabase *anon* key. The anon key
 * is public by design; what protects the data is Row Level Security on the
 * database and the authorisation checks in the backend. The service-role key
 * must never appear in this app, in `.env`, or in a build.
 */

const read = (value: string | undefined) => (value ?? '').trim();

export const env = {
  apiBaseUrl:
    read(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '') || 'http://localhost:4000/api/v1',
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
};

/** False when the Supabase variables are missing, so sign-in can say so plainly. */
export const isAuthConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
