import type { ISODate, ISODateTime } from '@/types/domain';

/**
 * Date helpers. Everything is intentionally small and dependency-free.
 *
 * The seed dataset is generated relative to "today", so overdue and upcoming
 * states are always genuinely correct whenever the prototype is opened rather
 * than drifting out of date.
 */

const DAY_MS = 86_400_000;

/** Today at local midnight, the reference point for all bucketing. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date: Date): ISODate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Shift today by `days` and return a date-only string. */
export function dateOffset(days: number): ISODate {
  return toISODate(addDays(startOfToday(), days));
}

/**
 * Shift today by `days`, set a specific local time, and return a timestamp.
 * Used by the seed data so activity looks like it happened during clinic hours.
 */
export function dateTimeOffset(days: number, hour = 9, minute = 0): ISODateTime {
  const d = addDays(startOfToday(), days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Whole days from today to `date`. Negative means in the past. */
export function daysFromToday(date: ISODate): number {
  const target = parseISODate(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday().getTime()) / DAY_MS);
}

export function isPast(date: ISODate): boolean {
  return daysFromToday(date) < 0;
}

export function isToday(date: ISODate): boolean {
  return daysFromToday(date) === 0;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

const LOCALE = 'id-ID';

export function formatDate(value: ISODate | ISODateTime): string {
  const d = value.length <= 10 ? parseISODate(value) : new Date(value);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(value: ISODate | ISODateTime): string {
  const d = value.length <= 10 ? parseISODate(value) : new Date(value);
  return d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short' });
}

export function formatDateTime(value: ISODateTime): string {
  const d = new Date(value);
  return `${d.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatTime(value: ISODateTime): string {
  return new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

/** Compact relative time for activity feeds and sync timestamps. */
export function formatRelative(value: ISODateTime): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
}

export function ageFromBirthDate(birthDate: ISODate): number {
  const birth = parseISODate(birthDate);
  const today = startOfToday();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

/** Inclusive list of date-only strings spanning the last `count` days. */
export function lastNDays(count: number): ISODate[] {
  const out: ISODate[] = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(dateOffset(-i));
  return out;
}

/** Value for an <input type="date"> given a possibly-null ISO date. */
export function toDateInputValue(value: ISODate | null): string {
  return value ?? '';
}
