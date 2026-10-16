import express from 'express';
import { createSupabaseGateway } from './config/supabase.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { corsPolicy, requestId, securityHeaders } from './middleware/security.js';
import { buildRouter } from './routes/index.js';
import { createInferenceClient } from './services/inferenceService.js';

export const API_PREFIX = '/api/v1';

/**
 * Build the Express application.
 *
 * Everything with a side effect (Supabase, the inference service, the logger)
 * can be passed in, which is how the tests run the real middleware and routes
 * against fakes without a network or a database.
 */
export function createApp({
  config,
  gateway = createSupabaseGateway(config.supabase),
  inference = createInferenceClient(config.inference),
  logger = console,
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.supabase = gateway;
  app.locals.config = config;

  app.use(requestId());
  app.use(securityHeaders());
  app.use(corsPolicy(config.frontendOrigins));
  // Clinical payloads are small JSON documents; images use multipart.
  app.use(express.json({ limit: '100kb' }));

  app.use(API_PREFIX, buildRouter({ config, inference }));

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
