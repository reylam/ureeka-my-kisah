import { useCallback, useRef, useState } from 'react';
import SAMPLE_URLS from 'virtual:sample-images';

/**
 * "Pakai contoh gambar": a random X-ray from `public/test/`.
 *
 * The file is fetched and handed to the normal upload path as a `File`, so it
 * goes through exactly the same checks as a visitor's own image. A second
 * press never picks the image already on screen, as long as there is another.
 */

export const SAMPLE_COUNT = SAMPLE_URLS.length;

const nameOf = (url: string) => decodeURIComponent(url.slice(url.lastIndexOf('/') + 1));

/** Whether a file name is one of the samples. */
export function isSampleFile(name: string): boolean {
  return SAMPLE_URLS.some((url) => nameOf(url) === name);
}

export function useSampleImage(onFile: (file: File) => void): {
  load: () => void;
  isLoading: boolean;
  error: string | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!SAMPLE_URLS.length) {
      setError('Belum ada contoh gambar. Taruh file JPG atau PNG di folder public/test.');
      return;
    }
    const pool = SAMPLE_URLS.length > 1 ? SAMPLE_URLS.filter((url) => url !== last.current) : SAMPLE_URLS;
    const url = pool[Math.floor(Math.random() * pool.length)]!;
    last.current = url;

    setError(null);
    setIsLoading(true);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        const name = nameOf(url);
        const type = blob.type || (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg');
        onFile(new File([blob], name, { type }));
      })
      .catch(() => setError('Contoh gambar tidak bisa diunduh. Coba lagi.'))
      .finally(() => setIsLoading(false));
  }, [onFile]);

  return { load, isLoading, error };
}
