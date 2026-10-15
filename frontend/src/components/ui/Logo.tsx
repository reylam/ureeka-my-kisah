import { cn } from '@/utils/cn';

/**
 * Brand mark.
 *
 * A scan reticle framing a stylised thorax. The two shapes read as "image
 * under review", which is what the product actually does. Obsidian plate, CT
 * blue detail; no gradient, no glow.
 */
export function LogoMark({
  className,
  tone = 'dark',
}: {
  className?: string;
  /** `dark` = obsidian plate (light backgrounds). `light` = for dark chrome. */
  tone?: 'dark' | 'light';
}) {
  const plate = tone === 'dark' ? '#111318' : '#FFFFFF';
  const detail = tone === 'dark' ? '#8DB8E8' : '#111318';
  const accent = tone === 'dark' ? '#A8C8EB' : '#35608C';

  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="7" fill={plate} />
      {/* Reticle corners */}
      <path
        d="M8 11.5V9.5A1.5 1.5 0 0 1 9.5 8h2M20.5 8h2A1.5 1.5 0 0 1 24 9.5v2M24 20.5v2a1.5 1.5 0 0 1-1.5 1.5h-2M11.5 24h-2A1.5 1.5 0 0 1 8 22.5v-2"
        stroke={accent}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Trachea + bronchi, abstracted */}
      <path
        d="M16 11v4.2"
        stroke={detail}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 15.2c-1.9 0-3.4 1.1-3.9 2.9-.4 1.5-.3 3 .3 4.2M16 15.2c1.9 0 3.4 1.1 3.9 2.9.4 1.5.3 3-.3 4.2"
        stroke={detail}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
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
      <LogoMark tone={tone === 'light' ? 'dark' : 'dark'} className="size-7" />
      {showWordmark ? (
        <span className="min-w-0">
          <span
            className={cn(
              'block text-[13px] leading-none font-semibold tracking-tight',
              tone === 'light' ? 'text-white' : 'text-obsidian-950',
            )}
          >
            Sentra TB
          </span>
          <span
            className={cn(
              'mt-1 block text-[10px] leading-none tracking-wide uppercase',
              tone === 'light' ? 'text-obsidian-400' : 'text-obsidian-500',
            )}
          >
            Screening &amp; Access
          </span>
        </span>
      ) : null}
    </span>
  );
}
