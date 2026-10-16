/**
 * Core domain entities for the TB screening prototype.
 *
 * All records in this application are synthetic. The shapes here intentionally
 * mirror the response contract of the sibling Python screening service
 * (`tb-train/tb_ai/infer.py`) so a real model can be connected later without
 * reshaping the frontend. See `types/inference.ts`.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO-8601 timestamp

/* ── People ─────────────────────────────────────────────────────────────── */

export type Sex = 'male' | 'female';

export interface Patient {
  id: string; // internal id, e.g. "pat_014"
  /** Human-facing medical record number shown in tables and reports. */
  mrn: string; // e.g. "TB-2411-0142"
  name: string;
  sex: Sex;
  birthDate: ISODate;
  phone: string | null;
  village: string;
  district: string;
  province: string;
  /** Facility that owns this patient record. */
  homeFacilityId: string;
  /** Epidemiological context a screener would actually record. */
  riskFactors: RiskFactor[];
  householdContacts: number;
  registeredAt: ISODateTime;
  notes: PatientNote[];
}

export type RiskFactor =
  | 'household-tb-contact'
  | 'diabetes'
  | 'hiv'
  | 'smoker'
  | 'malnutrition'
  | 'prior-tb-treatment'
  | 'crowded-housing'
  | 'elderly'
  | 'pregnant';

export interface PatientNote {
  id: string;
  patientId: string;
  authorId: string;
  createdAt: ISODateTime;
  body: string;
  /** Where the note came from, so the timeline can group sensibly. */
  context: 'general' | 'screening' | 'referral' | 'followup';
  contextId?: string;
}

/* ── Users ──────────────────────────────────────────────────────────────── */

export type UserRole = 'chw' | 'nurse' | 'physician' | 'coordinator';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  /** Only physicians/nurses can sign off a clinical review in this prototype. */
  canReview: boolean;
  facilityId: string;
  email: string;
  phone: string | null;
}

/* ── Facilities ─────────────────────────────────────────────────────────── */

export type FacilityType =
  | 'posyandu'
  | 'puskesmas'
  | 'clinic'
  | 'district-hospital'
  | 'referral-hospital'
  | 'lab';

export type FacilityService =
  | 'cxr'
  | 'sputum-microscopy'
  | 'tcm-genexpert'
  | 'tb-treatment'
  | 'mdr-tb-treatment'
  | 'pediatric-tb'
  | 'general-outpatient'
  | 'inpatient';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  /** Fictional but plausible Indonesian administrative naming. */
  region: string; // district / kabupaten
  province: string;
  address: string;
  phone: string;
  /** Null until a real geocoding lookup has placed the entry. Never a guess. */
  coordinates: { lat: number; lng: number } | null;
  services: FacilityService[];
  /** Sample travel estimates from the operating facility. Not verified. */
  distanceKm: number;
  travelTimeMinutes: number;
  /** Whether the directory entry has been checked by a coordinator. */
  infoStatus: 'verified-sample' | 'needs-review' | 'unconfirmed';
  infoUpdatedAt: ISODate;
  operatingHours: string;
  /** Null when the facility does not run a TB programme. */
  tbProgrammeContact: string | null;
}

/* ── Screening ──────────────────────────────────────────────────────────── */

/**
 * Workflow status of a screening record. This describes where the *record* is
 * in the human workflow, not a clinical conclusion.
 */
export type ScreeningStatus =
  | 'draft' // started offline / incomplete
  | 'queued' // complete, waiting for the demo analysis step
  | 'awaiting-review' // analysis produced output, needs a human reviewer
  | 'reviewed' // a reviewer has signed off
  | 'referred' // escalated into a referral
  | 'closed'; // no further action needed

/** Outcome category of the demo analysis. Deliberately non-diagnostic wording. */
export type ScreeningOutcome =
  | 'flagged-for-review' // model highlighted findings a clinician should see
  | 'no-alert' // model produced no screening alert
  | 'inconclusive'; // low confidence or unusable image

export type ImageQuality = 'adequate' | 'borderline' | 'inadequate';

export interface SymptomSet {
  coughWeeks: number;
  hemoptysis: boolean;
  nightSweats: boolean;
  weightLoss: boolean;
  fever: boolean;
  chestPain: boolean;
  fatigue: boolean;
  appetiteLoss: boolean;
}

export interface ScreeningVitals {
  weightKg: number | null;
  heightCm: number | null;
  temperatureC: number | null;
  respiratoryRate: number | null;
}

export interface Screening {
  id: string;
  patientId: string;
  facilityId: string;
  /** Health worker who performed the screening. */
  operatorId: string;
  performedAt: ISODateTime;
  status: ScreeningStatus;

  symptoms: SymptomSet;
  vitals: ScreeningVitals;

  /** Key into the IndexedDB image store. Images are never put in localStorage. */
  imageKey: string | null;
  /** Bundled sample radiograph used when the record is part of the seed data. */
  sampleImage: SampleRadiograph | null;
  imageMeta: ImageMeta | null;
  imageQuality: ImageQuality;

  /**
   * What the model step did, kept apart from the record's workflow `status`
   * and from the clinician's `review`. Absent on records held only on this
   * device.
   */
  modelStatus?: ModelStatus;
  /** Null until a model has produced output for this record. */
  analysis: ScreeningAnalysis | null;
  review: ClinicalReview | null;

  referralId: string | null;
  /** Records created offline carry their sync state here. */
  sync: SyncState;
  createdOffline: boolean;
}

export type ModelStatus = 'not-run' | 'pending' | 'completed' | 'failed' | 'unavailable';

export interface ImageMeta {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
}

/** Identifier for one of the bundled, procedurally drawn sample radiographs. */
export type SampleRadiograph = 'sample-a' | 'sample-b' | 'sample-c';

export interface ScreeningAnalysis {
  outcome: ScreeningOutcome;
  /** Winning class label from the model's label set. */
  predictedLabel: ClassLabel;
  /** Full probability distribution, mirrors `probabilities` from infer.py. */
  probabilities: Record<ClassLabel, number>;
  /** Regions the demo model marked. Mirrors detection boxes from infer.py. */
  regions: LesionRegion[];
  model: ModelDescriptor;
  analysedAt: ISODateTime;
  /** True only for output from the built-in simulator. A real model run is false. */
  simulated: boolean;
  /** Why detection was skipped, when applicable. */
  detectionNote: string | null;
}

export type ClassLabel = 'Healthy' | 'Sick-non-TB' | 'TB';

export interface LesionRegion {
  id: string;
  /** Normalised 0..1 box so it scales with any rendered image size. */
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** Plain-language anatomical hint, e.g. "right upper zone". */
  zone: string;
}

export interface ModelDescriptor {
  name: string;
  version: string;
  backbone: string;
  labels: ClassLabel[];
  /** Null in demo mode, since we do not fabricate performance figures. */
  validation: null | { dataset: string; note: string };
}

export interface ClinicalReview {
  reviewerId: string;
  reviewedAt: ISODateTime;
  agreement: 'agrees' | 'disagrees' | 'needs-more-data';
  notes: string;
  /** Reviewer's operational decision after looking at the image. */
  decision: 'refer' | 'repeat-image' | 'observe' | 'no-action';
}

/* ── Referrals ──────────────────────────────────────────────────────────── */

export type ReferralStatus =
  | 'draft'
  | 'pending'
  | 'referred'
  | 'appointment-scheduled'
  | 'attended'
  | 'followup-required'
  | 'closed';

export type ReferralPriority = 'routine' | 'soon' | 'urgent';

export interface Referral {
  id: string;
  code: string; // e.g. "REF-0231"
  patientId: string;
  screeningId: string | null;
  fromFacilityId: string;
  toFacilityId: string;
  reason: string;
  /** What the destination facility is being asked to do. */
  requestedService: FacilityService;
  priority: ReferralPriority;
  status: ReferralStatus;
  createdAt: ISODateTime;
  appointmentDate: ISODate | null;
  assignedWorkerId: string;
  history: ReferralEvent[];
  sync: SyncState;
}

export interface ReferralEvent {
  id: string;
  at: ISODateTime;
  actorId: string;
  from: ReferralStatus | null;
  to: ReferralStatus;
  note: string | null;
}

/* ── Follow-ups ─────────────────────────────────────────────────────────── */

export type FollowUpStatus = 'scheduled' | 'in-progress' | 'completed' | 'unresolved';

export type FollowUpReason =
  | 'referral-attendance'
  | 'sputum-result'
  | 'repeat-imaging'
  | 'treatment-adherence'
  | 'contact-tracing'
  | 'symptom-recheck';

export type ContactChannel = 'phone' | 'home-visit' | 'village-cadre' | 'sms';

export interface FollowUp {
  id: string;
  code: string; // e.g. "FU-0117"
  patientId: string;
  referralId: string | null;
  screeningId: string | null;
  reason: FollowUpReason;
  dueDate: ISODate;
  status: FollowUpStatus;
  assignedWorkerId: string;
  createdAt: ISODateTime;
  completedAt: ISODateTime | null;
  /** Populated when status is 'unresolved': why it could not be closed. */
  unresolvedReason: string | null;
  attempts: ContactAttempt[];
  sync: SyncState;
}

export interface ContactAttempt {
  id: string;
  at: ISODateTime;
  actorId: string;
  channel: ContactChannel;
  outcome: 'reached' | 'no-answer' | 'wrong-number' | 'moved-away' | 'rescheduled';
  note: string | null;
}

/** Derived bucket, computed against today's date rather than stored. */
export type FollowUpBucket = 'overdue' | 'due-today' | 'upcoming' | 'completed' | 'unresolved';

/* ── Offline sync ───────────────────────────────────────────────────────── */

export type SyncState = 'local-draft' | 'pending' | 'synced' | 'failed' | 'conflict';

export type SyncEntityKind = 'screening' | 'referral' | 'followup' | 'patient';

export interface SyncQueueItem {
  id: string;
  kind: SyncEntityKind;
  entityId: string;
  /** Short human-readable description, e.g. "Screening · TB-2411-0142". */
  label: string;
  state: SyncState;
  queuedAt: ISODateTime;
  lastAttemptAt: ISODateTime | null;
  attempts: number;
  sizeBytes: number;
  /** Set when state is 'failed'. */
  error: string | null;
  /** Set when state is 'conflict': describes the competing change. */
  conflict: SyncConflict | null;
  /**
   * What will be sent to the server when this item syncs. Only screenings
   * captured without a connection are queued; everything else is written to
   * the API immediately.
   */
  payload?: QueuedScreening;
}

export interface QueuedScreening {
  patientId: string;
  symptoms: SymptomSet;
  vitals: ScreeningVitals;
  imageQuality: ImageQuality;
  /** Key of the radiograph held in IndexedDB until the upload succeeds. */
  imageKey: string | null;
  asDraft: boolean;
  capturedAt: ISODateTime;
}

export interface SyncConflict {
  field: string;
  localValue: string;
  remoteValue: string;
  remoteUpdatedAt: ISODateTime;
  remoteActor: string;
}
