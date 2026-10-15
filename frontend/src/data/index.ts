/**
 * Barrel for the demo data layer.
 *
 * Static reference data (facilities, staff, geography, model descriptor) lives
 * in its own module. The relational records (patients, screenings, referrals
 * and follow-ups) are generated together in `seed.ts` so their foreign keys
 * are guaranteed to line up, rather than being hand-maintained per page.
 */

export { facilities, referralTargetIds, OPERATING_FACILITY_ID } from './facilities';
export { users, usersById, assignableWorkerIds, DEMO_PASSWORD, DEMO_USER_ID } from './users';
export { PROVINCE, DISTRICTS, VILLAGES, VILLAGE_INDEX } from './geography';
export type { District } from './geography';
export { DEMO_MODEL, SIMULATED_RESULT_NOTICE } from './model';
export { createSeedDataset } from './seed';
export type { SeedDataset } from './seed';
