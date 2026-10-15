import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Badge.
 *
 * Every badge in this product renders an icon *and* a text label. Colour is
 * only ever a third, redundant channel, so the meaning survives greyscale
 * printing and colour-vision deficiency. There is no icon-less variant on
 * purpose.
 */
export type BadgeTone =
  | 'neutral'
  | 'info' // CT blue: informational only, never a clinical state
  | 'attention'
  | 'urgent'
  | 'complete'
  | 'inert';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-obsidian-100 text-obsidian-700 ring-obsidian-200',
  info: 'bg-ct-100 text-ct-800 ring-ct-200',
  attention: 'bg-attention-50 text-attention-800 ring-attention-300/70',
  urgent: 'bg-urgent-50 text-urgent-800 ring-urgent-300/70',
  complete: 'bg-complete-50 text-complete-800 ring-complete-300/70',
  inert: 'bg-white text-obsidian-500 ring-obsidian-200',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  size = 'md',
  className,
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        toneClasses[tone],
        className,
      )}
    >
      <span aria-hidden className="shrink-0 [&>svg]:size-3.5">
        {icon}
      </span>
      {children}
    </span>
  );
}

/** A small count chip used in tabs and sidebar items. */
export function CountChip({
  value,
  tone = 'neutral',
  className,
}: {
  value: number;
  tone?: 'neutral' | 'urgent' | 'attention' | 'onDark';
  className?: string;
}) {
  const classes = {
    neutral: 'bg-obsidian-100 text-obsidian-600',
    urgent: 'bg-urgent-100 text-urgent-800',
    attention: 'bg-attention-100 text-attention-800',
    onDark: 'bg-white/10 text-obsidian-200',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold tabular',
        classes[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}
