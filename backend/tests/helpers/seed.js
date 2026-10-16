/**
 * supabase/seed.sql has two parts, split at the "@@SAMPLE-RECORDS@@" line: base
 * data (facilities, sign-ins, patients) and sample clinical records. Most tests
 * want the base only, so their expectations about "no screenings yet" stay
 * exact; the seed test loads the whole file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEED_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase', 'seed.sql');
const MARKER = '-- @@SAMPLE-RECORDS@@';

export function fullSeedSql() {
  return readFileSync(SEED_FILE, 'utf8');
}

export function baseSeedSql() {
  const sql = fullSeedSql();
  const at = sql.indexOf(MARKER);
  if (at === -1) throw new Error(`seed.sql no longer contains the ${MARKER} marker`);
  return sql.slice(0, at);
}
