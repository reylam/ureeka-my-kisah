import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Scroll reveal.
 *
 * Content below the fold stays hidden until the reader scrolls it into view,
 * then fades and rises once. Done with an IntersectionObserver and a CSS
 * transition (`.trace-reveal` in the stylesheet) rather than an animation
 * library, for the same reason as the hero's entrance: the research site's
 * first chunk should not have to carry one. The base layer's reduced-motion
 * rule shortens the transition to nothing for anyone who asked for that.
 *
 * It reveals once and stays revealed, so scrolling back up never replays it.
 * If the browser has no IntersectionObserver the content is simply shown, since
 * hidden content with no way to reveal it is worse than no animation.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds to hold back, for staggering siblings. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  );

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Wait until the section has climbed a little way into the viewport, so
      // it animates where the reader is looking and not at the very edge.
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn('trace-reveal', className)}
    >
      {children}
    </div>
  );
}
