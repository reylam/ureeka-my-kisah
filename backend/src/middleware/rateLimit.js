import { ApiError } from '../utils/ApiError.js';

/**
 * Fixed-window limit per client address, for the two routes anyone can call
 * without an account: the request form (which writes rows) and the result
 * lookup (which an attacker would use to guess codes).
 *
 * The counts live in this process. On a serverless host each instance keeps
 * its own, so the limit is per instance: it slows a script down, it is not a
 * hard quota. Behind a proxy, TRUST_PROXY must be on for `req.ip` to be the
 * client and not the proxy.
 */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Forget expired windows now and then, so the map cannot grow without end.
    if (hits.size > 5000) {
      for (const [address, value] of hits) if (value.resetAt <= now) hits.delete(address);
    }

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(ApiError.tooManyRequests(message));
    }
    next();
  };
}
