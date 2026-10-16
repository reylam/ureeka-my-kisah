import express from 'express';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

/**
 * Vercel serverless entry point.
 *
 * Vercel does not run server.js or app.listen(); it imports this module and
 * calls the exported handler per request. If the environment variables are
 * missing we answer with a readable JSON error instead of crashing, so the
 * deployment can be diagnosed from the browser.
 */
let app;
try {
  const config = loadConfig();
  // Vercel always sits behind a proxy.
  config.trustProxy = true;
  const api = createApp({ config });

  app = express();
  app.get('/', (_req, res) =>
    res.json({ name: 'PARUPINTAS API', status: 'ok', health: '/api/v1/health' }),
  );
  app.use(api);
} catch (error) {
  console.error(error.message);
  app = express();
  app.use((_req, res) => {
    res.status(500).json({ error: 'Server misconfigured', detail: error.message });
  });
}

export default app;
