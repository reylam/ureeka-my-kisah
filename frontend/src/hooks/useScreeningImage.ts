import { useEffect, useState } from 'react';
import type { Screening } from '@/types/domain';
import { getImageUrl } from '@/services/imageStore';

export interface ScreeningImage {
  /** Object URL for a user-uploaded radiograph, when one exists. */
  url: string | null;
  /** Identifier of the bundled synthetic radiograph, for seed records. */
  sample: Screening['sampleImage'];
  loading: boolean;
  /** True when the record has neither, e.g. an abandoned draft. */
  missing: boolean;
}

/**
 * Resolve the image for a screening record.
 *
 * Uploaded images live in IndexedDB, so this is genuinely asynchronous and the
 * loading flag drives a real skeleton rather than a decorative one. Seed
 * records instead name one of the bundled synthetic radiographs, which render
 * as inline SVG and need no fetch.
 */
export function useScreeningImage(screening: Screening | null | undefined): ScreeningImage {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(screening?.imageKey));

  const imageKey = screening?.imageKey ?? null;

  useEffect(() => {
    if (!imageKey) {
      setUrl(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    getImageUrl(imageKey)
      .then((resolved) => {
        if (active) {
          setUrl(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setUrl(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [imageKey]);

  const sample = screening?.sampleImage ?? null;

  return {
    url,
    sample,
    loading,
    missing: !loading && !url && !sample,
  };
}
