/**
 * Mock API layer.
 *
 * This is the boundary where a real backend would attach. Every method is
 * async and returns plain data, so each one can be re-implemented as a `fetch`
 * call without touching a single component.
 *
 * Right now the "transport" is the local Zustand store plus a short artificial
 * delay, which is what lets the UI demonstrate loading states. Nothing here
 * talks to a network, and no endpoint URLs are invented.
 */

import type {
  Facility,
  FollowUp,
  Patient,
  Referral,
  Screening,
} from '@/types/domain';
import { useDataStore } from '@/stores/dataStore';
import type {
  NewFollowUpInput,
  NewPatientInput,
  NewReferralInput,
  NewScreeningInput,
} from '@/stores/dataStore';
import { facilities } from '@/data/facilities';
import {
  buildDashboardSummary,
  buildPatientRows,
  type DashboardSummary,
  type PatientRow,
} from '@/stores/selectors';
import { jitteredDelay } from './delay';

const READ_LATENCY = 260;
const WRITE_LATENCY = 420;

const state = () => useDataStore.getState();

/* ── Reads ─────────────────────────────────────────────────────────────────── */

export async function getPatients(): Promise<Patient[]> {
  await jitteredDelay(READ_LATENCY);
  return state().patients;
}

export async function getPatientRows(): Promise<PatientRow[]> {
  await jitteredDelay(READ_LATENCY);
  const { patients, screenings, referrals, followUps } = state();
  return buildPatientRows(patients, screenings, referrals, followUps);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  await jitteredDelay(READ_LATENCY);
  return state().patients.find((p) => p.id === id) ?? null;
}

export async function getScreenings(): Promise<Screening[]> {
  await jitteredDelay(READ_LATENCY);
  return state().screenings;
}

export async function getScreeningById(id: string): Promise<Screening | null> {
  await jitteredDelay(READ_LATENCY);
  return state().screenings.find((s) => s.id === id) ?? null;
}

export async function getReferrals(): Promise<Referral[]> {
  await jitteredDelay(READ_LATENCY);
  return state().referrals;
}

export async function getFollowUps(): Promise<FollowUp[]> {
  await jitteredDelay(READ_LATENCY);
  return state().followUps;
}

/** Facilities are static reference data, not user records. */
export async function getFacilities(): Promise<Facility[]> {
  await jitteredDelay(READ_LATENCY);
  return facilities;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await jitteredDelay(READ_LATENCY);
  const { screenings, referrals, followUps, syncQueue } = state();
  return buildDashboardSummary(screenings, referrals, followUps, syncQueue);
}

/* ── Writes ────────────────────────────────────────────────────────────────── */

export async function createPatient(input: NewPatientInput): Promise<Patient> {
  await jitteredDelay(WRITE_LATENCY);
  return state().createPatient(input);
}

export async function createScreening(input: NewScreeningInput): Promise<Screening> {
  await jitteredDelay(WRITE_LATENCY);
  return state().createScreening(input);
}

export async function createReferral(input: NewReferralInput): Promise<Referral> {
  await jitteredDelay(WRITE_LATENCY);
  return state().createReferral(input);
}

export async function updateReferral(
  id: string,
  patch: Parameters<ReturnType<typeof state>['updateReferral']>[1],
): Promise<void> {
  await jitteredDelay(WRITE_LATENCY);
  state().updateReferral(id, patch);
}

export async function createFollowUp(input: NewFollowUpInput): Promise<FollowUp> {
  await jitteredDelay(WRITE_LATENCY);
  return state().createFollowUp(input);
}

export async function updateFollowUp(
  id: string,
  patch: { dueDate?: string; assignedWorkerId?: string },
): Promise<void> {
  await jitteredDelay(WRITE_LATENCY);
  if (patch.dueDate) state().rescheduleFollowUp(id, patch.dueDate);
  if (patch.assignedWorkerId) state().reassignFollowUp(id, patch.assignedWorkerId);
}

export const mockApi = {
  getPatients,
  getPatientRows,
  getPatientById,
  getScreenings,
  getScreeningById,
  getReferrals,
  getFollowUps,
  getFacilities,
  getDashboardSummary,
  createPatient,
  createScreening,
  createReferral,
  updateReferral,
  createFollowUp,
  updateFollowUp,
};
