import type { AccountRole } from '@/types/account';

/**
 * What each role is called and where it lands. Interface only: every request
 * is authorised again by the API and by the database.
 */

export const ROLE_LABEL: Record<AccountRole, string> = {
  admin: 'Admin',
  radiologist: 'Dokter Sp. Radiologi',
};

export const ROLE_HOME: Record<AccountRole, string> = {
  admin: '/requests',
  radiologist: '/requests',
};
