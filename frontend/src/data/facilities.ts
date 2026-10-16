import type { Facility } from '@/types/domain';

/**
 * Facility directory.
 *
 * A registry filled from `GET /facilities` by `services/referenceData.ts`; the
 * hard-coded sample entries that used to live here are now rows in the
 * database (see `backend/supabase/seed.sql`). Like `data/users.ts`, the arrays
 * are filled in place so existing imports stay valid.
 *
 * `OPERATING_FACILITY_ID` is the signed-in professional's own facility. It is
 * an ES live binding: importers see the new value after `setFacilityDirectory`
 * runs. It is an empty string for roles without a facility.
 */

export const facilities: Facility[] = [];

export let OPERATING_FACILITY_ID = '';

/** Facilities that can receive a referral, i.e. offer more than the basics. */
export const referralTargetIds: string[] = [];

export function setFacilityDirectory(list: Facility[], operatingFacilityId: string | null): void {
  facilities.splice(0, facilities.length, ...list);
  OPERATING_FACILITY_ID = operatingFacilityId ?? '';
  referralTargetIds.splice(
    0,
    referralTargetIds.length,
    ...list.filter((f) => f.id !== OPERATING_FACILITY_ID && f.services.length > 2).map((f) => f.id),
  );
}

export function clearFacilityDirectory(): void {
  setFacilityDirectory([], null);
}
