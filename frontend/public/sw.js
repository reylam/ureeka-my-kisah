/* eslint-disable no-undef */
/**
 * Service worker: application shell only.
 *
 * Scope of what this caches, deliberately narrow:
 *   • the HTML entry document, so the app opens with no connection
 *   • Vite's hashed build assets under /assets/ (immutable by definition)
 *   • the icons and manifest
 *
 * What it must never cache:
 *   • patient records, screening records, referrals, follow-ups
 *   • chest radiographs or any other image a user uploads
 *
 * Those live in IndexedDB and localStorage under the application's own control,
 * where they can be inspected and wiped from Settings → Reset demo data. Copying
 * them into an opaque HTTP cache would scatter clinical data into a store the UI
 * cannot show or clear, so request handling below bails out for anything that is
 * not a shell asset.
 */

const VERSION = 'sentratb-shell-v1';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/mark.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Only same-origin GETs for shell assets are eligible for caching. */
function isShellAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations: try the network so updates land, fall back to the cached
  // shell when there is no connection. The SPA then renders from local storage.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(VERSION);
        return (await cache.match('/index.html')) ?? (await cache.match('/')) ?? Response.error();
      }),
    );
    return;
  }

  if (!isShellAsset(url)) return;

  // Hashed assets never change under the same URL, so cache-first is safe.
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    }),
  );
});
