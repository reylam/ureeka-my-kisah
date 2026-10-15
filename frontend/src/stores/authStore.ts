/**
 * Simulated authentication.
 *
 * This is a frontend prototype: there is no authentication server, no token,
 * and no credential verification beyond a local string comparison. Signing in
 * writes a flag to localStorage and nothing else. The login screen and the
 * profile menu both say so explicitly, so nobody mistakes this for real access
 * control.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/domain';
import { DEMO_PASSWORD, DEMO_USER_ID, users } from '@/data/users';

export interface AuthState {
  userId: string | null;
  signedInAt: string | null;
  signIn: (email: string, password: string) => { ok: true } | { ok: false; message: string };
  signOut: () => void;
  /** Switching the acting user is a demo affordance, not a real feature. */
  switchUser: (userId: string) => void;
}

export const DEMO_EMAIL = users.find((u) => u.id === DEMO_USER_ID)?.email ?? '';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      signedInAt: null,

      signIn: (email, password) => {
        const normalised = email.trim().toLowerCase();
        const match = users.find((u) => u.email.toLowerCase() === normalised);

        if (!match) {
          return {
            ok: false,
            message: 'No demo account matches that email address.',
          };
        }
        if (password !== DEMO_PASSWORD) {
          return { ok: false, message: 'Incorrect password for the demo account.' };
        }

        set({ userId: match.id, signedInAt: new Date().toISOString() });
        return { ok: true };
      },

      signOut: () => set({ userId: null, signedInAt: null }),

      switchUser: (userId) => {
        if (users.some((u) => u.id === userId)) set({ userId });
      },
    }),
    {
      name: 'sentratb.auth.v1',
      // Only the identity flag is persisted. There is nothing else to keep.
      partialize: (state) => ({ userId: state.userId, signedInAt: state.signedInAt }),
    },
  ),
);

/** The signed-in user, or null. Components should prefer `useCurrentUser`. */
export function selectCurrentUser(state: AuthState): User | null {
  if (!state.userId) return null;
  return users.find((u) => u.id === state.userId) ?? null;
}

export function useCurrentUser(): User | null {
  return useAuthStore(selectCurrentUser);
}

/** Non-reactive read, for use inside store actions that need an actor id. */
export function currentActorId(): string {
  return useAuthStore.getState().userId ?? DEMO_USER_ID;
}
