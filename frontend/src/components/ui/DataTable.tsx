import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Data table.
 *
 * Renders a real semantic <table> on wide screens and a stacked record list on
 * narrow ones. Pages supply `renderMobileCard` so the mobile layout is designed
 * rather than mechanically transposed. A squashed table is worse than no table.
 */

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Tailwind width hint, e.g. 'w-32'. */
  width?: string;
  sortable?: boolean;
  /** Hide this column below the given breakpoint to control density. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Accessible name when the header is purely visual. */
  srHeader?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

const hideClasses = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  renderMobileCard,
  caption,
  className,
  /** Marks rows needing attention with a left rule. */
  rowAccent,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: SortState | null;
  onSortChange?: (columnId: string) => void;
  renderMobileCard?: (row: T) => ReactNode;
  caption: string;
  className?: string;
  rowAccent?: (row: T) => 'urgent' | 'attention' | null;
}) {
  return (
    <>
      {/* Wide screens: real table */}
      <div className={cn('hidden overflow-x-auto md:block', className)}>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-obsidian-200 bg-obsidian-50/70">
              {columns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'px-3 py-2 text-[11px] font-semibold tracking-wider text-obsidian-500 uppercase first:pl-4 last:pr-4',
                      column.align === 'right' && 'text-right',
                      column.width,
                      column.hideBelow && hideClasses[column.hideBelow],
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-obsidian-900',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        {isSorted ? (
                          sort.direction === 'asc' ? (
                            <ArrowUp aria-hidden className="size-3 text-ct-700" />
                          ) : (
                            <ArrowDown aria-hidden className="size-3 text-ct-700" />
                          )
                        ) : (
                          <ArrowUpDown aria-hidden className="size-3 text-obsidian-300" />
                        )}
                      </button>
                    ) : column.srHeader ? (
                      <span className="sr-only">{column.srHeader}</span>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-100">
            {rows.map((row) => {
              const accent = rowAccent?.(row) ?? null;
              return (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-ct-50/70',
                    accent === 'urgent' && 'bg-urgent-50/30',
                    accent === 'attention' && 'bg-attention-50/30',
                  )}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        'px-3 py-2.5 text-[13px] text-obsidian-700 align-middle first:pl-4 last:pr-4',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && hideClasses[column.hideBelow],
                        // The accent rule lives on the first cell so it does not
                        // fight the table's own borders.
                        index === 0 &&
                          accent === 'urgent' &&
                          'border-l-2 border-l-urgent-500 pl-[14px]',
                        index === 0 &&
                          accent === 'attention' &&
                          'border-l-2 border-l-attention-500 pl-[14px]',
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Narrow screens: stacked records */}
      <ul className="divide-y divide-obsidian-100 md:hidden">
        {rows.map((row) => {
          const accent = rowAccent?.(row) ?? null;
          return (
            <li
              key={rowKey(row)}
              className={cn(
                accent === 'urgent' && 'border-l-2 border-l-urgent-500',
                accent === 'attention' && 'border-l-2 border-l-attention-500',
              )}
            >
              {renderMobileCard ? (
                onRowClick ? (
                  // Not a <button>: a card may hold its own buttons (e.g. "Panggil"),
                  // and a button cannot contain another.
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onRowClick(row)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }}
                    className="w-full cursor-pointer px-4 py-3 text-left transition-colors active:bg-ct-50"
                  >
                    {renderMobileCard(row)}
                  </div>
                ) : (
                  <div className="px-4 py-3">{renderMobileCard(row)}</div>
                )
              ) : (
                <DefaultMobileCard row={row} columns={columns} onClick={onRowClick} />
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Fallback stacked layout: label/value pairs derived from the columns. */
function DefaultMobileCard<T>({
  row,
  columns,
  onClick,
}: {
  row: T;
  columns: Column<T>[];
  onClick?: (row: T) => void;
}) {
  const [first, ...rest] = columns;
  const content = (
    <>
      {first ? <div className="text-sm font-medium text-obsidian-900">{first.cell(row)}</div> : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rest.map((column) => (
          <div key={column.id} className="min-w-0">
            <dt className="text-[11px] tracking-wide text-obsidian-400 uppercase">
              {column.srHeader ?? column.header}
            </dt>
            <dd className="mt-0.5 text-[13px] text-obsidian-700">{column.cell(row)}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={() => onClick(row)}
      className="w-full px-4 py-3 text-left transition-colors active:bg-ct-50"
    >
      {content}
    </button>
  ) : (
    <div className="px-4 py-3">{content}</div>
  );
}

/** Utility for cells that hold an identifier. */
export function MonoCell({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs whitespace-nowrap text-obsidian-600">{children}</span>;
}

/** Utility for a primary cell with a quiet secondary line underneath. */
export function StackedCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-obsidian-900">{primary}</div>
      {secondary ? (
        <div className="mt-0.5 truncate text-xs text-obsidian-500">{secondary}</div>
      ) : null}
    </div>
  );
}
