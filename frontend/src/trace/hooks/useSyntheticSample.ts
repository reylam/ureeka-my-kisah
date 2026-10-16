import { useCallback, useRef, useState } from 'react';

/**
 * Produces a sample file for the demo without shipping a real radiograph.
 *
 * No public TB chest X-ray collection can be redistributed casually inside a
 * web app, and a real patient image used as demo furniture is a bad idea even
 * where the licence permits it. So the sample is generated at runtime: the
 * project's procedurally drawn SVG radiograph is serialised, rasterised to an
 * 800 × 800 PNG on a canvas, and handed to the normal upload path as a `File`.
 *
 * The result travels through exactly the same validation as a user's own file,
 * which is the point: the sample button exercises the real code path rather
 * than a shortcut around it.
 */
export function useSyntheticSample(
  onFile: (file: File) => void,
): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  load: () => void;
  isBuilding: boolean;
  error: string | null;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) {
      setError('Sample radiograph tidak bisa disiapkan di browser ini.');
      return;
    }

    setError(null);
    setIsBuilding(true);

    // An SVG with only a viewBox has no intrinsic size, and several browsers
    // refuse to decode one as an <img>. Clone it and state the size explicitly.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', '800');
    clone.setAttribute('height', '800');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.removeAttribute('class');

    const serialised = new XMLSerializer().serializeToString(clone);
    const svgUrl = URL.createObjectURL(
      new Blob([serialised], { type: 'image/svg+xml;charset=utf-8' }),
    );

    const probe = new Image();
    probe.onload = () => {
      const size = 800;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        setIsBuilding(false);
        setError('Browser ini tidak menyediakan canvas 2D, jadi sample tidak bisa dirasterisasi.');
        return;
      }
      context.fillStyle = '#0a0c10';
      context.fillRect(0, 0, size, size);
      context.drawImage(probe, 0, 0, size, size);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        setIsBuilding(false);
        if (!blob) {
          setError('Gambar sample tidak bisa di-encode menjadi PNG.');
          return;
        }
        onFile(
          new File([blob], 'parupintas-synthetic-sample.png', {
            type: 'image/png',
            // Fixed timestamp, so the sample always maps to the same
            // placeholder scenario and demos stay reproducible.
            lastModified: Date.UTC(2026, 0, 1),
          }),
        );
      }, 'image/png');
    };

    probe.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setIsBuilding(false);
      setError('Sample radiograph tidak bisa dirender di browser ini.');
    };

    probe.src = svgUrl;
  }, [onFile]);

  return { containerRef, load, isBuilding, error };
}
