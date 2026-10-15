import { cn } from '@/utils/cn';

/**
 * Determinate progress bar, used for image upload simulation and demo sync.
 * Always paired with a text percentage so progress is not colour-only.
 */
export function ProgressBar({
  value,
  label,
  tone = 'default',
  showValue = true,
  className,
}: {
  /** 0–100. */
  value: number;
  label: string;
  tone?: 'default' | 'attention' | 'complete';
  showValue?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fills = {
    default: 'bg-ct-500',
    attention: 'bg-attention-500',
    complete: 'bg-complete-500',
  } as const;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs text-obsidian-600">{label}</span>
        {showValue ? (
          <span className="shrink-0 text-xs font-medium text-obsidian-700 tabular">{clamped}%</span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-obsidian-200"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', fills[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/** Indeterminate bar for work with no measurable progress. */
export function IndeterminateBar({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <span className="text-xs text-obsidian-600">{label}</span>
      <div
        role="progressbar"
        aria-label={label}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-obsidian-200"
      >
        <div className="h-full w-1/3 animate-[slide_1.3s_ease-in-out_infinite] rounded-full bg-ct-500" />
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );
}
