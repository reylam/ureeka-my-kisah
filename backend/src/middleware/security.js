import { randomUUID } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';

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
