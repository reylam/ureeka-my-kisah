/**
 * Run PARUPINTAS locally WITHOUT Docker or the Supabase CLI.
 *
 *   npm run e2e:setup      # once: downloads the PostgREST binary
 *   npm run dev:local      # starts the database, REST API, auth stand-in and the PARUPINTAS API
 *
 * What you get: the real migrations and seed in an in-process Postgres (PGlite),
 * the real PostgREST in front of it, and the real PARUPINTAS backend. The sign-in
 * service and file storage are small stand-ins (see tests/e2e/stack.js), which
 * is why this is a DEVELOPMENT convenience only:
 *
 *   - data lives in memory and resets every time this process restarts;
 *   - tokens are signed with a published development secret;
 *   - there is no e-mail confirmation or password reset.
 *
 * Use the Supabase CLI (`supabase start`) or a hosted project for anything else.
 */

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { ANON_KEY, SERVICE_KEY, stackAvailable, startStack } from '../tests/e2e/stack.js';

if (!stackAvailable) {
  console.error('PostgREST is not installed. Run `npm run e2e:setup` first.');
  process.exit(1);
}

const GATEWAY_PORT = Number(process.env.LOCAL_SUPABASE_PORT ?? 54321);
const API_PORT = Number(process.env.PORT ?? 4000);
const FRONTEND = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

const stack = await startStack({ seed: 'full', gatewayPort: GATEWAY_PORT });

const config = loadConfig({
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  SUPABASE_URL: stack.url,
  SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  FRONTEND_ORIGIN: FRONTEND,
  ...(process.env.INFERENCE_SERVICE_URL
    ? { INFERENCE_SERVICE_URL: process.env.INFERENCE_SERVICE_URL, INFERENCE_API_KEY: process.env.INFERENCE_API_KEY ?? '' }
    : {}),
});
const app = createApp({ config });
const server = app.listen(API_PORT, '127.0.0.1', () => {
  console.log(`
PARUPINTAS local stack is running (development only, data resets on restart)

  database + REST + auth : ${stack.url}
  PARUPINTAS API              : http://127.0.0.1:${API_PORT}/api/v1
  model                  : ${config.inference.url ?? 'not connected (set INFERENCE_SERVICE_URL to use tb_ai.serve)'}

Put this in frontend/.env, then run \`npm run dev\` in frontend/:

  VITE_API_BASE_URL=http://127.0.0.1:${API_PORT}/api/v1
  VITE_SUPABASE_URL=${stack.url}
  VITE_SUPABASE_ANON_KEY=${ANON_KEY}

Sample sign-ins (frontend/docs/accounts.md):
  patient@parupintas.test / Patient123!    doctor@parupintas.test / Doctor123!
  chw@parupintas.test / Worker123!         admin@parupintas.test / Admin123!

Ctrl+C to stop.
`);
});

async function shutdown() {
  server.close();
  await stack.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
