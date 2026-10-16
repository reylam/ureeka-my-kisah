/**
 * Barrel for reference data.
 *
 * Facilities and staff are registries filled from the API (see
 * `services/referenceData.ts`). Geography and the model descriptor are static.
 * Patient, screening, referral and follow-up records are not here at all: they
 * come from the API through `stores/dataStore.ts`.
 */

export { facilities, referralTargetIds, OPERATING_FACILITY_ID } from './facilities';
export { users, usersById, assignableWorkerIds } from './users';
export { PROVINCE, DISTRICTS, VILLAGES, VILLAGE_INDEX } from './geography';
export type { District } from './geography';
export { DEMO_MODEL, SIMULATED_RESULT_NOTICE } from './model';
