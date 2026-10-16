/**
 * Domain types: one clinic, its patients, and their visits.
 *
 * These are exactly the shapes the API sends (backend/src/services/
 * serializers.js). The end-to-end test checks the field lists against them.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO-8601 timestamp

export type Sex = 'male' | 'female';

/* ── Patients ───────────────────────────────────────────────────────────── */

export interface Patient {
  id: string;
  /** Medical record number, e.g. "RM-2601-0004". */
  mrn: string;
  name: string;
  sex: Sex;
  birthDate: ISODate;
  phone: string | null;
  address: string;
  createdAt: ISODateTime;
}

/** What a patient typed into the public request form, before staff saved them. */
export interface Applicant {
  name: string;
  sex: Sex | null;
  birthDate: ISODate | null;
  phone: string | null;
  address: string;
}

/* ── Visits ─────────────────────────────────────────────────────────────── */

/**
 * Where a visit is:
 *   waiting    the request is in and has its access code; no one has started
 *   examining  a radiologist has taken it
 *   queued     submitted with a priority and a queue number; the result is out
 *   served     the patient has been called from the queue
 */
export type ScreeningStatus = 'waiting' | 'examining' | 'queued' | 'served';

export type QueuePriority = 'high' | 'medium' | 'low';

export type ImageQuality = 'adequate' | 'borderline' | 'inadequate';

export type ModelStatus = 'not-run' | 'pending' | 'completed' | 'failed' | 'unavailable';

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

export interface ImageMeta {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface Screening {
  id: string;
  /** Null while a request from the public form has not been saved as a patient. */
  patientId: string | null;
  patient: Patient | null;
  applicant: Applicant | null;
  complaint: string;
  /** The patient's voucher. Eight characters, shown grouped as XXXX-XXXX. */
  accessCode: string;
  requestDate: ISODate;
  requestedAt: ISODateTime;
  /** Null when the patient sent the request themselves. */
  createdBy: string | null;

  status: ScreeningStatus;
  operatorId: string | null;
  startedAt: ISODateTime | null;
  symptoms: SymptomSet | null;
  vitals: ScreeningVitals | null;
  imageQuality: ImageQuality;
  hasImage: boolean;
  imageMeta: ImageMeta | null;
  modelStatus: ModelStatus;
  analysis: ScreeningAnalysis | null;

  queuePriority: QueuePriority | null;
  queueNumber: string | null;
  queueDate: ISODate | null;
  submittedAt: ISODateTime | null;
  servedAt: ISODateTime | null;
}

/** GET /queue: still to be called (most urgent first), and already called. */
export interface QueueDay {
  date: ISODate;
  items: Screening[];
  served: Screening[];
}

/** What the access code opens. Deliberately small. */
export interface PublicStatus {
  status: ScreeningStatus;
  /** "Fransiskus J." */
  name: string;
  requestDate: ISODate;
  requestedAt: ISODateTime;
  /** People ahead: in the line for the X-ray, or in the queue after it. Null once served. */
  ahead: number | null;
  queueNumber: string | null;
  priority: QueuePriority | null;
  outcome: ScreeningOutcome | null;
  submittedAt: ISODateTime | null;
  servedAt: ISODateTime | null;
}

export interface RequestReceipt {
  code: string;
  requestDate: ISODate;
  requestedAt: ISODateTime;
}

export interface StaffMember {
  id: string;
  name: string;
  role: 'admin' | 'radiologist';
}

/* ── The model ──────────────────────────────────────────────────────────── */

/** Outcome category of the model's reading. Deliberately non-diagnostic wording. */
export type ScreeningOutcome = 'flagged-for-review' | 'no-alert' | 'inconclusive';

export type ClassLabel = 'Healthy' | 'Sick-non-TB' | 'TB';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface ScreeningAnalysis {
  outcome: ScreeningOutcome;
  predictedLabel: ClassLabel;
  probabilities: Record<ClassLabel, number>;
  /**
   * Risk point, 0 to 100: the model's TB probability restated on a round scale.
   * Not the chance that a person has TB.
   */
  riskPoint?: number;
  /** Presentation band for `riskPoint`, not a clinical threshold. */
  riskLevel?: RiskLevel;
  /** Areas the model leaned on, each grounded to a class. */
  regions: LesionRegion[];
  model: ModelDescriptor;
  analysedAt: ISODateTime;
  /** True only for output from the demo's stand-in. A real model run is false. */
  simulated: boolean;
  /** Why no areas were marked, when none were. */
  detectionNote: string | null;
}

export interface LesionRegion {
  id: string;
  /** Normalised 0..1 box so it scales with any rendered image size. */
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** Plain-language position, e.g. "zona kanan atas". */
  zone: string;
  /** The class this box grounds: the score that fell when the area was covered. */
  label?: ClassLabel;
}

export interface ModelDescriptor {
  name: string;
  version: string;
  backbone: string;
  labels: ClassLabel[];
  /** Null: no performance figure is claimed. */
  validation: null | { dataset: string; note: string };
}

/** One of the procedurally drawn illustrations used on the public site. */
export type SampleRadiograph = 'sample-a' | 'sample-b' | 'sample-c';
