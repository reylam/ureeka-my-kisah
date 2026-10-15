import { randomUUID } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { failure } from '../utils/response.js';

export function requestId() {
  return (req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}

/** Security headers. The API serves JSON only, so the CSP can be fully closed. */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

/** CORS limited to the configured frontend origin(s). */
export function corsPolicy(origins) {
  const allowed = new Set(origins);
  return cors({
    origin(origin, callback) {
      // Non-browser callers (curl, health checks, server-to-server) send no Origin.
      if (!origin || allowed.has(origin)) return callback(null, true);
      const error = new Error('Origin not allowed');
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
}

function limiter({ windowMs, max, code = 'RATE_LIMITED' }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      failure(res, 429, code, 'Too many requests. Please wait a moment and try again.'),
  });
}

export const generalLimiter = (config) => limiter(config.rateLimit);

/** Uploads and model calls are the expensive endpoints; keep them tighter. */
export const heavyLimiter = (config) =>
  limiter({ windowMs: config.rateLimit.windowMs, max: config.rateLimit.heavyMax });
