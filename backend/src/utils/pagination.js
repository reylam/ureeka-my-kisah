import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** Zero-based inclusive range for PostgREST `.range()`. */
export function toRange({ page, pageSize }) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function pageMeta({ page, pageSize }, total) {
  return { page, pageSize, total: total ?? 0, pageCount: Math.max(1, Math.ceil((total ?? 0) / pageSize)) };
}

/**
 * Make free text safe to place inside a PostgREST `or()` / `ilike` filter.
 * Commas, parentheses and wildcard characters are filter syntax there, so they
 * are dropped rather than escaped.
 */
export function sanitizeSearch(value) {
  return String(value ?? '')
    .replace(/[,()*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
