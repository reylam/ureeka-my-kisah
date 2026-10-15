import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Account,
  AccountRole,
  AccountStatus,
  AuditAction,
  AuditEntry,
  OnboardingAddress,
  OnboardingConsent,
  OnboardingHealth,
  OnboardingPersonal,
} from '@/types/account';
import { EMPTY_ONBOARDING } from '@/types/account';
import { seedAccounts } from '@/data/accounts';
import { createSalt, hashPassword, verifyPassword } from '@/lib/password';
import { createId } from '@/utils/id';

/**
 * The account directory.
 *
 * Separate from `authStore`, which only holds who is signed in. Keeping the
 * directory apart means the administrator screens can list, search and change
 * accounts without touching the session, and signing out does not drop the
 * registry.
 *
 * Registration always produces a patient. There is no role argument on
 * `register` at all, which is the cheapest way to guarantee the rule: a caller
 * cannot ask for something else because there is nothing to ask with. Roles
 * change only through `setRole`, which the interface exposes to administrators
 * and which writes an audit entry every time.
 */

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export type RegisterResult =
  | { ok: true; account: Account }
  | { ok: false; field: 'email' | 'password' | 'name'; message: string };

export interface AccountState {
  accounts: Account[];
  audit: AuditEntry[];

  findByEmail: (email: string) => Account | undefined;
  findById: (id: string) => Account | undefined;

  register: (input: RegisterInput) => RegisterResult;
  verify: (email: string, password: string) => Account | null;
  recordSignIn: (accountId: string) => void;

  /* Onboarding, saved per step so a half-finished wizard resumes. */
  saveOnboardingPersonal: (accountId: string, value: OnboardingPersonal) => void;
  saveOnboardingAddress: (accountId: string, value: OnboardingAddress) => void;
  saveOnboardingHealth: (accountId: string, value: OnboardingHealth) => void;
  completeOnboarding: (accountId: string, consent: OnboardingConsent) => void;
  reopenOnboarding: (accountId: string, step: number) => void;

  /* Administration */
  setRole: (accountId: string, role: AccountRole, actor: Account) => void;
  setStatus: (accountId: string, status: AccountStatus, actor: Account) => void;
  linkStaffUser: (accountId: string, staffUserId: string | null, actor: Account) => void;
  log: (actor: Account, action: AuditAction, subject: string, detail?: string | null) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: seedAccounts,
      audit: [],

      findByEmail: (email) => {
        const normalised = email.trim().toLowerCase();
        return get().accounts.find((account) => account.email.toLowerCase() === normalised);
      },

      findById: (id) => get().accounts.find((account) => account.id === id),

      register: ({ name, email, password }) => {
        const trimmedName = name.trim();
        const normalisedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 2) {
          return { ok: false, field: 'name', message: 'Please enter your full name.' };
        }
        if (!EMAIL_PATTERN.test(normalisedEmail)) {
          return { ok: false, field: 'email', message: 'Enter a valid email address.' };
        }
        if (get().findByEmail(normalisedEmail)) {
          return {
            ok: false,
            field: 'email',
            message: 'An account already exists for that email address.',
          };
        }

        const salt = createSalt();
        const account: Account = {
          id: createId('acc'),
          name: trimmedName,
          email: normalisedEmail,
          passwordHash: hashPassword(password, salt),
          passwordSalt: salt,
          // Not a parameter. See the note at the top of this file.
          role: 'patient',
          status: 'active',
          createdAt: new Date().toISOString(),
          lastSignInAt: null,
          staffUserId: null,
          patientId: null,
          onboarding: {
            ...EMPTY_ONBOARDING,
            // Carry the name forward so step 1 is already half filled.
            personal: { fullName: trimmedName, birthDate: '', phone: '', sex: null },
          },
        };

        set((state) => ({
          accounts: [...state.accounts, account],
          audit: [
            {
              id: createId('aud'),
              at: account.createdAt,
              actorId: account.id,
              actorName: account.name,
              action: 'account.created',
              subject: account.email,
              detail: 'Self-registered. Assigned the patient role.',
            },
            ...state.audit,
          ],
        }));

        return { ok: true, account };
      },

      verify: (email, password) => {
        const account = get().findByEmail(email);
        if (!account) return null;
        if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) return null;
        return account;
      },

      recordSignIn: (accountId) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? { ...account, lastSignInAt: new Date().toISOString() }
              : account,
          ),
        })),

      /* ── Onboarding ───────────────────────────────────────────────────── */

      saveOnboardingPersonal: (accountId, value) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  name: value.fullName.trim() || account.name,
                  onboarding: {
                    ...account.onboarding,
                    personal: value,
                    step: Math.max(account.onboarding.step, 1),
                  },
                }
              : account,
          ),
        })),

      saveOnboardingAddress: (accountId, value) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  onboarding: {
                    ...account.onboarding,
                    address: value,
                    step: Math.max(account.onboarding.step, 2),
                  },
                }
              : account,
          ),
        })),

      saveOnboardingHealth: (accountId, value) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  onboarding: {
                    ...account.onboarding,
                    health: value,
                    step: Math.max(account.onboarding.step, 3),
                  },
                }
              : account,
          ),
        })),

      completeOnboarding: (accountId, consent) => {
        const account = get().findById(accountId);
        set((state) => ({
          accounts: state.accounts.map((item) =>
            item.id === accountId
              ? {
                  ...item,
                  onboarding: {
                    ...item.onboarding,
                    consent,
                    step: 3,
                    completedAt: consent.acceptedAt,
                  },
                }
              : item,
          ),
          audit: account
            ? [
                {
                  id: createId('aud'),
                  at: consent.acceptedAt,
                  actorId: account.id,
                  actorName: account.name,
                  action: 'onboarding.completed' as AuditAction,
                  subject: account.email,
                  detail: consent.healthInfo
                    ? 'Consented to health information use.'
                    : 'Declined health information use.',
                },
                ...state.audit,
              ]
            : state.audit,
        }));
      },

      reopenOnboarding: (accountId, step) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  onboarding: { ...account.onboarding, completedAt: null, step },
                }
              : account,
          ),
        })),

      /* ── Administration ───────────────────────────────────────────────── */

      setRole: (accountId, role, actor) => {
        const target = get().findById(accountId);
        if (!target || target.role === role) return;
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId ? { ...account, role } : account,
          ),
        }));
        get().log(actor, 'account.role-changed', target.email, `${target.role} to ${role}`);
      },

      setStatus: (accountId, status, actor) => {
        const target = get().findById(accountId);
        if (!target || target.status === status) return;
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId ? { ...account, status } : account,
          ),
        }));
        get().log(
          actor,
          status === 'suspended' ? 'account.suspended' : 'account.reactivated',
          target.email,
          null,
        );
      },

      linkStaffUser: (accountId, staffUserId, actor) => {
        const target = get().findById(accountId);
        if (!target) return;
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === accountId ? { ...account, staffUserId } : account,
          ),
        }));
        get().log(
          actor,
          'account.role-changed',
          target.email,
          staffUserId ? `Linked to staff record ${staffUserId}` : 'Unlinked from staff record',
        );
      },

      log: (actor, action, subject, detail = null) =>
        set((state) => ({
          audit: [
            {
              id: createId('aud'),
              at: new Date().toISOString(),
              actorId: actor.id,
              actorName: actor.name,
              action,
              subject,
              detail,
            },
            ...state.audit,
          ].slice(0, 200),
        })),
    }),
    {
      name: 'pulmo.accounts.v1',
      partialize: (state) => ({ accounts: state.accounts, audit: state.audit }),
      /**
       * Seed accounts are code, not user data. Merging them back in on every
       * load means adding or fixing one does not require the visitor to clear
       * their storage, while anything they registered themselves survives.
       */
      merge: (persisted, current) => {
        const saved = (persisted as Partial<AccountState> | undefined) ?? {};
        const savedAccounts = saved.accounts ?? [];
        const seededIds = new Set(seedAccounts.map((account) => account.id));
        return {
          ...current,
          ...saved,
          accounts: [
            ...seedAccounts.map((seed) => {
              // Keep per-account state the visitor changed, but take the
              // credentials and role from code.
              const existing = savedAccounts.find((account) => account.id === seed.id);
              return existing
                ? {
                    ...seed,
                    status: existing.status,
                    lastSignInAt: existing.lastSignInAt,
                    onboarding: existing.onboarding ?? seed.onboarding,
                  }
                : seed;
            }),
            ...savedAccounts.filter((account) => !seededIds.has(account.id)),
          ],
          audit: saved.audit ?? [],
        } as AccountState;
      },
    },
  ),
);
