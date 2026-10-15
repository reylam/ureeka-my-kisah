/**
 * Derived views over the data store.
 *
 * All of these are pure functions of the stored records. Nothing here invents
 * a number. The dashboard, patient directory and follow-up queue read from
 * these so they can never drift apart from each other.
 */

import type {
  FollowUp,
  FollowUpBucket,
  ISODate,
  Patient,
  Referral,
  Screening,
  ScreeningOutcome,
  ScreeningStatus,
  ReferralStatus,
  FollowUpStatus,
} from '@/types/domain';
import { ageFromBirthDate, daysFromToday, lastNDays, toISODate } from '@/utils/date';

/* ── Follow-up bucketing ───────────────────────────────────────────────────── */

export function followUpBucket(followUp: FollowUp): FollowUpBucket {
  if (followUp.status === 'completed') return 'completed';
  if (followUp.status === 'unresolved') return 'unresolved';
  const diff = daysFromToday(followUp.dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due-today';
  return 'upcoming';
}

export function isOverdue(followUp: FollowUp): boolean {
  return followUpBucket(followUp) === 'overdue';
}

/* ── Patient directory rows ────────────────────────────────────────────────── */

export interface PatientRow {
  patient: Patient;
  age: number;
  screeningCount: number;
  lastScreeningAt: string | null;
  lastScreeningStatus: ScreeningStatus | null;
  lastOutcome: ScreeningOutcome | null;
  referralStatus: ReferralStatus | null;
  followUpStatus: FollowUpStatus | null;
  /** Derived bucket of the most pressing open follow-up, if any. */
  followUpBucket: FollowUpBucket | null;
  hasOverdueFollowUp: boolean;
}

export function buildPatientRows(
  patients: Patient[],
  screenings: Screening[],
  referrals: Referral[],
  followUps: FollowUp[],
): PatientRow[] {
  const screeningsByPatient = groupBy(screenings, (s) => s.patientId);
  const referralsByPatient = groupBy(referrals, (r) => r.patientId);
  const followUpsByPatient = groupBy(followUps, (f) => f.patientId);

  return patients.map((patient) => {
    const own = (screeningsByPatient.get(patient.id) ?? [])
      .slice()
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    const latest = own[0] ?? null;

    const latestReferral = (referralsByPatient.get(patient.id) ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    const own_followUps = followUpsByPatient.get(patient.id) ?? [];
    // The most pressing open task wins; otherwise fall back to the newest.
    const open = own_followUps
      .filter((f) => f.status === 'scheduled' || f.status === 'in-progress')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const representative =
      open[0] ??
      own_followUps.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return {
      patient,
      age: ageFromBirthDate(patient.birthDate),
      screeningCount: own.length,
      lastScreeningAt: latest?.performedAt ?? null,
      lastScreeningStatus: latest?.status ?? null,
      lastOutcome: latest?.analysis?.outcome ?? null,
      referralStatus: latestReferral?.status ?? null,
      followUpStatus: representative?.status ?? null,
      followUpBucket: representative ? followUpBucket(representative) : null,
      hasOverdueFollowUp: own_followUps.some(isOverdue),
    };
  });
}

/* ── Dashboard ─────────────────────────────────────────────────────────────── */

export interface ActivityPoint {
  date: ISODate;
  total: number;
  flagged: number;
}

export interface DashboardSummary {
  totalScreenings: number;
  screeningsThisWeek: number;
  awaitingReview: number;
  /** Referrals that still need operational action (not attended/closed). */
  pendingReferrals: number;
  overdueFollowUps: number;
  dueTodayFollowUps: number;
  upcomingFollowUps: number;
  flaggedAwaitingReview: number;
  inconclusiveOpen: number;
  draftRecords: number;
  pendingSyncRecords: number;
  failedSyncRecords: number;
  conflictRecords: number;
  activity: ActivityPoint[];
  outcomeBreakdown: { outcome: ScreeningOutcome; count: number }[];
}

const OPEN_REFERRAL_STATUSES: ReferralStatus[] = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'followup-required',
];

export function buildDashboardSummary(
  screenings: Screening[],
  referrals: Referral[],
  followUps: FollowUp[],
  syncQueue: { state: string }[],
  activityDays = 21,
): DashboardSummary {
  const days = lastNDays(activityDays);
  const counts = new Map<ISODate, { total: number; flagged: number }>(
    days.map((d) => [d, { total: 0, flagged: 0 }]),
  );

  screenings.forEach((screening) => {
    const day = toISODate(new Date(screening.performedAt));
    const bucket = counts.get(day);
    if (!bucket) return;
    bucket.total += 1;
    if (screening.analysis?.outcome === 'flagged-for-review') bucket.flagged += 1;
  });

  const activity: ActivityPoint[] = days.map((date) => ({
    date,
    total: counts.get(date)?.total ?? 0,
    flagged: counts.get(date)?.flagged ?? 0,
  }));

  const outcomeCounts: Record<ScreeningOutcome, number> = {
    'flagged-for-review': 0,
    'no-alert': 0,
    inconclusive: 0,
  };
  screenings.forEach((s) => {
    if (s.analysis) outcomeCounts[s.analysis.outcome] += 1;
  });

  const buckets = followUps.map(followUpBucket);

  return {
    totalScreenings: screenings.length,
    screeningsThisWeek: screenings.filter(
      (s) => daysFromToday(toISODate(new Date(s.performedAt))) >= -6,
    ).length,
    awaitingReview: screenings.filter((s) => s.status === 'awaiting-review').length,
    pendingReferrals: referrals.filter((r) => OPEN_REFERRAL_STATUSES.includes(r.status)).length,
    overdueFollowUps: buckets.filter((b) => b === 'overdue').length,
    dueTodayFollowUps: buckets.filter((b) => b === 'due-today').length,
    upcomingFollowUps: buckets.filter((b) => b === 'upcoming').length,
    flaggedAwaitingReview: screenings.filter(
      (s) => s.status === 'awaiting-review' && s.analysis?.outcome === 'flagged-for-review',
    ).length,
    inconclusiveOpen: screenings.filter(
      (s) =>
        s.analysis?.outcome === 'inconclusive' && s.status !== 'closed' && s.status !== 'referred',
    ).length,
    draftRecords: screenings.filter((s) => s.status === 'draft').length,
    pendingSyncRecords: syncQueue.filter((i) => i.state === 'pending').length,
    failedSyncRecords: syncQueue.filter((i) => i.state === 'failed').length,
    conflictRecords: syncQueue.filter((i) => i.state === 'conflict').length,
    activity,
    outcomeBreakdown: (Object.keys(outcomeCounts) as ScreeningOutcome[]).map((outcome) => ({
      outcome,
      count: outcomeCounts[outcome],
    })),
  };
}

/* ── Utilities ─────────────────────────────────────────────────────────────── */

export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  items.forEach((item) => {
    const key = keyFn(item);
    const existing = map.get(key);
    if (existing) existing.push(item);
    else map.set(key, [item]);
  });
  return map;
}

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}
