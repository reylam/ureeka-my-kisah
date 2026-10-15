/**
 * The session.
 *
 * Holds one thing: which account is signed in. The account directory lives in
 * `accountStore`, so signing out does not disturb it and the administrator
 * screens do not have to go through the session to read it.
 *
 * What this is: a working sign-in flow with roles, permissions and route
 * gating, so the interface can be reviewed and so the API contract is already
 * shaped. What it is not: a security boundary. The session is a key in
 * localStorage and the directory sits beside it, both reachable from the
 * console. Nothing here can stop someone editing their own role, and no amount
 * of frontend work can. Every check has to be repeated server-side.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/domain';
import type { Account } from '@/types/account';
import { users } from '@/data/users';
import { useAccountStore } from './accountStore';

export type SignInResult = { ok: true; account: Account } | { ok: false; message: string };

export interface AuthState {
  accountId: string | null;
  signedInAt: string | null;
  signIn: (email: string, password: string) => SignInResult;
  signInAs: (accountId: string) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accountId: null,
      signedInAt: null,

      signIn: (email, password) => {
        const store = useAccountStore.getState();
        const account = store.verify(email, password);

        if (!account) {
          // One message for both causes. Telling an unauthenticated caller
          // which half was wrong hands them a way to enumerate addresses.
          return { ok: false, message: 'Those credentials do not match an account.' };
        }
        if (account.status !== 'active') {
          return {
            ok: false,
            message: 'This account has been suspended. Contact an administrator.',
          };
        }

        store.recordSignIn(account.id);
        set({ accountId: account.id, signedInAt: new Date().toISOString() });
        return { ok: true, account };
      },

      /** Used straight after registration, so the new patient is not asked to sign in again. */
      signInAs: (accountId) =>
        set({ accountId, signedInAt: new Date().toISOString() }),

      signOut: () => set({ accountId: null, signedInAt: null }),
    }),
    {
      name: 'pulmo.session.v1',
      partialize: (state) => ({ accountId: state.accountId, signedInAt: state.signedInAt }),
    },
  ),
);

/* ── Reading the current account ──────────────────────────────────────────── */

/**
 * The signed-in account, or null.
 *
 * Subscribes to both stores: the session for the id and the directory for the
 * row, so a role change or a suspension takes effect without a reload.
 */
export function useCurrentAccount(): Account | null {
  const accountId = useAuthStore((state) => state.accountId);
  const accounts = useAccountStore((state) => state.accounts);
  if (!accountId) return null;
  return accounts.find((account) => account.id === accountId) ?? null;
}

export function currentAccount(): Account | null {
  const { accountId } = useAuthStore.getState();
  if (!accountId) return null;
  return useAccountStore.getState().findById(accountId) ?? null;
}

/* ── Bridge to the clinical staff record ──────────────────────────────────── */

/**
 * The staff record behind a professional or administrator account.
 *
 * The clinical screens were built against `User` (facility, `canReview`, and
 * so on) and still are. Patient accounts have no staff record and get null,
 * which is correct: they never render those screens.
 */
export function useCurrentUser(): User | null {
  const account = useCurrentAccount();
  if (!account?.staffUserId) return null;
  return users.find((user) => user.id === account.staffUserId) ?? null;
}

/**
 * Actor id for stamping records in `dataStore`.
 *
 * Falls back to the account id when there is no staff record, so an action is
 * never attributed to a staff member who did not perform it.
 */
export function currentActorId(): string {
  const account = currentAccount();
  return account?.staffUserId ?? account?.id ?? 'unknown';
}
