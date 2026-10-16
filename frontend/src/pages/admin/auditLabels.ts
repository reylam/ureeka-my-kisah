import type { AuditAction } from '@/types/account';

/** Human wording for audit entries, kept out of the pages that render them. */
export const AUDIT_LABEL: Record<AuditAction, string> = {
  'account.created': 'Account created',
  'account.role-changed': 'Role changed',
  'account.suspended': 'Account suspended',
  'account.reactivated': 'Account reactivated',
  'onboarding.completed': 'Onboarding completed',
  'consent.health-info-changed': 'Health consent changed',
  'facility.created': 'Facility added',
  'facility.updated': 'Facility updated',
  'facility.published': 'Facility published',
  'facility.unpublished': 'Facility unpublished',
  'facility.deleted': 'Facility deleted',
  'patient.viewed': 'Patient record opened',
  'patient.created': 'Patient registered',
  'patient.updated': 'Patient record edited',
  'patient.facility-changed': 'Patient facility changed',
  'screening.created': 'Screening recorded',
  'screening.deleted': 'Draft screening deleted',
  'screening.image-attached': 'X-ray attached',
  'screening.image-viewed': 'X-ray viewed',
  'screening.analysed': 'Model analysis run',
  'screening.reviewed': 'Screening reviewed',
  'referral.created': 'Referral created',
  'referral.status-changed': 'Referral status changed',
  'followup.created': 'Follow-up created',
};
