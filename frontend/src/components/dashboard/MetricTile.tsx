import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Metric tile.
 *
 * Four of these, not twelve. Each one answers a question the user can act on
 * and links to the screen where they would act, so the number is a doorway
 * rather than decoration. `tone` turns on only when the value is genuinely
 * outstanding work. A zero never lights up red.
 */
export function MetricTile({
  label,
  value,
  caption,
  icon: Icon,
  to,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: number | string;
  caption?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  to: string;
  tone?: 'neutral' | 'attention' | 'urgent';
  className?: string;
}) {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const active = tone !== 'neutral' && (Number.isNaN(numeric) || numeric > 0);

  return (
    <Link
      to={to}
      className={cn(
        'group relative flex flex-col justify-between rounded-card border bg-white p-3.5 shadow-card transition-colors',
        active && tone === 'urgent'
          ? 'border-urgent-300/70 hover:border-urgent-500'
          : active && tone === 'attention'
            ? 'border-attention-300/70 hover:border-attention-500'
            : 'border-obsidian-200 hover:border-obsidian-300',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
          {label}
        </span>
        <Icon
          className={cn(
            'size-4 shrink-0',
            active && tone === 'urgent'
              ? 'text-urgent-600'
              : active && tone === 'attention'
                ? 'text-attention-600'
                : 'text-obsidian-300',
          )}
        />
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span
          className={cn(
            'text-2xl leading-none font-semibold tabular',
            active && tone === 'urgent'
              ? 'text-urgent-800'
              : active && tone === 'attention'
                ? 'text-attention-800'
                : 'text-obsidian-950',
          )}
        >
          {value}
        </span>
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 translate-x-0 text-obsidian-300 transition-transform group-hover:translate-x-0.5 group-hover:text-obsidian-500"
        />
      </div>

      {caption ? (
        <p className="mt-2 text-xs leading-relaxed text-obsidian-500">{caption}</p>
      ) : null}
    </Link>
  );
}
