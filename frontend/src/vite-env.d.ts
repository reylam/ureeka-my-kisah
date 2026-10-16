/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL including the version prefix, e.g. http://localhost:4000/api/v1 */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** Public anon key. The service-role key must never be set here. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
