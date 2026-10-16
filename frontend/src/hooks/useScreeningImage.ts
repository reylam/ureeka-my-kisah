import { useEffect, useState } from 'react';
import type { Screening } from '@/types/domain';
import { getScreeningImageUrl } from '@/services/recordsApi';

export interface ScreeningImage {
  url: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * The X-ray of a visit, from private storage through a short-lived signed URL.
 * The URL expires, so it is asked for when the page opens and kept nowhere.
 */
export function useScreeningImage(screening: Pick<Screening, 'id' | 'hasImage' | 'imageMeta'> | null): ScreeningImage {
  const [state, setState] = useState<ScreeningImage>({ url: null, loading: false, error: null });
  const id = screening?.id ?? null;
  const hasImage = screening?.hasImage ?? false;
  // A new upload replaces the file; the meta changes with it.
  const version = screening?.imageMeta?.fileName ?? '';

  useEffect(() => {
    if (!id || !hasImage) {
      setState({ url: null, loading: false, error: null });
      return undefined;
    }
    let active = true;
    setState({ url: null, loading: true, error: null });
    getScreeningImageUrl(id)
      .then((url) => active && setState({ url, loading: false, error: null }))
      .catch((cause: unknown) => {
        if (active) {
          setState({ url: null, loading: false, error: cause instanceof Error ? cause.message : 'Gambar gagal dimuat.' });
        }
      });
    return () => {
      active = false;
    };
  }, [id, hasImage, version]);

  return state;
}
