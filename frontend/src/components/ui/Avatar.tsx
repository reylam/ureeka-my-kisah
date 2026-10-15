import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/** Initials avatar. No photo uploads exist in this prototype. */
export function Avatar({
  name,
  size = 'md',
  tone = 'default',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'onDark';
  className?: string;
}) {
  const sizes = {
    sm: 'size-6 text-[10px]',
    md: 'size-8 text-[11px]',
    lg: 'size-10 text-sm',
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none',
        tone === 'onDark'
          ? 'bg-white/10 text-ct-200 ring-1 ring-white/15'
          : 'bg-ct-100 text-ct-800 ring-1 ring-ct-200',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
