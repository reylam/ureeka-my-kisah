import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortState } from '@/components/ui/DataTable';

/**
 * Search, filter, sort and pagination state for a directory page.
 *
 * Extracted because five pages need exactly this behaviour; each one supplies
 * its own matcher and comparators and gets consistent interactions back. The
 * page always resets to 1 when the result set changes underneath it, which
 * avoids the classic "page 4 of 2 results" dead end.
 */

export interface TableControlsConfig<T, F extends string> {
  rows: T[];
  /** Free-text matcher. Return true when the row should be kept. */
  search: (row: T, term: string) => boolean;
  /** One predicate per filter key. A filter set to 'all' is skipped. */
  filters: Record<F, (row: T, value: string) => boolean>;
  /** Comparators keyed by column id. */
  comparators: Record<string, (a: T, b: T) => number>;
  initialSort?: SortState;
  initialPageSize?: number;
}

export interface TableControls<T, F extends string> {
  term: string;
  setTerm: (value: string) => void;
  filterValues: Record<F, string>;
  setFilter: (key: F, value: string) => void;
  activeFilterCount: number;
  clearAll: () => void;
  sort: SortState | null;
  toggleSort: (columnId: string) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageCount: number;
  /** Rows after search + filters, before pagination. */
  filtered: T[];
  /** The rows to render. */
  visible: T[];
  hasQuery: boolean;
}

export function useTableControls<T, F extends string>({
  rows,
  search,
  filters,
  comparators,
  initialSort,
  initialPageSize = 25,
}: TableControlsConfig<T, F>): TableControls<T, F> {
  const filterKeys = useMemo(() => Object.keys(filters) as F[], [filters]);

  const [term, setTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<F, string>>(
    () => Object.fromEntries(filterKeys.map((key) => [key, 'all'])) as Record<F, string>,
  );
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const setFilter = useCallback((key: F, value: string) => {
    setFilterValues((current) => ({ ...current, [key]: value }));
  }, []);

  const clearAll = useCallback(() => {
    setTerm('');
    setFilterValues(
      Object.fromEntries(filterKeys.map((key) => [key, 'all'])) as Record<F, string>,
    );
  }, [filterKeys]);

  const toggleSort = useCallback((columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: 'asc' };
      if (current.direction === 'asc') return { columnId, direction: 'desc' };
      return null; // third click clears the sort
    });
  }, []);

  const trimmed = term.trim().toLowerCase();

  const filtered = useMemo(() => {
    let result = rows;

    if (trimmed) result = result.filter((row) => search(row, trimmed));

    filterKeys.forEach((key) => {
      const value = filterValues[key];
      if (!value || value === 'all') return;
      const predicate = filters[key];
      result = result.filter((row) => predicate(row, value));
    });

    if (sort) {
      const comparator = comparators[sort.columnId];
      if (comparator) {
        result = [...result].sort((a, b) =>
          sort.direction === 'asc' ? comparator(a, b) : comparator(b, a),
        );
      }
    }

    return result;
    // `search`, `filters` and `comparators` are recreated each render by
    // callers; including them would defeat the memo, and their behaviour is
    // stable for a given page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, trimmed, filterValues, sort, filterKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Keep the page in range whenever the result set shrinks.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const activeFilterCount =
    filterKeys.filter((key) => filterValues[key] && filterValues[key] !== 'all').length +
    (trimmed ? 1 : 0);

  return {
    term,
    setTerm,
    filterValues,
    setFilter,
    activeFilterCount,
    clearAll,
    sort,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize: (size) => {
      setPageSize(size);
      setPage(1);
    },
    pageCount,
    filtered,
    visible,
    hasQuery: activeFilterCount > 0,
  };
}
