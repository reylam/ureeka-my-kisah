import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local image selection for the demo.
 *
 * Everything stays in the browser: the file is read into an object URL to draw
 * a preview and to measure its pixel dimensions, and nothing is sent anywhere.
 * That is what makes the "processed locally" disclosure on the demo page true,
 * and it is the only reason the page is allowed to make it.
 *
 * Object URLs are revoked when the selection is replaced or the component
 * unmounts, so repeatedly swapping images does not leak blobs.
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png'] as const;
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;
export const MAX_BYTES = 15 * 1000 * 1000; // 15 MB
export const MIN_EDGE_PX = 256;

export interface SelectedImage {
  file: File;
  /** Object URL for the preview. Revoked on replace and on unmount. */
  url: string;
  width: number;
  height: number;
  /** Stable key for the deterministic demo scenario. */
  key: string;
}

export type UploadError =
  | { kind: 'type'; message: string }
  | { kind: 'size'; message: string }
  | { kind: 'dimensions'; message: string }
  | { kind: 'decode'; message: string };

interface UseImageUpload {
  image: SelectedImage | null;
  error: UploadError | null;
  isReading: boolean;
  select: (file: File | null | undefined) => void;
  clear: () => void;
  dismissError: () => void;
}

function describeType(file: File): string {
  const extension = file.name.split('.').pop()?.toUpperCase();
  return file.type || (extension ? `.${extension}` : 'an unrecognised format');
}

export function useImageUpload(): UseImageUpload {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<UploadError | null>(null);
  const [isReading, setIsReading] = useState(false);

  // Kept in a ref as well as in state: cleanup must be able to revoke the
  // previous URL without re-running whenever the selection changes.
  const urlRef = useRef<string | null>(null);
  const releaseUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => releaseUrl, [releaseUrl]);

  const clear = useCallback(() => {
    releaseUrl();
    setImage(null);
    setError(null);
    setIsReading(false);
  }, [releaseUrl]);

  const select = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;

      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const typeOk =
        (ACCEPTED_TYPES as readonly string[]).includes(file.type) ||
        (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension);

      if (!typeOk) {
        setError({
          kind: 'type',
          message: `${file.name} is ${describeType(file)}. This demo accepts JPG, JPEG and PNG only.`,
        });
        return;
      }

      if (file.size > MAX_BYTES) {
        setError({
          kind: 'size',
          message: `${file.name} is ${(file.size / 1_000_000).toFixed(1)} MB. The limit is 15 MB.`,
        });
        return;
      }

      setError(null);
      setIsReading(true);

      const url = URL.createObjectURL(file);
      const probe = new Image();

      probe.onload = () => {
        const { naturalWidth: width, naturalHeight: height } = probe;
        if (Math.min(width, height) < MIN_EDGE_PX) {
          URL.revokeObjectURL(url);
          setIsReading(false);
          setError({
            kind: 'dimensions',
            message: `${file.name} is ${width} × ${height} px. The shorter edge must be at least ${MIN_EDGE_PX} px for the preview to be meaningful.`,
          });
          return;
        }
        // Only now replace the previous selection, so a rejected file leaves
        // the current one on screen.
        releaseUrl();
        urlRef.current = url;
        setImage({
          file,
          url,
          width,
          height,
          key: `${file.name}:${file.size}:${file.lastModified}`,
        });
        setIsReading(false);
      };

      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setIsReading(false);
        setError({
          kind: 'decode',
          message: `${file.name} could not be read as an image. It may be corrupt, or it may be a different format wearing an image extension.`,
        });
      };

      probe.src = url;
    },
    [releaseUrl],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { image, error, isReading, select, clear, dismissError };
}
