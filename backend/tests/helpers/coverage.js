/**
 * Route coverage for the end-to-end tests: which registered endpoints answered
 * a request successfully, and which were never exercised.
 *
 * The route list is read from the real Express router, so a route added later
 * without a test shows up as missing instead of silently untested.
 */

import { buildRouter } from '../../src/routes/index.js';

/** Every "METHOD /pattern" the router registers, e.g. "PATCH /accounts/:id/role". */
export function registeredRoutes() {
  const router = buildRouter({
    config: { storage: { maxUploadBytes: 1024 } },
    inference: { configured: false },
  });
  const routes = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push(`${method.toUpperCase()} ${layer.route.path}`);
    }
  }
  return routes.sort();
}

const toRegex = (pattern) =>
  new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, '[^/]+')}$`);

export function createRecorder() {
  const routes = registeredRoutes();
  const matchers = routes.map((route) => {
    const [method, pattern] = route.split(' ');
    return { route, method, regex: toRegex(pattern) };
  });
  const hit = new Map(); // route -> successful call count
  const unmatched = [];

  return {
    routes,
    record(method, rawPath, status) {
      const path = rawPath.split('?')[0];
      const found = matchers.find((m) => m.method === method.toUpperCase() && m.regex.test(path));
      if (!found) {
        unmatched.push(`${method} ${path}`);
        return;
      }
      if (status >= 200 && status < 300) hit.set(found.route, (hit.get(found.route) ?? 0) + 1);
    },
    missing: () => routes.filter((route) => !hit.has(route)),
    unmatched: () => [...new Set(unmatched)],
    hits: () => hit,
  };
}
