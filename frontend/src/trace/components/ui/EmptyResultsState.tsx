import type { ReactNode } from 'react';
import { CircleDashed } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * The panel that says nothing has been measured.
 *
 * It names what is missing and what it would take to produce it, which is more
 * informative than a chart of invented numbers and more honest than an empty
 * div. The dashed border is the only dashed border on the site, so an empty
 * panel is recognisable at a glance.
 */
export function EmptyResultsState({
  title,
  requirement,
  children,
  className,
  compact = false,
}: {
  title: string;
  requirement?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start rounded-md border border-dashed border-trace-line bg-trace-card/40',
        compact ? 'p-4' : 'p-6 sm:p-8',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <CircleDashed aria-hidden className="size-4 shrink-0 text-trace-dim" strokeWidth={2} />
        <p className={cn('font-medium text-trace-text', compact ? 'text-[13.5px]' : 'text-[15px]')}>
          {title}
        </p>
      </div>
      {requirement ? (
        <p
          className={cn(
            'mt-2 max-w-xl text-trace-muted',
            compact ? 'text-[12.5px] leading-5' : 'text-[13.5px] leading-6',
          )}
        >
          <span className="trace-label mr-2 text-trace-dim">Needs</span>
          {requirement}
        </p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
