import { useId } from 'react';
import { cn } from '@/utils/cn';
import { PROJECT } from '@/trace/data/content';

/**
 * Product mark: a "P" monogram with a pair of lungs and a trachea cut out of
 * it, redrawn from `public/icons/logo.png`.
 *
 * Redrawn rather than used as an image for three reasons: the PNG has an
 * opaque white background, which would sit as a white tile on a near-black
 * page; it is 320 kB for a 28 px mark; and as SVG the glyph inherits
 * `currentColor`, so one component serves the header, the footer and the
 * mobile menu without a second asset.
 *
 * The lungs are a mask, not white fill. They are genuine negative space, so
 * whatever surface the mark sits on shows through them.
 */
export function TraceMark({ className }: { className?: string }) {
  const maskId = `trace-mark-${useId().replace(/[:]/g, '')}`;

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-7', className)}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        {/* White keeps, black cuts away. */}
        <rect width="24" height="24" fill="#fff" />

        {/* Left lung */}
        <path
          d="M11.5 6.1c-1.9.2-3.5 1.5-4.3 3.8-.6 1.8-.2 3.4 1.2 4 1.4.5 2.7-.4 3.2-2.5.3-1.6.2-3.8-.1-5.3z"
          fill="#000"
        />
        {/* Right lung: the same path mirrored about x = 12 */}
        <path
          d="M11.5 6.1c-1.9.2-3.5 1.5-4.3 3.8-.6 1.8-.2 3.4 1.2 4 1.4.5 2.7-.4 3.2-2.5.3-1.6.2-3.8-.1-5.3z"
          fill="#000"
          transform="translate(24 0) scale(-1 1)"
        />
        {/* Trachea */}
        <path
          d="M12 4.6v3.1"
          stroke="#000"
          strokeWidth="1.05"
          strokeLinecap="round"
          fill="none"
        />
      </mask>

      {/* The P: a stem with a semicircular bowl and a chamfered foot. */}
      <path
        d="M4.2 3h10A6.3 6.3 0 0 1 14.2 15.6H9.4V21H5.6L4.2 19.6Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

/**
 * Brand lockup.
 *
 * `compact` collapses the tagline and settles the wordmark down into the
 * vertical centre. The header passes it the scroll state, so the lockup is the
 * one thing on the page that animates on scroll.
 */
export function TraceWordmark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <TraceMark
        className={cn(
          'shrink-0 text-trace-accent transition-all duration-300 ease-out',
          compact ? 'size-7 translate-y-0' : 'size-9 -translate-y-[3px]',
        )}
      />

      <span className="flex min-w-0 flex-col justify-center">
        <span
          className={cn(
            'font-mono font-medium tracking-[0.13em] text-trace-text',
            'transition-all duration-300 ease-out',
            compact ? 'translate-y-0 text-[13px]' : 'translate-y-[1px] text-[15px]',
          )}
        >
          PARU
          <span className="text-trace-dim">PINTAS</span>
        </span>

        {/* Collapsed with max-height rather than a grid-row trick: height
            interpolation on grid templates is still uneven across browsers,
            and this has to be smooth on every scroll. */}
        <span
          aria-hidden={compact}
          className={cn(
            'overflow-hidden text-[11.5px] text-trace-dim',
            'transition-all duration-300 ease-out',
            compact ? 'mt-0 max-h-0 -translate-y-1 opacity-0' : 'mt-1 max-h-5 translate-y-0 opacity-100',
          )}
        >
          <span className="block whitespace-nowrap tracking-[0.02em]">{PROJECT.tagline}</span>
        </span>
      </span>
    </span>
  );
}

/** Static lockup for the footer, where there is no scroll state to follow. */
export function TraceFooterMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <TraceMark className="size-8 shrink-0 text-trace-accent" />
      <span className="flex flex-col">
        <span className="font-mono text-[15px] font-medium tracking-[0.13em] text-trace-text">
          PARU
          <span className="text-trace-dim">PINTAS</span>
        </span>
        <span className="mt-1 max-w-xs text-[11.5px] leading-snug tracking-[0.02em] text-trace-dim">
          {PROJECT.subtitle}
        </span>
      </span>
    </span>
  );
}
