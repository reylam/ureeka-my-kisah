/**
 * Records API.
 *
 * The seam between the pages and the backend. Reads ask the API for the
 * current data, put it in the data store and return it, so a page that calls
 * `getReferrals()` gets what the server holds right now and keeps receiving
 * live updates through `useStoreQuery`. Writes delegate to the data store,
 * whose actions call the API and then update the cache with the response.
 *
 * Nothing here is simulated: there is no artificial delay and no invented
 * data. A failed request rejects, and the page's error state shows it.
 */

import type { Facility, FollowUp, Patient, Referral, Screening } from '@/types/domain';
import { ApiError, api } from '@/lib/apiClient';
import { useDataStore } from '@/stores/dataStore';
import type {
  NewFollowUpInput,
  NewPatientInput,
  NewReferralInput,
  NewScreeningInput,
} from '@/stores/dataStore';
import { useAuthStore } from '@/stores/authStore';
import { fetchFacilities } from '@/services/referenceData';
import { buildPatientRows, type DashboardSummary, type PatientRow } from '@/stores/selectors';

const store = () => useDataStore.getState();

/** Re-read the signed-in person's records from the server. */
async function refresh(): Promise<void> {
  const account = useAuthStore.getState().account;
  if (!account) return;
  await store().hydrate(account);
}

const isNotFound = (cause: unknown) => cause instanceof ApiError && cause.status === 404;

/* ── Reads ─────────────────────────────────────────────────────────────────── */

export async function getPatients(): Promise<Patient[]> {
  await refresh();
  return store().patients;
}

export async function getPatientRows(): Promise<PatientRow[]> {
  await refresh();
  const { patients, screenings, referrals, followUps } = store();
  return buildPatientRows(patients, screenings, referrals, followUps);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  try {
    return await store().loadPatient(id);
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
}

export async function getScreenings(): Promise<Screening[]> {
  await refresh();
  return store().screenings;
}

export async function getScreeningById(id: string): Promise<Screening | null> {
  try {
    return await store().loadScreening(id);
  } catch (cause) {
    if (isNotFound(cause)) return null;
    throw cause;
  }
}

export async function getReferrals(): Promise<Referral[]> {
  await refresh();
  return store().referrals;
}

export async function getFollowUps(): Promise<FollowUp[]> {
  await refresh();
  return store().followUps;
}

export async function getFacilities(): Promise<Facility[]> {
  return fetchFacilities();
}

/**
 * Dashboard figures, computed by the database (`dashboard_summary`) over the
 * records the caller may see. Only the offline-outbox counts come from this
 * device, because the outbox exists only here.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [summary] = await Promise.all([
    api.get<Omit<DashboardSummary, 'pendingSyncRecords' | 'failedSyncRecords' | 'conflictRecords'>>(
      '/dashboard/summary',
      // Bucket days the way this browser's user sees them.
      { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    ),
    refresh(),
  ]);
  const { syncQueue } = store();
  return {
    ...summary,
    pendingSyncRecords: syncQueue.filter((i) => i.state === 'pending').length,
    failedSyncRecords: syncQueue.filter((i) => i.state === 'failed').length,
    conflictRecords: 0,
  };
}

/** Short-lived signed URL for a screening's radiograph (treating team only). */
export async function getScreeningImageUrl(id: string): Promise<string> {
  const result = await api.get<{ url: string; expiresInSeconds: number }>(`/screenings/${id}/image`);
  return result.url;
}

/* ── Writes ────────────────────────────────────────────────────────────────── */

export const createPatient = (input: NewPatientInput): Promise<Patient> =>
  store().createPatient(input);

export const createScreening = (input: NewScreeningInput): Promise<Screening> =>
  store().createScreening(input);

export const createReferral = (input: NewReferralInput): Promise<Referral> =>
  store().createReferral(input);

export const updateReferral = (
  id: string,
  patch: Parameters<ReturnType<typeof store>['updateReferral']>[1],
): Promise<void> => store().updateReferral(id, patch);

export const createFollowUp = (input: NewFollowUpInput): Promise<FollowUp> =>
  store().createFollowUp(input);

export async function updateFollowUp(
  id: string,
  patch: { dueDate?: string; assignedWorkerId?: string },
): Promise<void> {
  if (patch.dueDate) await store().rescheduleFollowUp(id, patch.dueDate);
  if (patch.assignedWorkerId) await store().reassignFollowUp(id, patch.assignedWorkerId);
}

export const recordsApi = {
  getPatients,
  getPatientRows,
  getPatientById,
  getScreenings,
  getScreeningById,
  getReferrals,
  getFollowUps,
  getFacilities,
  getDashboardSummary,
  getScreeningImageUrl,
  createPatient,
  createScreening,
  createReferral,
  updateReferral,
  createFollowUp,
  updateFollowUp,
};
