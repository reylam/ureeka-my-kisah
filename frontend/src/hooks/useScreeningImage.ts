import { useEffect, useState } from 'react';
import type { Screening } from '@/types/domain';
import { getImageUrl } from '@/services/imageStore';
import { recordsApi } from '@/services/recordsApi';

export interface ScreeningImage {
  /** URL for the radiograph, when one exists and could be loaded. */
  url: string | null;
  /** Identifier of a bundled synthetic radiograph, for records that name one. */
  sample: Screening['sampleImage'];
  loading: boolean;
  /** True when the record has neither, e.g. an abandoned draft. */
  missing: boolean;
  /** Set when the image exists but could not be fetched. */
  error: string | null;
}

/**
 * Resolve the image for a screening record.
 *
 * Two places an image can be:
 *  - on this device (IndexedDB), for a record captured offline that has not
 *    been sent yet; its key starts with `cxr:`;
 *  - on the server, in private storage. The record's `imageKey` is then just
 *    its own id, and the picture is fetched through a short-lived signed URL
 *    that the API only issues to the treating team after writing an audit entry.
 *
 * Signed URLs expire, so the URL is requested when the record is opened and not
 * kept anywhere.
 */
export function useScreeningImage(screening: Screening | null | undefined): ScreeningImage {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(screening?.imageKey));

  const imageKey = screening?.imageKey ?? null;

  useEffect(() => {
    if (!imageKey) {
      setUrl(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const load = imageKey.startsWith('cxr:')
      ? getImageUrl(imageKey)
      : recordsApi.getScreeningImageUrl(imageKey);

    load
      .then((resolved) => {
        if (!active) return;
        setUrl(resolved);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setUrl(null);
        setError(cause instanceof Error ? cause.message : 'Gambar gagal dimuat.');
        setLoading(false);
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
    error,
  };
}
