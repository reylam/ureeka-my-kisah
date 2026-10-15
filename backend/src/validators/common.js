import { z } from 'zod';

/** Reject unknown keys loudly where it matters (e.g. a `role` on a payload). */
export const strict = (shape) => z.strictObject(shape);

export const uuid = z.uuid();
export const idParam = z.object({ id: uuid });

export const isoDate = z.iso.date();
export const isoDateTime = z.iso.datetime({ offset: true });

const trimmed = (min, max) => z.string().trim().min(min).max(max);
export const shortText = (max = 200) => trimmed(1, max);
export const optionalText = (max = 2000) => z.string().trim().max(max);

export const SEX = ['male', 'female'];
export const FACILITY_TYPES = ['posyandu', 'puskesmas', 'clinic', 'district-hospital', 'referral-hospital', 'lab'];
export const FACILITY_SERVICES = [
  'cxr',
  'sputum-microscopy',
  'tcm-genexpert',
  'tb-treatment',
  'mdr-tb-treatment',
  'pediatric-tb',
  'general-outpatient',
  'inpatient',
];
export const RISK_FACTORS = [
  'household-tb-contact',
  'diabetes',
  'hiv',
  'smoker',
  'malnutrition',
  'prior-tb-treatment',
  'crowded-housing',
  'elderly',
  'pregnant',
];
export const SCREENING_STATUSES = ['draft', 'queued', 'awaiting-review', 'reviewed', 'referred', 'closed'];
export const REFERRAL_STATUSES = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'attended',
  'followup-required',
  'closed',
];
export const REFERRAL_PRIORITIES = ['routine', 'soon', 'urgent'];
export const FOLLOW_UP_STATUSES = ['scheduled', 'in-progress', 'completed', 'unresolved'];
export const FOLLOW_UP_REASONS = [
  'referral-attendance',
  'sputum-result',
  'repeat-imaging',
  'treatment-adherence',
  'contact-tracing',
  'symptom-recheck',
];
export const CONTACT_CHANNELS = ['phone', 'home-visit', 'village-cadre', 'sms'];
export const CONTACT_OUTCOMES = ['reached', 'no-answer', 'wrong-number', 'moved-away', 'rescheduled'];
export const CLINICAL_ROLES = ['chw', 'nurse', 'physician', 'coordinator'];
export const ACCOUNT_ROLES = ['patient', 'professional', 'admin'];

/** `?flag=true` style booleans. */
export const queryBool = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const searchText = z.string().trim().max(80);
