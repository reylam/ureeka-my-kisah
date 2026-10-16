/**
 * Browser harness: the real frontend (Vite dev server) in a real browser
 * (the Edge or Chrome already on this machine, driven with playwright-core),
 * talking to the real backend, PostgREST and migrations from tests/e2e/stack.js.
 *
 * Nothing to download: no browser binaries are fetched. The suite skips itself
 * when PostgREST or a browser cannot be found.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium } from 'playwright-core';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { ANON_KEY, SERVICE_KEY, stackAvailable, startStack } from '../e2e/stack.js';

const here = dirname(fileURLToPath(import.meta.url));
export const FRONTEND_DIR = join(here, '..', '..', '..', 'frontend');
export const SCREENSHOTS = join(here, '..', '..', '.tools', 'screens');

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
export const browserPath = BROWSERS.find((p) => existsSync(p));
export const frontendReady = existsSync(join(FRONTEND_DIR, 'node_modules', 'vite', 'bin', 'vite.js'));
export const canRun = stackAvailable && Boolean(browserPath) && frontendReady;
export const skipReason = canRun
  ? false
  : 'needs PostgREST (npm run e2e:setup), an installed Edge/Chrome, and frontend dependencies';

/** A small valid PNG, so the file input has something the browser can decode. */
export function makePng(width = 64, height = 48) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(8 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) rows[y * (width + 1) + 1 + x] = (x * 3 + y * 5) % 256;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function waitForHttp(url, child, label, ms = 60_000) {
  const end = Date.now() + ms;
  let log = '';
  child.stdout?.on('data', (d) => (log += d));
  child.stderr?.on('data', (d) => (log += d));
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`${label} exited:\n${log}`);
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${label} did not start:\n${log}`);
}

export async function launchBackend({ vitePort = 5199 } = {}) {
  const origin = `http://localhost:${vitePort}`;
  const stack = await startStack();

  const config = loadConfig({
    NODE_ENV: 'test',
    SUPABASE_URL: stack.url,
    SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    FRONTEND_ORIGIN: origin,
  });
  const app = createApp({ config, logger: { error() {}, info() {}, warn() {} } });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return {
    stack,
    origin,
    apiUrl: `http://127.0.0.1:${server.address().port}/api/v1`,
    async close() {
      server.close();
      await stack.stop();
    },
  };
}

export async function startFrontend({ vitePort, stack, apiUrl }) {
  const vite = spawn(process.execPath, [join(FRONTEND_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(vitePort), '--strictPort', '--host', 'localhost'], {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      VITE_API_BASE_URL: apiUrl,
      VITE_SUPABASE_URL: stack.url,
      VITE_SUPABASE_ANON_KEY: ANON_KEY,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForHttp(`http://localhost:${vitePort}/`, vite, 'vite');
  return vite;
}

export async function openBrowser() {
  mkdirSync(SCREENSHOTS, { recursive: true });
  return chromium.launch({ executablePath: browserPath, headless: true });
}
