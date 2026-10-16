import { z } from 'zod';

/**
 * Environment configuration.
 *
 * Parsed once at start-up so a missing or malformed value stops the process
 * with a readable message instead of failing on the first request.
 */

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  // Server only. Never ship this to the browser.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Comma-separated list of browser origins allowed to call the API.
  FRONTEND_ORIGIN: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean),
    ),

  TRUST_PROXY: boolish.default(false),

  STORAGE_BUCKET: z.string().min(1).default('screening-images'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(15),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),

  // Optional. Without it POST /screenings/:id/analyze answers 503 and records
  // that the model step did not run. Nothing is ever simulated server-side.
  INFERENCE_SERVICE_URL: z.url().optional().or(z.literal('').transform(() => undefined)),
  INFERENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // Sent as a Bearer token to the inference service, which should require it
  // whenever it is reachable beyond loopback.
  INFERENCE_API_KEY: z.string().min(16).optional().or(z.literal('').transform(() => undefined)),
});

export function loadConfig(source = process.env) {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;

  // Catch the two Supabase keys being pasted into each other's variable. The
  // service-role key is the one that can write storage and model output, so
  // with them swapped sign-in still works and then every server-side write
  // fails with an unhelpful 500. Keys that are not JWTs (the newer sb_*
  // format, or test placeholders) cannot be checked this way and are skipped.
  const roleOf = (key) => {
    try {
      return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role ?? null;
    } catch {
      return null;
    }
  };
  const anonRole = roleOf(env.SUPABASE_ANON_KEY);
  const serviceRole = roleOf(env.SUPABASE_SERVICE_ROLE_KEY);
  if (anonRole === 'service_role' || serviceRole === 'anon') {
    throw new Error(
      'Invalid environment configuration:\n' +
        '  - SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY look swapped ' +
        `(the first carries role "${anonRole}", the second "${serviceRole}"). ` +
        'SUPABASE_ANON_KEY must be the "anon" key and SUPABASE_SERVICE_ROLE_KEY the "service_role" key.',
    );
  }
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    frontendOrigins: env.FRONTEND_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    storage: {
      bucket: env.STORAGE_BUCKET,
      maxUploadBytes: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024),
      signedUrlTtlSeconds: env.SIGNED_URL_TTL_SECONDS,
    },
    inference: {
      url: env.INFERENCE_SERVICE_URL ?? null,
      timeoutMs: env.INFERENCE_TIMEOUT_MS,
      apiKey: env.INFERENCE_API_KEY ?? null,
    },
  };
}
