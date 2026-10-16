/**
 * The staff session.
 *
 * Identity is Supabase Auth: it checks the password, issues and refreshes the
 * tokens, and keeps the session across reloads. This store holds the account
 * the backend reports from `GET /auth/me` (name and role).
 *
 * It decides nothing about access. The role here is a copy for drawing the
 * right screens; every request is authorised again by the API and by the
 * database from the token alone.
 *
 * Patients never sign in. They have the access code their request returned.
 */

import { create } from 'zustand';
import type { AuthError } from '@supabase/supabase-js';
import type { Account } from '@/types/account';
import { ApiError, api, setUnauthorizedHandler } from '@/lib/apiClient';
import { isAuthConfigured } from '@/lib/env';
import { resetSession } from '@/lib/sessionReset';
import { requireSupabase, supabase } from '@/lib/supabase';

export type SignInResult = { ok: true; account: Account } | { ok: false; message: string };

export interface AuthState {
  /** `initializing` until the first session check has finished. */
  phase: 'initializing' | 'ready';
  account: Account | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<Account>;
}

const GENERIC_SIGN_IN_ERROR = 'Email atau password tidak cocok dengan akun petugas mana pun.';

const isNetworkError = (error: AuthError | Error) => /fetch|network|failed to/i.test(error.message);

export const useAuthStore = create<AuthState>()((set, get) => ({
  phase: 'initializing',
  account: null,

  /** Restore the session after a reload. Called once from `main.tsx`. */
  init: async () => {
    if (!supabase) {
      set({ phase: 'ready', account: null });
      return;
    }

    // Another tab signing out, or the refresh token being rejected, ends the
    // session here too.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && get().account) {
        resetSession();
        set({ account: null });
      }
    });

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      try {
        await get().refreshAccount();
      } catch {
        // Expired, revoked, suspended, no role, or the server is down: open signed out.
        set({ account: null });
      }
    }
    set({ phase: 'ready' });
  },

  signIn: async (email, password) => {
    if (!isAuthConfigured) {
      return { ok: false, message: 'Fitur masuk belum dikonfigurasi. Isi variabel Supabase di frontend/.env.' };
    }
    const client = requireSupabase();
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.code === 'user_banned' || /banned/i.test(error.message)) {
        return { ok: false, message: 'Akun ini ditangguhkan. Hubungi administrator.' };
      }
      // One message for every other cause, so the form cannot be used to find
      // out which addresses have accounts.
      return { ok: false, message: isNetworkError(error) ? 'Layanan masuk tidak bisa dijangkau.' : GENERIC_SIGN_IN_ERROR };
    }

    try {
      return { ok: true, account: await get().refreshAccount() };
    } catch (cause) {
      await client.auth.signOut();
      resetSession();
      set({ account: null });
      if (cause instanceof ApiError && (cause.code === 'ACCOUNT_SUSPENDED' || cause.code === 'NO_ROLE')) {
        return { ok: false, message: cause.message };
      }
      return {
        ok: false,
        message:
          cause instanceof ApiError && cause.status === 0
            ? 'Berhasil masuk, tapi server PARUPINTAS tidak bisa dijangkau.'
            : GENERIC_SIGN_IN_ERROR,
      };
    }
  },

  signOut: async () => {
    // Cleared first: a 401 from the logout call below must not start another
    // sign-out through the unauthorized handler.
    set({ account: null });
    resetSession();
    try {
      await api.post('/auth/logout').catch(() => undefined);
    } finally {
      await supabase?.auth.signOut().catch(() => undefined);
    }
  },

  refreshAccount: async () => {
    const { account } = await api.get<{ account: Account }>('/auth/me');
    set({ account });
    return account;
  },
}));

// A 401 from the API means the session is gone server-side. End it here
// instead of leaving a half-working page.
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().account) void useAuthStore.getState().signOut();
});

/** The signed-in account, or null. */
export function useCurrentAccount(): Account | null {
  return useAuthStore((state) => state.account);
}
