import { useEffect, useState } from 'react';

/**
 * True once the page has scrolled past `threshold` pixels.
 *
 * Drives the header's collapse. The listener is passive and the state only
 * flips when the boolean actually changes, so a long scroll does not trigger a
 * render per frame.
 */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(
    () => typeof window !== 'undefined' && window.scrollY > threshold,
  );

  useEffect(() => {
    const read = () => {
      const next = window.scrollY > threshold;
      setScrolled((current) => (current === next ? current : next));
    };
    read();
    window.addEventListener('scroll', read, { passive: true });
    return () => window.removeEventListener('scroll', read);
  }, [threshold]);

  return scrolled;
}
