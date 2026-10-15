/**
 * Single source of truth for human-readable enum labels.
 *
 * Wording matters in this product: nothing here may read as a diagnosis.
 * Screening outcomes describe what the *model flagged*, and workflow statuses
 * describe where the *record* is, never the patient's disease state.
 */

import type {
  ContactChannel,
  FacilityService,
  FacilityType,
  FollowUpReason,
  FollowUpStatus,
  ImageQuality,
  ReferralPriority,
  ReferralStatus,
  RiskFactor,
  ScreeningOutcome,
  ScreeningStatus,
  Sex,
  SyncState,
  UserRole,
} from '@/types/domain';

export const screeningStatusLabel: Record<ScreeningStatus, string> = {
  draft: 'Draft',
  queued: 'Queued for analysis',
  'awaiting-review': 'Awaiting review',
  reviewed: 'Reviewed',
  referred: 'Referred',
  closed: 'Closed',
};

export const screeningOutcomeLabel: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Flagged for clinical review',
  'no-alert': 'No screening alert',
  inconclusive: 'Inconclusive',
};

/** Short form for dense table cells. */
export const screeningOutcomeShort: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Flagged',
  'no-alert': 'No alert',
  inconclusive: 'Inconclusive',
};

/** One-line explanation of what each outcome does and does not mean. */
export const screeningOutcomeMeaning: Record<ScreeningOutcome, string> = {
  'flagged-for-review':
    'The demo model highlighted features it associates with TB in its training data. This is a prompt for a clinician to look at the image, not a diagnosis.',
  'no-alert':
    'The demo model did not raise a screening alert. This does not rule out TB; clinical judgement and symptoms still take priority.',
  inconclusive:
    'The demo model could not produce a usable result, usually because of image quality or low confidence. The radiograph should be repeated or reviewed manually.',
};

export const imageQualityLabel: Record<ImageQuality, string> = {
  adequate: 'Adequate',
  borderline: 'Borderline',
  inadequate: 'Inadequate',
};

export const referralStatusLabel: Record<ReferralStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  referred: 'Referred',
  'appointment-scheduled': 'Appointment scheduled',
  attended: 'Attended',
  'followup-required': 'Follow-up required',
  closed: 'Closed',
};

export const referralPriorityLabel: Record<ReferralPriority, string> = {
  routine: 'Routine',
  soon: 'Soon',
  urgent: 'Urgent',
};

export const followUpStatusLabel: Record<FollowUpStatus, string> = {
  scheduled: 'Scheduled',
  'in-progress': 'In progress',
  completed: 'Completed',
  unresolved: 'Unresolved',
};

export const followUpReasonLabel: Record<FollowUpReason, string> = {
  'referral-attendance': 'Referral attendance',
  'sputum-result': 'Sputum result',
  'repeat-imaging': 'Repeat imaging',
  'treatment-adherence': 'Treatment adherence',
  'contact-tracing': 'Contact tracing',
  'symptom-recheck': 'Symptom recheck',
};

export const contactChannelLabel: Record<ContactChannel, string> = {
  phone: 'Phone call',
  'home-visit': 'Home visit',
  'village-cadre': 'Village cadre',
  sms: 'SMS',
};

export const contactOutcomeLabel: Record<string, string> = {
  reached: 'Reached',
  'no-answer': 'No answer',
  'wrong-number': 'Wrong number',
  'moved-away': 'Moved away',
  rescheduled: 'Rescheduled',
};

export const facilityTypeLabel: Record<FacilityType, string> = {
  posyandu: 'Posyandu',
  puskesmas: 'Puskesmas',
  clinic: 'Clinic',
  'district-hospital': 'District hospital',
  'referral-hospital': 'Referral hospital',
  lab: 'Laboratory',
};

export const facilityServiceLabel: Record<FacilityService, string> = {
  cxr: 'Chest X-ray',
  'sputum-microscopy': 'Sputum microscopy',
  'tcm-genexpert': 'Molecular test (GeneXpert)',
  'tb-treatment': 'TB treatment',
  'mdr-tb-treatment': 'MDR-TB treatment',
  'pediatric-tb': 'Paediatric TB',
  'general-outpatient': 'General outpatient',
  inpatient: 'Inpatient care',
};

export const facilityInfoStatusLabel: Record<string, string> = {
  'verified-sample': 'Sample verified',
  'needs-review': 'Needs review',
  unconfirmed: 'Unconfirmed',
};

export const riskFactorLabel: Record<RiskFactor, string> = {
  'household-tb-contact': 'Household TB contact',
  diabetes: 'Diabetes',
  hiv: 'HIV',
  smoker: 'Smoker',
  malnutrition: 'Malnutrition',
  'prior-tb-treatment': 'Prior TB treatment',
  'crowded-housing': 'Crowded housing',
  elderly: 'Elderly',
  pregnant: 'Pregnant',
};

export const userRoleLabel: Record<UserRole, string> = {
  chw: 'Community health worker',
  nurse: 'Nurse',
  physician: 'Physician',
  coordinator: 'TB programme coordinator',
};

export const syncStateLabel: Record<SyncState, string> = {
  'local-draft': 'Local draft',
  pending: 'Pending sync',
  synced: 'Synced',
  failed: 'Failed',
  conflict: 'Conflict',
};

export const sexLabel: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
};

export const symptomLabel: Record<string, string> = {
  coughWeeks: 'Cough duration',
  hemoptysis: 'Coughing blood',
  nightSweats: 'Night sweats',
  weightLoss: 'Unexplained weight loss',
  fever: 'Fever',
  chestPain: 'Chest pain',
  fatigue: 'Fatigue',
  appetiteLoss: 'Loss of appetite',
};
