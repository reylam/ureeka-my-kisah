/* eslint-disable no-undef */
/**
 * Retired service worker.
 *
 * Earlier builds registered a worker here to cache the application shell for
 * offline use. Offline mode has been removed, and the app no longer registers
 * any worker, but a browser that installed the old one keeps it until it is
 * replaced. Browsers re-check this file on navigation, so serving this version
 * makes every old installation clear its caches, unregister itself and reload
 * the page from the network.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) client.navigate(client.url);
    })(),
  );
});
