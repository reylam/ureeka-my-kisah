import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';
import {
  ACCOUNT_ROLES,
  CLINICAL_ROLES,
  CONTACT_CHANNELS,
  CONTACT_OUTCOMES,
  FACILITY_SERVICES,
  FACILITY_TYPES,
  FOLLOW_UP_REASONS,
  FOLLOW_UP_STATUSES,
  REFERRAL_PRIORITIES,
  REFERRAL_STATUSES,
  RISK_FACTORS,
  SCREENING_STATUSES,
  SEX,
  idParam,
  isoDate,
  isoDateTime,
  optionalText,
  queryBool,
  searchText,
  shortText,
  strict,
  uuid,
} from './common.js';

/* ── Registration ───────────────────────────────────────────────────────── */

// Same rules the sign-up form shows (frontend/src/lib/passwordRules.ts). There
// is no role field and `strict` rejects one: every self-registered account is a
// patient, assigned by the database trigger.
export const registerBody = strict({
  name: shortText(200).min(2),
  email: z.email().max(254),
  password: z
    .string()
    .min(8, 'Password needs at least 8 characters.')
    .max(72, 'Password is too long.')
    .refine((value) => /[a-z]/.test(value), 'Password needs a lower-case letter.')
    .refine((value) => /[A-Z]/.test(value), 'Password needs an upper-case letter.')
    .refine((value) => /\d/.test(value), 'Password needs a number.'),
});

/* ── Accounts ───────────────────────────────────────────────────────────── */

export const accountListQuery = paginationSchema.extend({
  role: z.enum(ACCOUNT_ROLES).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  q: searchText.optional(),
});

// `role` is the only thing this body may carry; everything else is rejected.
export const setRoleBody = strict({ role: z.enum(ACCOUNT_ROLES) });
export const setStatusBody = strict({ status: z.enum(['active', 'suspended']) });
export const staffProfileBody = strict({
  clinicalRole: z.enum(CLINICAL_ROLES),
  facilityId: uuid,
  canReview: z.boolean(),
  phone: z.string().trim().max(40).nullable().optional(),
});

/* ── Onboarding ─────────────────────────────────────────────────────────── */

export const onboardingPersonalBody = strict({
  fullName: shortText(200).min(2),
  birthDate: isoDate.refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: 'Birth date cannot be in the future.',
  }),
  phone: z.string().trim().max(40),
  sex: z.enum(SEX).nullable(),
});

export const onboardingAddressBody = strict({
  province: shortText(120),
  district: shortText(120),
  village: shortText(120),
  addressLine: z.string().trim().max(300),
});

export const onboardingHealthBody = strict({
  symptoms: z.array(shortText(60)).max(20),
  symptomWeeks: z.number().int().min(0).max(520).nullable(),
  priorTb: z.enum(['never', 'treated', 'ongoing', 'prefer-not-to-say']),
  householdContact: z.boolean().nullable(),
  notes: z.string().trim().max(1000),
  shared: z.boolean(),
});

export const onboardingCompleteBody = strict({
  dataUse: z.boolean(),
  healthInfo: z.boolean(),
});

export const onboardingReopenBody = strict({ step: z.number().int().min(0).max(2) });
export const healthConsentBody = strict({ healthInfo: z.boolean() });

export const articleParam = z.object({ articleId: z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]*$/) });

/* ── Patients ───────────────────────────────────────────────────────────── */

export const patientListQuery = paginationSchema.extend({ q: searchText.optional() });

export const patientCreateBody = strict({
  name: shortText(200).min(2),
  sex: z.enum(SEX),
  birthDate: isoDate,
  phone: z.string().trim().max(40).nullable().optional(),
  village: z.string().trim().max(120).default(''),
  district: z.string().trim().max(120).default(''),
  province: z.string().trim().max(120).default(''),
  riskFactors: z.array(z.enum(RISK_FACTORS)).max(RISK_FACTORS.length).default([]),
  householdContacts: z.number().int().min(0).max(50).default(0),
});

export const patientUpdateBody = strict({
  name: shortText(200).min(2).optional(),
  sex: z.enum(SEX).optional(),
  birthDate: isoDate.optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  village: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  riskFactors: z.array(z.enum(RISK_FACTORS)).max(RISK_FACTORS.length).optional(),
  householdContacts: z.number().int().min(0).max(50).optional(),
});

export const patientFacilityBody = strict({ homeFacilityId: uuid.nullable() });

export const noteBody = strict({
  body: shortText(4000),
  context: z.enum(['general', 'screening', 'referral', 'followup']).default('general'),
  contextId: uuid.optional(),
});

/* ── Screenings ─────────────────────────────────────────────────────────── */

const weeks = z.number().int().min(0).max(520);
export const symptomsSchema = strict({
  coughWeeks: weeks,
  hemoptysis: z.boolean(),
  nightSweats: z.boolean(),
  weightLoss: z.boolean(),
  fever: z.boolean(),
  chestPain: z.boolean(),
  fatigue: z.boolean(),
  appetiteLoss: z.boolean(),
});

const nullableNumber = (min, max) => z.number().min(min).max(max).nullable();
export const vitalsSchema = strict({
  weightKg: nullableNumber(1, 500),
  heightCm: nullableNumber(20, 260),
  temperatureC: nullableNumber(30, 45),
  respiratoryRate: nullableNumber(4, 90),
});

const imageQuality = z.enum(['adequate', 'borderline', 'inadequate']);

export const screeningListQuery = paginationSchema.extend({
  status: z.enum(SCREENING_STATUSES).optional(),
  patientId: uuid.optional(),
});

export const screeningCreateBody = strict({
  patientId: uuid,
  symptoms: symptomsSchema,
  vitals: vitalsSchema,
  imageQuality,
  asDraft: z.boolean().default(false),
  createdOffline: z.boolean().default(false),
  performedAt: isoDateTime.optional(),
});

// Class scores computed by the model running in the clinician's browser. Only
// the scores and the model's name are accepted; the label, outcome and risk
// point are derived on the server.
const classScore = z.number().min(0).max(1);
export const browserAnalysisBody = strict({
  probabilities: strict({
    Healthy: classScore,
    'Sick-non-TB': classScore,
    TB: classScore,
  }).refine(
    (value) => Math.abs(value.Healthy + value['Sick-non-TB'] + value.TB - 1) <= 0.02,
    'Class scores must add up to 1.',
  ),
  model: strict({
    name: shortText(80),
    version: shortText(80),
    backbone: shortText(80),
  }),
});

export const screeningFinalizeBody = strict({
  symptoms: symptomsSchema,
  vitals: vitalsSchema,
  imageQuality,
  // A draft stays a draft until it is explicitly submitted.
  submit: z.boolean().default(false),
});

export const imageMetaFields = z.object({
  width: z.coerce.number().int().min(1).max(20000).optional(),
  height: z.coerce.number().int().min(1).max(20000).optional(),
  fileName: z.string().trim().max(200).optional(),
});

export const reviewBody = strict({
  agreement: z.enum(['agrees', 'disagrees', 'needs-more-data']),
  decision: z.enum(['refer', 'repeat-image', 'observe', 'no-action']),
  notes: z.string().trim().max(4000),
});

/* ── Referrals ──────────────────────────────────────────────────────────── */

export const referralListQuery = paginationSchema.extend({
  status: z.enum(REFERRAL_STATUSES).optional(),
  patientId: uuid.optional(),
});

export const referralCreateBody = strict({
  patientId: uuid,
  screeningId: uuid.nullable().default(null),
  toFacilityId: uuid,
  reason: optionalText(2000),
  requestedService: z.enum(FACILITY_SERVICES),
  priority: z.enum(REFERRAL_PRIORITIES),
  appointmentDate: isoDate.nullable().default(null),
  assignedWorkerId: uuid,
  status: z.enum(['draft', 'pending']).default('pending'),
});

export const referralUpdateBody = strict({
  toFacilityId: uuid.optional(),
  reason: optionalText(2000).optional(),
  requestedService: z.enum(FACILITY_SERVICES).optional(),
  priority: z.enum(REFERRAL_PRIORITIES).optional(),
  appointmentDate: isoDate.nullable().optional(),
  assignedWorkerId: uuid.optional(),
});

export const referralStatusBody = strict({
  status: z.enum(REFERRAL_STATUSES),
  note: optionalText(1000).optional(),
});

/* ── Follow-ups ─────────────────────────────────────────────────────────── */

export const followUpListQuery = paginationSchema.extend({
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
  patientId: uuid.optional(),
});

export const followUpCreateBody = strict({
  patientId: uuid,
  referralId: uuid.nullable().default(null),
  screeningId: uuid.nullable().default(null),
  reason: z.enum(FOLLOW_UP_REASONS),
  dueDate: isoDate,
  assignedWorkerId: uuid,
});

export const followUpRescheduleBody = strict({ dueDate: isoDate, note: optionalText(1000).optional() });
export const followUpAttemptBody = strict({
  channel: z.enum(CONTACT_CHANNELS),
  outcome: z.enum(CONTACT_OUTCOMES),
  note: optionalText(2000).nullable().optional(),
});
export const followUpCompleteBody = strict({ note: optionalText(2000).optional() });
export const followUpUnresolvedBody = strict({ reason: shortText(1000) });
export const followUpAssigneeBody = strict({ workerId: uuid });

/* ── Facilities ─────────────────────────────────────────────────────────── */

export const facilityListQuery = z.object({
  published: queryBool.optional(),
  q: searchText.optional(),
  type: z.enum(FACILITY_TYPES).optional(),
  service: z.enum(FACILITY_SERVICES).optional(),
});

// `published` is not part of the draft: it is changed only by the dedicated
// endpoint, and `strict` rejects it here.
export const facilityDraftBody = strict({
  name: shortText(200).min(2),
  type: z.enum(FACILITY_TYPES),
  province: z.string().trim().max(120).default(''),
  region: z.string().trim().max(120).default(''),
  address: z.string().trim().max(300).default(''),
  phone: z.string().trim().max(60).default(''),
  operatingHours: z.string().trim().max(200).default(''),
  services: z.array(z.enum(FACILITY_SERVICES)).max(FACILITY_SERVICES.length).default([]),
  tbProgrammeContact: z.string().trim().max(200).nullable().default(null),
});

export const facilityPublishBody = strict({ published: z.boolean() });

/* ── Dashboard ───────────────────────────────────────────────────────────── */

export const dashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(21),
  // IANA zone name from the browser (e.g. Asia/Makassar). Unknown names are
  // rejected by the database.
  tz: z
    .string()
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/, 'Use an IANA time zone name.')
    .default('UTC'),
});

/* ── Audit ──────────────────────────────────────────────────────────────── */

export const auditListQuery = paginationSchema.extend({
  action: z.string().trim().max(80).optional(),
  q: searchText.optional(),
});

export { idParam };
