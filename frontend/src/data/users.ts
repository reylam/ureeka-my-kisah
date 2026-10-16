import type { User } from '@/types/domain';

/**
 * Staff directory.
 *
 * This used to be a hard-coded array of fictional people. It is now a registry
 * that `services/referenceData.ts` fills from `GET /staff` once the session is
 * known, so every screen that looks a name up by id keeps working unchanged.
 *
 * The arrays and the map are filled *in place*, never replaced, so modules
 * that imported them earlier still see the current contents. The workspace is
 * not rendered until the first load finishes (see `RequireAuth`), so a page
 * never reads these while empty.
 */

export const users: User[] = [];

export const usersById = new Map<string, User>();

/** Field workers who can be assigned referrals and follow-ups. */
export const assignableWorkerIds: string[] = [];

export function setStaffDirectory(list: User[]): void {
  users.splice(0, users.length, ...list);
  usersById.clear();
  for (const user of list) usersById.set(user.id, user);
  assignableWorkerIds.splice(
    0,
    assignableWorkerIds.length,
    ...list
      .filter((u) => u.role === 'chw' || u.role === 'nurse' || u.role === 'physician')
      .map((u) => u.id),
  );
}

export function clearStaffDirectory(): void {
  setStaffDirectory([]);
}
