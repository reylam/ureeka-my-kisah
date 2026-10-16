import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Reveal } from './Reveal';

/**
 * Layout atoms for the research site.
 *
 * `Container` is the one measure every section shares, so nothing drifts.
 * `SectionBand` is the full-width dark band that separates research chapters:
 * a background change and a hairline, never a shadow. Its content fades in the
 * first time it is scrolled into view; the band itself (background and
 * hairline) is always drawn, so the page never shows holes while it waits.
 */

export function Container({
  children,
  className,
  width = 'default',
}: {
  children: ReactNode;
  className?: string;
  /** `narrow` is for long-form prose, where 1 300px is too wide to read. */
  width?: 'default' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-5 sm:px-8',
        width === 'default' ? 'max-w-[1280px]' : 'max-w-[860px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionBand({
  children,
  id,
  tone = 'base',
  className,
  bordered = true,
  labelledBy,
  reveal = true,
}: {
  children: ReactNode;
  id?: string;
  tone?: 'base' | 'raised';
  className?: string;
  bordered?: boolean;
  labelledBy?: string;
  /** Fade the content in on first scroll into view. */
  reveal?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      // scroll-mt keeps anchored headings clear of the sticky header.
      className={cn(
        'scroll-mt-20 py-16 sm:py-20 lg:py-24',
        tone === 'raised' ? 'bg-trace-surface' : 'bg-trace-bg',
        bordered && 'border-t border-trace-line',
        className,
      )}
    >
      {reveal ? <Reveal>{children}</Reveal> : children}
    </section>
  );
}
