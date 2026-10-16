import type { ISODate, ISODateTime, Sex } from './domain';

/**
 * Accounts and roles.
 *
 * Four roles are described in the product, but only three are stored. A
 * visitor is the *absence* of an account, not a row with `role: 'visitor'`:
 * modelling it as a stored role invites code that signs someone in as a
 * visitor, and then every guard has to special-case it.
 *
 * `AccountRole` is the coarse access tier. The existing clinical `UserRole`
 * (chw / nurse / physician / coordinator) still exists underneath for
 * professional accounts, because that is what decides who may sign off a
 * review, and throwing it away would break the review workflow.
 */
export type AccountRole = 'patient' | 'professional' | 'admin';

export type AccountStatus = 'active' | 'suspended';

/** The staff record behind a professional or administrator account. */
export interface StaffProfile {
  clinicalRole: 'chw' | 'nurse' | 'physician' | 'coordinator';
  /** Never true in effect for an administrator: administrative access is not clinical. */
  canReview: boolean;
  facilityId: string;
  phone: string | null;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  /** Credentials live in Supabase Auth; the app never sees a password hash. */
  role: AccountRole;
  status: AccountStatus;
  createdAt: ISODateTime;
  lastSignInAt: ISODateTime | null;
  /** Set when the account has a staff record; it is the same id as the account. */
  staffUserId: string | null;
  /** Patient accounts point at their clinical record once one exists. */
  patientId: string | null;
  onboarding: OnboardingState;
  /** Sent to administrators when listing accounts; absent elsewhere. */
  staff?: StaffProfile | null;
}

/* ── Patient onboarding ───────────────────────────────────────────────────── */

export interface OnboardingPersonal {
  fullName: string;
  birthDate: ISODate;
  phone: string;
  sex: Sex | null;
}

export interface OnboardingAddress {
  province: string;
  district: string;
  village: string;
  addressLine: string;
}

export interface OnboardingHealth {
  /** Symptoms the patient chose to report. All optional by design. */
  symptoms: string[];
  symptomWeeks: number | null;
  priorTb: 'never' | 'treated' | 'ongoing' | 'prefer-not-to-say';
  householdContact: boolean | null;
  notes: string;
  /** False when the patient declined to share health information. */
  shared: boolean;
}

export interface OnboardingConsent {
  acceptedAt: ISODateTime;
  /** Required: basic account and contact data. */
  dataUse: boolean;
  /** Separate and optional: the health answers in step 3. */
  healthInfo: boolean;
}

/**
 * Progress is stored per step rather than as one blob, so leaving halfway
 * through keeps what was already answered and the wizard can resume.
 */
export interface OnboardingState {
  completedAt: ISODateTime | null;
  /** Furthest step the patient has reached, 0-based. */
  step: number;
  personal: OnboardingPersonal | null;
  address: OnboardingAddress | null;
  health: OnboardingHealth | null;
  consent: OnboardingConsent | null;
}

export const EMPTY_ONBOARDING: OnboardingState = {
  completedAt: null,
  step: 0,
  personal: null,
  address: null,
  health: null,
  consent: null,
};

/* ── Audit ────────────────────────────────────────────────────────────────── */

export type AuditAction =
  | 'account.created'
  | 'account.role-changed'
  | 'account.suspended'
  | 'account.reactivated'
  | 'onboarding.completed'
  | 'consent.health-info-changed'
  | 'facility.created'
  | 'facility.updated'
  | 'facility.published'
  | 'facility.unpublished'
  | 'facility.deleted'
  | 'patient.viewed'
  | 'patient.created'
  | 'patient.updated'
  | 'patient.facility-changed'
  | 'screening.created'
  | 'screening.deleted'
  | 'screening.image-attached'
  | 'screening.image-viewed'
  | 'screening.analysed'
  | 'screening.reviewed'
  | 'referral.created'
  | 'referral.status-changed'
  | 'followup.created';

export interface AuditEntry {
  id: string;
  at: ISODateTime;
  /** Account that performed the action. */
  actorId: string;
  actorName: string;
  action: AuditAction;
  /** What was acted on, for display. */
  subject: string;
  detail: string | null;
}
