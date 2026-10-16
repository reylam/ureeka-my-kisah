import { ClipboardList, ListOrdered, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import type { AccountRole } from '@/types/account';

/**
 * Navigation, one list per role. A link that is present but blocked by a
 * guard is worse than no link, so each role sees only where it works.
 */

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

const REQUESTS: NavItem = {
  to: '/requests',
  label: 'Pendaftaran',
  icon: ClipboardList,
  description: 'Permintaan yang masuk hari ini, menunggu atau sedang diperiksa',
};

const QUEUE: NavItem = {
  to: '/queue',
  label: 'Antrean',
  icon: ListOrdered,
  description: 'Pasien yang sudah diperiksa, urut dari prioritas tertinggi',
};

const PATIENTS: NavItem = {
  to: '/patients',
  label: 'Pasien',
  icon: Users,
  description: 'Data pasien dan riwayat rontgennya',
};

const NAV: Record<AccountRole, NavItem[]> = {
  admin: [REQUESTS, QUEUE, PATIENTS],
  radiologist: [REQUESTS, QUEUE],
};

export function navItemsFor(role: AccountRole | null): NavItem[] {
  return role ? NAV[role] : [];
}
