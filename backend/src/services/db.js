import { ApiError, fromDbError } from '../utils/ApiError.js';

/**
 * Turn a Supabase `{ data, error }` result into data or a thrown ApiError.
 * Unmapped errors are re-thrown as-is so the error handler logs them as bugs.
 */
export function unwrap(result) {
  if (result.error) throw fromDbError(result.error) ?? result.error;
  return result.data;
}

/** Like unwrap, but a missing row is a 404. */
export function unwrapOne(result) {
  const data = unwrap(result);
  if (data == null) throw ApiError.notFound();
  return data;
}

/** Walk every page of a ranged query (used where the caller needs the full set). */
export async function fetchAll(buildQuery, pageSize = 500, cap = 20_000) {
  const rows = [];
  for (let from = 0; from < cap; from += pageSize) {
    const page = unwrap(await buildQuery().range(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
