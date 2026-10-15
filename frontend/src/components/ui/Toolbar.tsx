import type { ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Select } from '@/components/forms/Inputs';
import { Button } from './Button';

/**
 * Search + filter toolbar shared by every directory page.
 *
 * The active-filter count and the "clear" affordance only appear when there is
 * something to clear, so the bar stays quiet in its default state.
 */
export function Toolbar({
  search,
  filters,
  trailing,
  activeFilterCount = 0,
  onClearFilters,
  className,
}: {
  /** The search input element. */
  search?: ReactNode;
  filters?: ReactNode;
  /** Right-aligned extras, e.g. a view switcher or result count. */
  trailing?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 border-b border-obsidian-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4',
        className,
      )}
    >
      {search ? <div className="w-full sm:max-w-xs">{search}</div> : null}

      {filters ? (
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal aria-hidden className="hidden size-4 shrink-0 text-obsidian-400 sm:block" />
          {filters}
          {activeFilterCount > 0 && onClearFilters ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearFilters}
              leadingIcon={<X className="size-3.5" />}
            >
              Clear {activeFilterCount}
            </Button>
          ) : null}
        </div>
      ) : null}

      {trailing ? <div className="sm:ml-auto flex items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

/**
 * Compact labelled select for the toolbar. The label is visually attached to
 * the control rather than floating above it, which keeps the bar one row tall.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  allLabel = 'All',
  className,
}: {
  label: string;
  value: T | 'all';
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T | 'all') => void;
  allLabel?: string;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="sr-only sm:not-sr-only sm:text-xs sm:text-obsidian-500">{label}</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value as T | 'all')}
        className={cn('h-8 min-w-0 text-[13px]', value !== 'all' && 'border-ct-400 bg-ct-50')}
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count === undefined ? '' : ` (${option.count})`}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Result counter shown at the toolbar's trailing edge. */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <p className="text-[13px] text-obsidian-500 tabular">
      {shown === total ? (
        <>
          <span className="font-medium text-obsidian-800">{total}</span> {noun}
        </>
      ) : (
        <>
          <span className="font-medium text-obsidian-800">{shown}</span> of {total} {noun}
        </>
      )}
    </p>
  );
}
