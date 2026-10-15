/**
 * Identifier helpers.
 *
 * `crypto.randomUUID` is available in every browser this prototype targets,
 * but it requires a secure context; the counter fallback keeps the app working
 * when served over plain HTTP on a LAN (a realistic field-demo scenario).
 */

let counter = 0;

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomSuffix()}`;
}

/** Sequential human-facing codes, e.g. nextCode('REF', 231) → "REF-0232". */
export function nextCode(prefix: string, existingCount: number): string {
  return `${prefix}-${String(existingCount + 1).padStart(4, '0')}`;
}

/** Medical record number in the form used by the seed data: TB-YYMM-NNNN. */
export function createMrn(sequence: number, date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `TB-${yy}${mm}-${String(sequence).padStart(4, '0')}`;
}
