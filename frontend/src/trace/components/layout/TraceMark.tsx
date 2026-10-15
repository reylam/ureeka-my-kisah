import { useId } from 'react';
import { cn } from '@/utils/cn';

/**
 * Product mark: a "P" monogram with a pair of lungs and a trachea cut out of
 * it, redrawn from `public/icons/logo.png`.
 *
 * Redrawn rather than used as an image for three reasons: the PNG has an
 * opaque white background, which would sit as a white tile on a near-black
 * page; it is 320 kB for a 24 px mark; and as SVG the glyph inherits
 * `currentColor`, so the same component serves the header, the footer and the
 * mobile menu without a second asset.
 *
 * The lungs are a mask, not white fill — they are genuine negative space, so
 * whatever surface the mark sits on shows through them.
 */
export function TraceMark({ className }: { className?: string }) {
  const maskId = `trace-mark-${useId().replace(/[:]/g, '')}`;

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-6', className)}>
      <mask id={maskId}>
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

/** Wordmark with the research-edition tag. */
export function TraceWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <TraceMark className="size-7 text-trace-accent" />
      <span className="flex flex-col leading-none">
        <span className="font-mono text-[13.5px] font-medium tracking-[0.1em] text-trace-text">
          PULMO-TRACE
        </span>
        <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-trace-dim">
          Research edition
        </span>
      </span>
    </span>
  );
}
