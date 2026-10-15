import type { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

/**
 * Empty state.
 *
 * Written to distinguish "there is nothing here yet" from "your filters
 * excluded everything". Those need different actions, and conflating them is
 * a common way to leave users stuck.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-3 flex size-10 items-center justify-center rounded-full bg-obsidian-100 text-obsidian-400 [&>svg]:size-5"
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-obsidian-900">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-obsidian-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Specialised empty state for when active filters produced no matches. */
export function NoMatchesState({
  onClear,
  entity = 'records',
}: {
  onClear: () => void;
  entity?: string;
}) {
  return (
    <EmptyState
      icon={<AlertCircle />}
      title={`No ${entity} match these filters`}
      description="Try a different search term, or clear the filters to see everything again."
      action={
        <Button size="sm" variant="outline" leadingIcon={<RotateCcw className="size-4" />} onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}

/** Error state for a failed load, with a retry affordance. */
export function ErrorState({
  title = 'Could not load this view',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        aria-hidden
        className="mb-3 flex size-10 items-center justify-center rounded-full bg-urgent-50 text-urgent-700 [&>svg]:size-5"
      >
        <AlertCircle />
      </div>
      <p className="text-sm font-medium text-obsidian-900">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-obsidian-500">
        {description ?? 'Something went wrong while reading the local demo data.'}
      </p>
      {onRetry ? (
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
          leadingIcon={<RotateCcw className="size-4" />}
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
