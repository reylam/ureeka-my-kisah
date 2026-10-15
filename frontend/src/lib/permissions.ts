import type { Account, AccountRole } from '@/types/account';

/**
 * Capability matrix.
 *
 * Guards and navigation both read from here, so there is one place that
 * answers "may this account do this" and no component invents its own rule.
 *
 * A standing caveat that belongs in the code and not only in a document: this
 * is a client-side check. It decides what the interface offers, and it cannot
 * decide what a determined person can reach, because the whole store lives in
 * their browser. Every permission below has to be enforced again on the server
 * once the API exists. The contract in `docs/api-contract.md` lists which
 * endpoint owns which check.
 */

export type Permission =
  /* Screening records */
  | 'screening:create'
  | 'screening:read:own'
  | 'screening:read:assigned'
  | 'screening:read:all'
  | 'screening:review'
  /* Patient records */
  | 'patient:read:own'
  | 'patient:read:assigned'
  | 'patient:manage'
  /* Care pathway */
  | 'referral:manage'
  | 'followup:manage'
  | 'followup:read:own'
  /* Directory and content */
  | 'facility:read'
  | 'facility:manage'
  | 'education:read'
  | 'content:manage'
  /* Administration */
  | 'account:manage'
  | 'audit:read'
  | 'offline-queue:read';

const PATIENT: Permission[] = [
  'screening:read:own',
  'patient:read:own',
  'followup:read:own',
  'facility:read',
  'education:read',
];

const PROFESSIONAL: Permission[] = [
  'screening:create',
  'screening:read:assigned',
  'screening:review',
  'patient:read:assigned',
  'patient:manage',
  'referral:manage',
  'followup:manage',
  'facility:read',
  'education:read',
  'offline-queue:read',
];

const ADMIN: Permission[] = [
  // Deliberately NOT 'screening:review'. Administrative access is not
  // clinical competence, and an admin signing off a radiograph review would
  // be the system inviting exactly the wrong thing.
  'screening:read:all',
  'patient:manage',
  'facility:read',
  'facility:manage',
  'education:read',
  'content:manage',
  'account:manage',
  'audit:read',
  'offline-queue:read',
];

export const ROLE_PERMISSIONS: Record<AccountRole, Permission[]> = {
  patient: PATIENT,
  professional: PROFESSIONAL,
  admin: ADMIN,
};

export const ROLE_LABEL: Record<AccountRole, string> = {
  patient: 'Patient',
  professional: 'Healthcare professional',
  admin: 'Administrator',
};

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<AccountRole, string> = {
  patient: '/me',
  professional: '/dashboard',
  admin: '/admin',
};

export function can(account: Account | null, permission: Permission): boolean {
  if (!account || account.status !== 'active') return false;
  return ROLE_PERMISSIONS[account.role].includes(permission);
}

export function canAny(account: Account | null, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(account, permission));
}

/**
 * Review sign-off needs both the coarse permission and the clinical role
 * underneath it: a community health worker is a professional account but is
 * not someone who signs off a radiograph review.
 */
export function canReviewScreenings(account: Account | null, staffCanReview: boolean): boolean {
  return can(account, 'screening:review') && staffCanReview;
}
