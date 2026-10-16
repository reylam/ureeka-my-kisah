import { create } from 'zustand';
import type { Account, AccountRole, AccountStatus, AuditEntry, StaffProfile } from '@/types/account';
import { api, fetchAllPages } from '@/lib/apiClient';
import { onSessionReset } from '@/lib/sessionReset';
import { setStaffDirectory } from '@/data/users';
import { fetchStaff } from '@/services/referenceData';

/**
 * The account directory and audit log, for administrators.
 *
 * Both are read from the API and held here so the administration screens can
 * list and filter without refetching on every keystroke. Nothing is persisted:
 * the server is the record, and a reload asks it again.
 *
 * Role and status changes go to the API, which re-checks them (administrators
 * only, never on yourself, never the last active administrator) and writes the
 * audit entry itself. The audit log is therefore refreshed from the server
 * after each change, not appended to locally.
 */

const AUDIT_WINDOW = 200;

export interface AccountState {
  accounts: Account[];
  audit: AuditEntry[];
  loaded: boolean;

  loadAdminData: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  loadAudit: () => Promise<void>;

  setRole: (accountId: string, role: AccountRole) => Promise<void>;
  setStatus: (accountId: string, status: AccountStatus) => Promise<void>;
  /** Create or change the staff record (clinical role, facility, review rights). */
  saveStaffProfile: (accountId: string, input: StaffProfile) => Promise<void>;
  removeStaffProfile: (accountId: string) => Promise<void>;
  reset: () => void;
}

const empty = { accounts: [] as Account[], audit: [] as AuditEntry[], loaded: false };

export const useAccountStore = create<AccountState>()((set, get) => ({
  ...empty,

  loadAdminData: async () => {
    await Promise.all([get().loadAccounts(), get().loadAudit()]);
    set({ loaded: true });
  },

  loadAccounts: async () => {
    const accounts = await fetchAllPages<Account>('/accounts');
    set({ accounts });
  },

  loadAudit: async () => {
    const result = await api.getPage<AuditEntry>('/audit', { page: 1, pageSize: AUDIT_WINDOW });
    set({ audit: result.data });
  },

  setRole: async (accountId, role) => {
    const updated = await api.patch<Account>(`/accounts/${accountId}/role`, { role });
    set((state) => ({
      accounts: state.accounts.map((account) => (account.id === accountId ? updated : account)),
    }));
    await get().loadAudit();
  },

  setStatus: async (accountId, status) => {
    const updated = await api.patch<Account>(`/accounts/${accountId}/status`, { status });
    set((state) => ({
      accounts: state.accounts.map((account) => (account.id === accountId ? updated : account)),
    }));
    await get().loadAudit();
  },

  saveStaffProfile: async (accountId, input) => {
    const updated = await api.put<Account>(`/accounts/${accountId}/staff-profile`, input);
    set((state) => ({
      accounts: state.accounts.map((account) => (account.id === accountId ? updated : account)),
    }));
    // Names and review rights are looked up from the staff directory everywhere.
    setStaffDirectory(await fetchStaff());
    await get().loadAudit();
  },

  removeStaffProfile: async (accountId) => {
    const updated = await api.delete<Account>(`/accounts/${accountId}/staff-profile`);
    set((state) => ({
      accounts: state.accounts.map((account) => (account.id === accountId ? updated : account)),
    }));
    setStaffDirectory(await fetchStaff());
    await get().loadAudit();
  },

  reset: () => set({ ...empty }),
}));

onSessionReset(() => useAccountStore.getState().reset());
