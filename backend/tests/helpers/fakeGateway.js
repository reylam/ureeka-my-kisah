/**
 * Configuration for tests that build the app or its parts without a real
 * Supabase project behind them.
 */

import { loadConfig } from '../../src/config/env.js';

export const TEST_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon-key-for-tests-0000000000',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key-for-tests-000000000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
};

export const testConfig = (overrides = {}) => loadConfig({ ...TEST_ENV, ...overrides });

/** Listen on a free port and return a small JSON client for /api/v1. */
export async function startServer(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function call(method, path, { token, body, form } = {}) {
    const init = { method, headers: {} };
    if (token) init.headers.Authorization = `Bearer ${token}`;
    if (form) init.body = form;
    else if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${base}${path}`, init);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, headers: response.headers };
  }

  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}
