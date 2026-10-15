/**
 * Register the application-shell service worker.
 *
 * Only runs in a production build: during development Vite serves modules that
 * must not be cached, and a stale shell is a confusing way to lose an hour.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      // A failed registration costs offline shell caching but nothing else, so
      // this degrades quietly rather than interrupting the user.
      console.warn('Service worker registration failed:', error);
    });
  });
}

/** Used by Settings to drop the cached shell as part of a full demo reset. */
export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
