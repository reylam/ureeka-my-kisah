/**
 * IndexedDB-backed store for uploaded chest radiographs.
 *
 * Why not localStorage: radiographs are large and localStorage is a synchronous
 * 5 MB string store, so putting images there would both blow the quota and
 * block the main thread. IndexedDB holds Blobs natively.
 *
 * Privacy posture for this prototype: images stay in the browser's own storage
 * on this device and are never uploaded anywhere. That is NOT the same thing as
 * a secured backend. Browser storage is readable by anyone with access to the
 * device profile, and the service worker is deliberately configured never to
 * cache these records. Clearing demo data (Settings → Reset) removes them.
 */

import { clear, del, get, keys, set } from 'idb-keyval';

const PREFIX = 'cxr:';

/** Live object URLs, so we can revoke them instead of leaking them. */
const urlCache = new Map<string, string>();

export function imageKeyFor(id: string): string {
  return `${PREFIX}${id}`;
}

export async function putImage(key: string, blob: Blob): Promise<void> {
  await set(key, blob);
}

export async function getImage(key: string): Promise<Blob | undefined> {
  return get<Blob>(key);
}

/**
 * Resolve a storage key to a displayable object URL, caching the result so
 * repeated renders of the same image do not allocate new URLs.
 */
export async function getImageUrl(key: string): Promise<string | null> {
  const cached = urlCache.get(key);
  if (cached) return cached;

  const blob = await getImage(key);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export async function deleteImage(key: string): Promise<void> {
  releaseUrl(key);
  await del(key);
}

export function releaseUrl(key: string): void {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

/** Total bytes held in the image store, surfaced in Settings. */
export async function getStorageUsage(): Promise<{ count: number; bytes: number }> {
  const allKeys = await keys();
  const imageKeys = allKeys.filter(
    (k): k is string => typeof k === 'string' && k.startsWith(PREFIX),
  );
  let bytes = 0;
  for (const key of imageKeys) {
    const blob = await getImage(key);
    if (blob) bytes += blob.size;
  }
  return { count: imageKeys.length, bytes };
}

export async function clearImages(): Promise<void> {
  for (const key of urlCache.keys()) releaseUrl(key);
  await clear();
}
