import { useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { useCurrentAccount } from '@/stores/authStore';
import type { FollowUp, Patient, Referral, Screening } from '@/types/domain';
import type { PatientStage } from '@/data/education';

/**
 * Everything the signed-in patient is allowed to see about themselves.
 *
 * One hook, because the alternative is every patient page filtering the store
 * by `patientId` itself and one of them eventually getting it wrong. Filtering
 * happens here and nowhere else.
 *
 * The scoping is by `account.patientId`. An account with no clinical record
 * yet gets empty arrays rather than everything, which is the safe direction to
 * fail in. The same filter has to exist server-side: this one decides what the
 * interface renders, not what the browser could request.
 */
export interface PatientRecords {
  patient: Patient | null;
  screenings: Screening[];
  referrals: Referral[];
  followUps: FollowUp[];
  /** Latest screening by date, or null. */
  latest: Screening | null;
  /** Coarse position in the care pathway, used to suggest reading. */
  stage: PatientStage;
  /** True when the account has no clinical record at all. */
  empty: boolean;
}

export function usePatientRecords(): PatientRecords {
  const account = useCurrentAccount();
  const patientId = account?.patientId ?? null;

  const patients = useDataStore((state) => state.patients);
  const allScreenings = useDataStore((state) => state.screenings);
  const allReferrals = useDataStore((state) => state.referrals);
  const allFollowUps = useDataStore((state) => state.followUps);

  return useMemo(() => {
    if (!patientId) {
      return {
        patient: null,
        screenings: [],
        referrals: [],
        followUps: [],
        latest: null,
        stage: 'new' as PatientStage,
        empty: true,
      };
    }

    const patient = patients.find((item) => item.id === patientId) ?? null;
    const screenings = allScreenings
      .filter((item) => item.patientId === patientId)
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    const referrals = allReferrals
      .filter((item) => item.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const followUps = allFollowUps
      .filter((item) => item.patientId === patientId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const latest = screenings[0] ?? null;

    // Coarse on purpose: derived from workflow state the patient can already
    // see, never from an analysis outcome.
    let stage: PatientStage = 'new';
    if (referrals.some((item) => ['referred', 'appointment-scheduled', 'attended'].includes(item.status))) {
      stage = 'referred';
    } else if (followUps.some((item) => item.reason === 'treatment-adherence')) {
      stage = 'in-treatment';
    } else if (latest && ['queued', 'awaiting-review'].includes(latest.status)) {
      stage = 'awaiting-result';
    } else if (latest) {
      stage = 'awaiting-result';
    }

    return {
      patient,
      screenings,
      referrals,
      followUps,
      latest,
      stage,
      empty: !patient && screenings.length === 0,
    };
  }, [patientId, patients, allScreenings, allReferrals, allFollowUps]);
}
