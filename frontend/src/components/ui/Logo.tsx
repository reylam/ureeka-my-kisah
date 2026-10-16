import { useId } from 'react';
import { cn } from '@/utils/cn';

/**
 * Brand mark, shared with the public research site.
 *
 * A "P" monogram with a pair of lungs and a trachea cut out of it, redrawn in
 * SVG from `public/icons/logo.png`. The lungs are a mask rather than white
 * fill, so the mark works on the obsidian sidebar and on a white top bar from
 * one component.
 *
 * `plated` draws the obsidian tile behind the glyph, which is what the mark
 * needs on a light surface. On the dark sidebar the tile is dropped and the
 * glyph sits directly on the chrome.
 */
export function LogoMark({
  className,
  tone = 'dark',
}: {
  className?: string;
  /** `dark` = obsidian plate, for light backgrounds. `light` = bare glyph. */
  tone?: 'dark' | 'light';
}) {
  const maskId = `logo-mark-${useId().replace(/[:]/g, '')}`;
  const plated = tone === 'dark';

  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <g transform="translate(4 4)">
          {/* Left lung, then the same path mirrored about x = 12 */}
          <path
            d="M11.5 6.1c-1.9.2-3.5 1.5-4.3 3.8-.6 1.8-.2 3.4 1.2 4 1.4.5 2.7-.4 3.2-2.5.3-1.6.2-3.8-.1-5.3z"
            fill="#000"
          />
          <path
            d="M11.5 6.1c-1.9.2-3.5 1.5-4.3 3.8-.6 1.8-.2 3.4 1.2 4 1.4.5 2.7-.4 3.2-2.5.3-1.6.2-3.8-.1-5.3z"
            fill="#000"
            transform="translate(24 0) scale(-1 1)"
          />
          <path
            d="M12 4.6v3.1"
            stroke="#000"
            strokeWidth="1.05"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </mask>

      {plated ? <rect width="32" height="32" rx="8" fill="#111318" /> : null}

      <g mask={`url(#${maskId})`}>
        {/* The P: a stem with a semicircular bowl and a chamfered foot. */}
        <path
          d="M4.2 3h10A6.3 6.3 0 0 1 14.2 15.6H9.4V21H5.6L4.2 19.6Z"
          transform="translate(4 4)"
          fill={plated ? '#8DB8E8' : 'currentColor'}
        />
      </g>
    </svg>
  );
}

export function Logo({
  tone = 'light',
  showWordmark = true,
  className,
}: {
  /** `light` = light text, for the obsidian sidebar. */
  tone?: 'light' | 'dark';
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark tone="dark" className="size-8" />
      {showWordmark ? (
        <span className="min-w-0">
          <span
            className={cn(
              'block font-mono text-[12.5px] leading-none font-medium tracking-[0.11em]',
              tone === 'light' ? 'text-white' : 'text-obsidian-950',
            )}
          >
            PARU
            <span className={tone === 'light' ? 'text-obsidian-400' : 'text-obsidian-400'}>
              PINTAS
            </span>
          </span>
          <span
            className={cn(
              'mt-1.5 block text-[10px] leading-none tracking-[0.02em]',
              tone === 'light' ? 'text-obsidian-400' : 'text-obsidian-500',
            )}
          >
            Skrining TB Berbantuan AI
          </span>
        </span>
      ) : null}
    </span>
  );
}
