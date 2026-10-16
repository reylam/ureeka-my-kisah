/**
 * The session.
 *
 * Identity is Supabase Auth: it checks the password, issues and refreshes the
 * tokens, and keeps the session across reloads. This store holds what the
 * interface needs on top of that, the signed-in person's account (role,
 * status, onboarding) as the backend reports it from `GET /auth/me`.
 *
 * What it deliberately does not do: decide anything about access. The role
 * shown here is a copy for rendering the right screens. Every request is
 * authorised again by the API and by Row Level Security from the token alone,
 * so editing this store in devtools changes what the page draws and nothing
 * else.
 */

import { create } from 'zustand';
import type { AuthError } from '@supabase/supabase-js';
import type { User } from '@/types/domain';
import type { Account } from '@/types/account';
import { ApiError, api, setUnauthorizedHandler } from '@/lib/apiClient';
import { isAuthConfigured } from '@/lib/env';
import { resetSession } from '@/lib/sessionReset';
import { requireSupabase, supabase } from '@/lib/supabase';
import { usersById } from '@/data/users';
import { loadReferenceData, clearReferenceData } from '@/services/referenceData';
import { useFacilityStore } from './facilityStore';
import { useDataStore } from './dataStore';
import { useAccountStore } from './accountStore';
import { useModelStore } from './modelStore';

export type SignInResult = { ok: true; account: Account } | { ok: false; message: string };

export type RegisterResult =
  | { ok: true; confirmationRequired: boolean }
  | { ok: false; field: 'email' | 'password' | 'name' | 'form'; message: string };

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** `initializing` until the first session check has finished. */
type Phase = 'initializing' | 'ready';
/** Loading the signed-in person's records and the reference data. */
type Workspace = 'idle' | 'loading' | 'ready' | 'error';

export interface AuthState {
  phase: Phase;
  account: Account | null;
  /** Kept for screens that only ask "is anyone signed in". */
  accountId: string | null;
  workspace: Workspace;
  workspaceError: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  signOut: () => Promise<void>;
  setAccount: (account: Account) => void;
  refreshAccount: () => Promise<Account | null>;
  loadWorkspace: () => Promise<void>;
}

const GENERIC_SIGN_IN_ERROR = 'Those credentials do not match an account.';

const signedOut = {
  account: null,
  accountId: null,
  workspace: 'idle' as Workspace,
  workspaceError: null,
};

function isSuspended(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ACCOUNT_SUSPENDED';
}

function isNetworkError(error: AuthError | Error): boolean {
  return /fetch|network|failed to/i.test(error.message);
}

/** Empty everything that belonged to the previous person. */
function clearLocalSession(): void {
  clearReferenceData();
  resetSession();
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  phase: 'initializing',
  ...signedOut,

  /** Restore the session after a reload. Called once from `main.tsx`. */
  init: async () => {
    if (!supabase) {
      set({ phase: 'ready', ...signedOut });
      return;
    }

    // Another tab signing out, or the refresh token being rejected, should
    // end the session here too.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && get().account) {
        clearLocalSession();
        set({ ...signedOut });
      }
    });

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      set({ phase: 'ready', ...signedOut });
      return;
    }

    let account: Account | null = null;
    try {
      account = await get().refreshAccount();
    } catch {
      // Expired, revoked, suspended or the server is down: open signed out.
      account = null;
    }
    set({ phase: 'ready' });
    if (account) void get().loadWorkspace();
  },

  signIn: async (email, password) => {
    if (!isAuthConfigured) {
      return {
        ok: false,
        message:
          'Sign-in is not configured for this build. Set the Supabase variables in frontend/.env.',
      };
    }
    const client = requireSupabase();
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      // A suspended account is banned in Supabase Auth; the service says so only
      // after the password was right, so this does not reveal who has an account.
      if (error.code === 'user_banned' || /banned/i.test(error.message)) {
        return { ok: false, message: 'This account has been suspended. Contact an administrator.' };
      }
      // One message for every other cause, so the form cannot be used to find out
      // which addresses have accounts. Only a network failure is told apart.
      return {
        ok: false,
        message: isNetworkError(error) ? 'Could not reach the sign-in service.' : GENERIC_SIGN_IN_ERROR,
      };
    }

    try {
      const account = await get().refreshAccount();
      if (!account) throw new ApiError(401, 'UNAUTHORIZED', GENERIC_SIGN_IN_ERROR);
      void get().loadWorkspace();
      return { ok: true, account };
    } catch (cause) {
      await client.auth.signOut();
      clearLocalSession();
      set({ ...signedOut });
      if (isSuspended(cause)) {
        return { ok: false, message: 'This account has been suspended. Contact an administrator.' };
      }
      return {
        ok: false,
        message:
          cause instanceof ApiError && cause.status === 0
            ? 'Signed in, but the PULMO server could not be reached.'
            : GENERIC_SIGN_IN_ERROR,
      };
    }
  },

  register: async ({ name, email, password }) => {
    if (!isAuthConfigured) {
      return {
        ok: false,
        field: 'form',
        message:
          'Sign-up is not configured for this build. Set the Supabase variables in frontend/.env.',
      };
    }
    const client = requireSupabase();
    // The role is not part of this call and cannot be: the database trigger
    // gives every new account the patient role, whatever metadata arrives.
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('already') || message.includes('registered')) {
        return { ok: false, field: 'email', message: 'An account already exists for that email address.' };
      }
      if (message.includes('password')) {
        return { ok: false, field: 'password', message: error.message };
      }
      // Supabase Auth limits sign-up e-mails and requests per hour. That limit
      // lives in the Auth service, not in the PULMO API.
      if (error.status === 429 || message.includes('rate limit') || /over_.*_rate_limit/.test(String(error.code))) {
        return {
          ok: false,
          field: 'form',
          message: 'Too many sign-up attempts right now. Please wait a few minutes and try again.',
        };
      }
      return {
        ok: false,
        field: 'form',
        message: isNetworkError(error) ? 'Could not reach the sign-up service.' : error.message,
      };
    }

    // With email confirmation switched on there is no session yet.
    if (!data.session) return { ok: true, confirmationRequired: true };

    try {
      await get().refreshAccount();
      void get().loadWorkspace();
    } catch {
      // The account exists; the next sign-in will pick it up.
    }
    return { ok: true, confirmationRequired: false };
  },

  signOut: async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      clearLocalSession();
      set({ ...signedOut });
    }
  },

  setAccount: (account) => set({ account, accountId: account.id }),

  refreshAccount: async () => {
    const result = await api.get<{ account: Account }>('/auth/me');
    set({ account: result.account, accountId: result.account.id });
    return result.account;
  },

  loadWorkspace: async () => {
    const account = get().account;
    if (!account) return;
    set({ workspace: 'loading', workspaceError: null });
    try {
      void useModelStore.getState().load();
      const facilities = await loadReferenceData(account);
      useFacilityStore.getState().replaceAll(facilities);
      await Promise.all([
        useDataStore.getState().hydrate(account),
        account.role === 'admin' ? useAccountStore.getState().loadAdminData() : Promise.resolve(),
      ]);
      // The session may have ended while this was loading.
      if (get().account?.id === account.id) set({ workspace: 'ready' });
    } catch (cause) {
      if (get().account?.id !== account.id) return;
      set({
        workspace: 'error',
        workspaceError:
          cause instanceof Error && cause.message ? cause.message : 'Could not load your workspace.',
      });
    }
  },
}));

// A 401 from the API means the session is gone server-side (expired, revoked,
// account removed). End it here instead of leaving a half-working page.
setUnauthorizedHandler(() => {
  if (!useAuthStore.getState().account) return;
  void useAuthStore.getState().signOut();
});

/* ── Reading the current account ──────────────────────────────────────────── */

/** The signed-in account, or null. */
export function useCurrentAccount(): Account | null {
  return useAuthStore((state) => state.account);
}

export function currentAccount(): Account | null {
  return useAuthStore.getState().account;
}

/**
 * The staff record behind a professional or administrator account, from the
 * staff directory. Patients have none and get null.
 */
export function useCurrentUser(): User | null {
  const account = useAuthStore((state) => state.account);
  // Re-render when the directory finishes loading.
  useAuthStore((state) => state.workspace);
  if (!account?.staffUserId) return null;
  return usersById.get(account.staffUserId) ?? null;
}

/** Actor id for display; the server stamps the real one on every write. */
export function currentActorId(): string {
  const account = currentAccount();
  return account?.staffUserId ?? account?.id ?? 'unknown';
}
