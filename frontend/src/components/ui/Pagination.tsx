import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Select } from '@/components/forms/Inputs';

/**
 * Local pagination controls.
 *
 * Page numbers are windowed around the current page so the control never grows
 * unbounded; ellipses are rendered as inert text rather than fake buttons.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
}: {
  page: number; // 1-based
  pageCount: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 border-t border-obsidian-200 px-4 py-2.5 sm:flex-row',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="text-[13px] text-obsidian-500 tabular">
          {from}–{to} of {totalItems}
        </p>
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-[13px] text-obsidian-500">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <Select
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-7 w-auto py-0 pr-7 pl-2 text-[13px]"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <PageButton
            label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </PageButton>

          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span
                key={`gap-${index}`}
                aria-hidden
                className="px-1 text-[13px] text-obsidian-300 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'h-7 min-w-7 rounded px-1.5 text-[13px] font-medium transition-colors tabular',
                  entry === page
                    ? 'bg-obsidian-950 text-white'
                    : 'text-obsidian-600 hover:bg-obsidian-100 hover:text-obsidian-900',
                )}
              >
                {entry}
              </button>
            ),
          )}

          <PageButton
            label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </PageButton>
        </div>
      ) : null}
    </nav>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded text-obsidian-600 transition-colors hover:bg-obsidian-100 hover:text-obsidian-900 disabled:cursor-not-allowed disabled:text-obsidian-300 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Windowed page list: 1 … 4 5 6 … 20 */
function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const entries: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) entries.push('gap');
  for (let i = start; i <= end; i += 1) entries.push(i);
  if (end < pageCount - 1) entries.push('gap');
  entries.push(pageCount);

  return entries;
}
