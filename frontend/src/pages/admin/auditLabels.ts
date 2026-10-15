import type { AuditAction } from '@/types/account';

/** Human wording for audit entries, kept out of the pages that render them. */
export const AUDIT_LABEL: Record<AuditAction, string> = {
  'account.created': 'Account created',
  'account.role-changed': 'Role changed',
  'account.suspended': 'Account suspended',
  'account.reactivated': 'Account reactivated',
  'facility.created': 'Facility added',
  'facility.updated': 'Facility updated',
  'facility.published': 'Facility published',
  'facility.unpublished': 'Facility unpublished',
  'onboarding.completed': 'Onboarding completed',
};
