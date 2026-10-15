/**
 * Builds the single, coherent demo dataset used by the whole application.
 *
 * Design notes
 * ------------
 * - One dataset, built once, with real referential integrity: every screening
 *   points at a patient that exists, every referral at a real screening and
 *   facility, every follow-up at a real referral.
 * - A fixed PRNG seed makes the dataset identical on every load, so bug reports
 *   and screenshots are reproducible.
 * - All dates are generated *relative to today*, so "overdue" and "upcoming"
 *   follow-ups are always genuinely overdue and upcoming rather than frozen in
 *   the past.
 * - Every record is synthetic. The screening analyses are produced by the demo
 *   simulator and are flagged `simulated: true`. They are not real inference
 *   results and carry no clinical meaning.
 */

import type {
  ClassLabel,
  ContactAttempt,
  FollowUp,
  FollowUpReason,
  FollowUpStatus,
  ImageQuality,
  LesionRegion,
  Patient,
  PatientNote,
  Referral,
  ReferralEvent,
  ReferralStatus,
  RiskFactor,
  SampleRadiograph,
  Screening,
  ScreeningAnalysis,
  ScreeningOutcome,
  ScreeningStatus,
  SymptomSet,
  SyncQueueItem,
  SyncState,
} from '@/types/domain';
import { GIVEN_NAMES_FEMALE, GIVEN_NAMES_MALE, SURNAMES } from './names';
import { PROVINCE, VILLAGE_INDEX } from './geography';
import { OPERATING_FACILITY_ID, facilities, referralTargetIds } from './facilities';
import { assignableWorkerIds, users } from './users';
import { DEMO_MODEL } from './model';
import { dateOffset, dateTimeOffset, toISODate, addDays, startOfToday } from '@/utils/date';

/* ── Deterministic PRNG (mulberry32) ───────────────────────────────────────
   A tiny, well-known 32-bit generator. Deterministic output keeps the demo
   dataset stable across reloads and machines. */

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260415;

interface Rng {
  (): number;
}

const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const chance = (rng: Rng, probability: number) => rng() < probability;

function pickMany<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return out;
}

/* ── Dataset shape ─────────────────────────────────────────────────────────── */

export interface SeedDataset {
  patients: Patient[];
  screenings: Screening[];
  referrals: Referral[];
  followUps: FollowUp[];
  syncQueue: SyncQueueItem[];
  lastSyncAt: string | null;
}

const RISK_FACTORS: RiskFactor[] = [
  'household-tb-contact',
  'diabetes',
  'hiv',
  'smoker',
  'malnutrition',
  'prior-tb-treatment',
  'crowded-housing',
  'elderly',
];

/* ── Patients ──────────────────────────────────────────────────────────────── */

const PATIENT_COUNT = 46;

function buildPatients(rng: Rng): Patient[] {
  const used = new Set<string>();
  const patients: Patient[] = [];

  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    const sex = chance(rng, 0.52) ? 'male' : 'female';
    let name = '';
    // Retry until the random combination is unique, so the directory has no
    // duplicate-looking rows.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const given = pick(rng, sex === 'male' ? GIVEN_NAMES_MALE : GIVEN_NAMES_FEMALE);
      const candidate = `${given} ${pick(rng, SURNAMES)}`;
      if (!used.has(candidate)) {
        name = candidate;
        used.add(candidate);
        break;
      }
    }

    const { village, district } = pick(rng, VILLAGE_INDEX);

    // Age skewed towards adults, with a minority of children and elderly,
    // roughly matching who turns up at a community TB screening session.
    const roll = rng();
    const age = roll < 0.12 ? int(rng, 3, 16) : roll < 0.82 ? int(rng, 17, 59) : int(rng, 60, 84);
    const birth = addDays(startOfToday(), -(age * 365 + int(rng, 0, 364)));

    const riskCount = rng() < 0.3 ? 0 : rng() < 0.7 ? 1 : int(rng, 2, 3);
    const riskFactors = pickMany(rng, RISK_FACTORS, riskCount);
    if (age >= 65 && !riskFactors.includes('elderly')) riskFactors.push('elderly');

    patients.push({
      id: `pat_${String(i + 1).padStart(3, '0')}`,
      mrn: `TB-2605-${String(1001 + i * 7 + int(rng, 0, 5)).padStart(4, '0')}`,
      name,
      sex,
      birthDate: toISODate(birth),
      phone: chance(rng, 0.82) ? `08${int(rng, 10, 99)}-5550-${int(rng, 1000, 9999)}` : null,
      village,
      district,
      province: PROVINCE,
      homeFacilityId:
        chance(rng, 0.62) ? OPERATING_FACILITY_ID : pick(rng, facilities).id,
      riskFactors,
      householdContacts: int(rng, 0, 7),
      registeredAt: dateTimeOffset(-int(rng, 10, 260), int(rng, 8, 13), int(rng, 0, 59)),
      notes: [],
    });
  }

  return patients;
}

/* ── Screening analysis (demo simulator output) ───────────────────────────── */

const LUNG_ZONES = [
  { zone: 'right upper zone', x: 0.2, y: 0.2 },
  { zone: 'right mid zone', x: 0.22, y: 0.42 },
  { zone: 'left upper zone', x: 0.58, y: 0.19 },
  { zone: 'left mid zone', x: 0.6, y: 0.44 },
  { zone: 'right apex', x: 0.26, y: 0.12 },
  { zone: 'left apex', x: 0.56, y: 0.11 },
];

function buildRegions(rng: Rng, count: number): LesionRegion[] {
  return pickMany(rng, LUNG_ZONES, count).map((spot, index) => {
    const size = 0.07 + rng() * 0.09;
    return {
      id: `rg_${index + 1}`,
      box: {
        x: Number((spot.x + (rng() - 0.5) * 0.05).toFixed(4)),
        y: Number((spot.y + (rng() - 0.5) * 0.05).toFixed(4)),
        width: Number(size.toFixed(4)),
        height: Number((size * (0.8 + rng() * 0.5)).toFixed(4)),
      },
      score: Number((0.52 + rng() * 0.42).toFixed(4)),
      zone: spot.zone,
    };
  });
}

/** Normalise three raw weights into a probability distribution. */
function distribution(healthy: number, sick: number, tb: number): Record<ClassLabel, number> {
  const total = healthy + sick + tb;
  return {
    Healthy: Number((healthy / total).toFixed(4)),
    'Sick-non-TB': Number((sick / total).toFixed(4)),
    TB: Number((tb / total).toFixed(4)),
  };
}

function buildAnalysis(
  rng: Rng,
  outcome: ScreeningOutcome,
  analysedAt: string,
): ScreeningAnalysis {
  if (outcome === 'flagged-for-review') {
    const probabilities = distribution(rng() * 0.12, 0.05 + rng() * 0.2, 0.62 + rng() * 0.3);
    return {
      outcome,
      predictedLabel: 'TB',
      probabilities,
      regions: buildRegions(rng, int(rng, 1, 3)),
      model: DEMO_MODEL,
      analysedAt,
      simulated: true,
      detectionNote: null,
    };
  }

  if (outcome === 'no-alert') {
    const healthyDominant = chance(rng, 0.62);
    const probabilities = healthyDominant
      ? distribution(0.7 + rng() * 0.25, 0.05 + rng() * 0.18, rng() * 0.08)
      : distribution(0.1 + rng() * 0.2, 0.6 + rng() * 0.3, rng() * 0.1);
    return {
      outcome,
      predictedLabel: healthyDominant ? 'Healthy' : 'Sick-non-TB',
      probabilities,
      regions: [],
      model: DEMO_MODEL,
      analysedAt,
      simulated: true,
      // Mirrors the real service, which only runs lesion detection for TB.
      detectionNote:
        'Lesion localisation was not run because the top class was not TB. This matches the two-stage screening logic: classify first, localise only when TB is the leading class.',
    };
  }

  // Inconclusive: no class clears a usable margin.
  const probabilities = distribution(0.3 + rng() * 0.1, 0.3 + rng() * 0.1, 0.3 + rng() * 0.1);
  return {
    outcome,
    predictedLabel: (Object.entries(probabilities) as [ClassLabel, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0]![0],
    probabilities,
    regions: [],
    model: DEMO_MODEL,
    analysedAt,
    simulated: true,
    detectionNote:
      'No class reached the confidence margin required to report a screening result. Lesion localisation was not attempted.',
  };
}

/* ── Screenings ────────────────────────────────────────────────────────────── */

function buildSymptoms(rng: Rng, leaning: ScreeningOutcome): SymptomSet {
  const symptomatic = leaning === 'flagged-for-review' ? 0.62 : 0.2;
  const coughRoll = rng();
  return {
    coughWeeks:
      leaning === 'flagged-for-review'
        ? int(rng, 2, 10)
        : coughRoll < 0.45
          ? 0
          : int(rng, 1, 3),
    hemoptysis: chance(rng, symptomatic * 0.3),
    nightSweats: chance(rng, symptomatic),
    weightLoss: chance(rng, symptomatic),
    fever: chance(rng, symptomatic * 0.8),
    chestPain: chance(rng, symptomatic * 0.6),
    fatigue: chance(rng, symptomatic * 1.1),
    appetiteLoss: chance(rng, symptomatic * 0.7),
  };
}

/**
 * Workflow plan per screening. Laid out explicitly rather than randomly so the
 * dashboard shows a believable mix of work: a handful awaiting review, some
 * already referred, a few offline drafts, and a long tail of closed records.
 */
interface ScreeningPlan {
  outcome: ScreeningOutcome;
  status: ScreeningStatus;
  quality: ImageQuality;
  daysAgo: number;
  sync: SyncState;
  offline: boolean;
}

function buildScreeningPlans(rng: Rng): ScreeningPlan[] {
  const plans: ScreeningPlan[] = [];

  const add = (
    count: number,
    outcome: ScreeningOutcome,
    status: ScreeningStatus,
    quality: ImageQuality,
    minDays: number,
    maxDays: number,
    sync: SyncState = 'synced',
    offline = false,
  ) => {
    for (let i = 0; i < count; i += 1) {
      plans.push({
        outcome,
        status,
        quality,
        daysAgo: int(rng, minDays, maxDays),
        sync,
        offline,
      });
    }
  };

  // Needs attention right now.
  add(6, 'flagged-for-review', 'awaiting-review', 'adequate', 0, 5);
  add(3, 'no-alert', 'awaiting-review', 'adequate', 0, 4);
  add(2, 'inconclusive', 'awaiting-review', 'borderline', 0, 3);

  // Reviewed but not escalated.
  add(11, 'no-alert', 'reviewed', 'adequate', 2, 40);
  add(4, 'inconclusive', 'reviewed', 'borderline', 3, 35);

  // Escalated into referrals.
  add(13, 'flagged-for-review', 'referred', 'adequate', 1, 46);
  add(2, 'inconclusive', 'referred', 'inadequate', 5, 30);

  // Long tail of finished work.
  add(14, 'no-alert', 'closed', 'adequate', 8, 58);
  add(3, 'flagged-for-review', 'closed', 'adequate', 20, 58);

  // In the demo analysis queue.
  add(3, 'no-alert', 'queued', 'adequate', 0, 1, 'pending', true);

  // Offline drafts that never completed. These drive the Offline Queue page.
  add(4, 'no-alert', 'draft', 'adequate', 0, 2, 'local-draft', true);

  // A couple of records that failed to sync and one conflict.
  add(2, 'flagged-for-review', 'awaiting-review', 'adequate', 1, 4, 'failed', true);
  add(1, 'no-alert', 'reviewed', 'adequate', 6, 9, 'conflict', true);

  return plans;
}

const SAMPLE_BY_OUTCOME: Record<ScreeningOutcome, SampleRadiograph> = {
  'flagged-for-review': 'sample-a',
  'no-alert': 'sample-b',
  inconclusive: 'sample-c',
};

const REVIEW_NOTES: Record<ScreeningOutcome, string[]> = {
  'flagged-for-review': [
    'Upper-zone changes visible on my read as well. Sending for molecular testing before any treatment decision.',
    'Agree the image warrants a closer look. Symptoms fit; referring for GeneXpert and sputum collection.',
    'Findings are consistent with what the model marked. Patient counselled, referral raised the same day.',
    'I can see the opacity the model highlighted, but it could be an old scar. Requesting sputum testing to clarify.',
  ],
  'no-alert': [
    'No screening alert and no concerning symptoms on examination. Advised to return if cough persists beyond two weeks.',
    'Image looks unremarkable on my read. Closing the record; patient knows to come back if symptoms change.',
    'Agree with the absence of an alert. Cough is more consistent with a recent viral illness.',
    'No alert, but the patient has a household contact, so keeping a contact-tracing follow-up open regardless.',
  ],
  inconclusive: [
    'Image is underexposed and rotated. Not interpretable; asked the patient to return for a repeat radiograph.',
    'Cannot read this reliably. Scheduling a repeat image at the district hospital where the equipment is better.',
    'Insufficient inspiration and some motion blur. Repeat required before any conclusion.',
  ],
};

function buildScreenings(rng: Rng, patients: Patient[]): Screening[] {
  const plans = buildScreeningPlans(rng);
  // Sort newest-last so sequential ids roughly follow chronology.
  plans.sort((a, b) => b.daysAgo - a.daysAgo);

  const reviewers = users.filter((u) => u.canReview);
  const operators = users.filter((u) => u.facilityId === OPERATING_FACILITY_ID);
  const screeningsPerPatient = new Map<string, number>();

  return plans.map((plan, index) => {
    // Weight selection so some patients accumulate a screening history while
    // most have exactly one, closer to how a real register looks.
    let patient = pick(rng, patients);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const seen = screeningsPerPatient.get(patient.id) ?? 0;
      if (seen === 0 || chance(rng, 0.22)) break;
      patient = pick(rng, patients);
    }
    screeningsPerPatient.set(patient.id, (screeningsPerPatient.get(patient.id) ?? 0) + 1);

    const performedAt = dateTimeOffset(-plan.daysAgo, int(rng, 8, 13), int(rng, 0, 59));
    const hasAnalysis = plan.status !== 'draft' && plan.status !== 'queued';
    const analysedAt = dateTimeOffset(-plan.daysAgo, int(rng, 9, 14), int(rng, 0, 59));

    const needsReview = plan.status === 'awaiting-review';
    const reviewed = hasAnalysis && !needsReview;
    const reviewer = pick(rng, reviewers);

    const decision: 'refer' | 'repeat-image' | 'observe' | 'no-action' =
      plan.status === 'referred'
        ? plan.outcome === 'inconclusive'
          ? 'repeat-image'
          : 'refer'
        : plan.outcome === 'inconclusive'
          ? 'repeat-image'
          : plan.outcome === 'flagged-for-review'
            ? 'observe'
            : 'no-action';

    const heightCm = int(rng, 142, 178);

    return {
      id: `scr_${String(index + 1).padStart(3, '0')}`,
      patientId: patient.id,
      facilityId: OPERATING_FACILITY_ID,
      operatorId: pick(rng, operators).id,
      performedAt,
      status: plan.status,
      symptoms: buildSymptoms(rng, plan.outcome),
      vitals: {
        weightKg: int(rng, 38, 74),
        heightCm,
        temperatureC: Number((36.2 + rng() * 1.6).toFixed(1)),
        respiratoryRate: int(rng, 14, 26),
      },
      imageKey: null,
      sampleImage: plan.status === 'draft' ? null : SAMPLE_BY_OUTCOME[plan.outcome],
      imageMeta:
        plan.status === 'draft'
          ? null
          : {
              fileName: `cxr_${patient.mrn.toLowerCase().replace(/-/g, '_')}_${plan.daysAgo}.png`,
              sizeBytes: int(rng, 480, 2400) * 1024,
              mimeType: 'image/png',
              width: 1024,
              height: 1024,
            },
      imageQuality: plan.quality,
      analysis: hasAnalysis ? buildAnalysis(rng, plan.outcome, analysedAt) : null,
      review: reviewed
        ? {
            reviewerId: reviewer.id,
            reviewedAt: dateTimeOffset(
              -Math.max(0, plan.daysAgo - int(rng, 0, 1)),
              int(rng, 13, 16),
              int(rng, 0, 59),
            ),
            agreement:
              plan.outcome === 'inconclusive'
                ? 'needs-more-data'
                : chance(rng, 0.82)
                  ? 'agrees'
                  : 'disagrees',
            notes: pick(rng, REVIEW_NOTES[plan.outcome]),
            decision,
          }
        : null,
      referralId: null, // linked up in buildReferrals
      sync: plan.sync,
      createdOffline: plan.offline,
    } satisfies Screening;
  });
}

/* ── Referrals ─────────────────────────────────────────────────────────────── */

const REFERRAL_REASONS: Record<ScreeningOutcome, string[]> = {
  'flagged-for-review': [
    'Screening flagged for clinical review; needs molecular testing to clarify.',
    'Upper-zone findings on screening image plus cough over three weeks. Requesting sputum and GeneXpert.',
    'Screening alert with household TB contact. Escalating for diagnostic workup.',
    'Reviewer agreed with screening alert. Referred for confirmatory testing and specialist read.',
  ],
  inconclusive: [
    'Radiograph not interpretable at this facility. Requesting repeat imaging with better equipment.',
    'Image quality inadequate and symptoms persist. Referring for repeat chest X-ray.',
  ],
  'no-alert': [
    'No screening alert, but persistent symptoms warrant a specialist opinion.',
  ],
};

interface ReferralPlan {
  status: ReferralStatus;
  count: number;
}

const REFERRAL_PLANS: ReferralPlan[] = [
  { status: 'draft', count: 2 },
  { status: 'pending', count: 4 },
  { status: 'referred', count: 3 },
  { status: 'appointment-scheduled', count: 3 },
  { status: 'attended', count: 3 },
  { status: 'followup-required', count: 3 },
  { status: 'closed', count: 4 },
];

/** Ordered lifecycle used to synthesise a plausible status history. */
const REFERRAL_FLOW: ReferralStatus[] = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'attended',
  'followup-required',
  'closed',
];

function buildReferrals(rng: Rng, screenings: Screening[], patients: Patient[]): Referral[] {
  const candidates = screenings.filter(
    (s) => s.status === 'referred' || (s.status === 'closed' && s.analysis?.outcome === 'flagged-for-review'),
  );

  const statuses: ReferralStatus[] = REFERRAL_PLANS.flatMap((plan) =>
    Array.from({ length: plan.count }, () => plan.status),
  );

  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const referrals: Referral[] = [];

  statuses.forEach((status, index) => {
    const screening = candidates[index % candidates.length]!;
    const patient = patientsById.get(screening.patientId)!;
    const outcome = screening.analysis?.outcome ?? 'flagged-for-review';

    // Destination must actually be able to deliver the requested service.
    const requestedService =
      outcome === 'inconclusive'
        ? 'cxr'
        : chance(rng, 0.6)
          ? 'tcm-genexpert'
          : 'sputum-microscopy';
    const eligible = facilities.filter(
      (f) => referralTargetIds.includes(f.id) && f.services.includes(requestedService),
    );
    const destination = eligible.length > 0 ? pick(rng, eligible) : facilities[3]!;

    const daysSinceScreening = Math.max(
      0,
      Math.round((Date.now() - new Date(screening.performedAt).getTime()) / 86_400_000),
    );
    const createdDaysAgo = Math.max(0, daysSinceScreening - int(rng, 0, 1));
    const createdAt = dateTimeOffset(-createdDaysAgo, int(rng, 10, 15), int(rng, 0, 59));

    const priority =
      outcome === 'flagged-for-review'
        ? chance(rng, 0.3)
          ? 'urgent'
          : 'soon'
        : 'routine';

    const assignedWorkerId = pick(rng, assignableWorkerIds);

    // Appointments exist from 'appointment-scheduled' onwards.
    const flowIndex = REFERRAL_FLOW.indexOf(status);
    const hasAppointment = flowIndex >= REFERRAL_FLOW.indexOf('appointment-scheduled');
    const attended = flowIndex >= REFERRAL_FLOW.indexOf('attended');
    const appointmentDate = hasAppointment
      ? attended
        ? dateOffset(-int(rng, 1, Math.max(2, createdDaysAgo)))
        : dateOffset(int(rng, 1, 16))
      : null;

    // Synthesise the status trail the record must have passed through.
    const history: ReferralEvent[] = [];
    let previous: ReferralStatus | null = null;
    const trail = REFERRAL_FLOW.slice(0, flowIndex + 1);
    trail.forEach((step, stepIndex) => {
      const spread = Math.round((createdDaysAgo * stepIndex) / Math.max(1, trail.length - 1));
      history.push({
        id: `rev_${index + 1}_${stepIndex + 1}`,
        at: dateTimeOffset(-(createdDaysAgo - spread), int(rng, 9, 16), int(rng, 0, 59)),
        actorId: stepIndex === 0 ? screening.operatorId : assignedWorkerId,
        from: previous,
        to: step,
        note:
          step === 'appointment-scheduled' && appointmentDate
            ? `Appointment booked at ${destination.name}.`
            : step === 'attended'
              ? 'Patient attended; specimen collected.'
              : step === 'followup-required'
                ? 'Result pending. Follow-up opened to chase the outcome.'
                : step === 'closed'
                  ? 'Referral episode closed.'
                  : null,
      });
      previous = step;
    });

    const referral: Referral = {
      id: `ref_${String(index + 1).padStart(3, '0')}`,
      code: `REF-${String(index + 1).padStart(4, '0')}`,
      patientId: patient.id,
      screeningId: screening.id,
      fromFacilityId: OPERATING_FACILITY_ID,
      toFacilityId: destination.id,
      reason: pick(rng, REFERRAL_REASONS[outcome]),
      requestedService,
      priority,
      status,
      createdAt,
      appointmentDate,
      assignedWorkerId,
      history,
      sync: status === 'draft' ? 'local-draft' : chance(rng, 0.9) ? 'synced' : 'pending',
    };

    referrals.push(referral);
    screening.referralId = referral.id;
  });

  return referrals;
}

/* ── Follow-ups ────────────────────────────────────────────────────────────── */

const ATTEMPT_NOTES: Record<string, string[]> = {
  reached: [
    'Spoke with the patient; confirmed they will travel on the appointment date.',
    'Patient confirmed they attended and are waiting for the result.',
    'Reached the patient. Transport arranged with the village cadre.',
  ],
  'no-answer': [
    'Called twice, no answer. Will try again through the village cadre.',
    'No answer. Phone may be out of coverage in that area.',
  ],
  'wrong-number': ['Number belongs to someone else. Need to re-verify contact details.'],
  'moved-away': ['Family reports the patient has moved to another district for work.'],
  rescheduled: ['Patient asked to move the appointment because of harvest work.'],
};

const UNRESOLVED_REASONS = [
  'Patient has moved out of the district; no working contact number on file.',
  'Three contact attempts failed and the household could not be located during the home visit.',
];

interface FollowUpPlan {
  status: FollowUpStatus;
  dueOffset: number;
  reason: FollowUpReason;
}

function buildFollowUpPlans(rng: Rng): FollowUpPlan[] {
  const reasons: FollowUpReason[] = [
    'referral-attendance',
    'sputum-result',
    'repeat-imaging',
    'treatment-adherence',
    'contact-tracing',
    'symptom-recheck',
  ];
  const plans: FollowUpPlan[] = [];

  const add = (count: number, status: FollowUpStatus, minOffset: number, maxOffset: number) => {
    for (let i = 0; i < count; i += 1) {
      plans.push({ status, dueOffset: int(rng, minOffset, maxOffset), reason: pick(rng, reasons) });
    }
  };

  add(5, 'scheduled', -14, -2); // overdue
  add(2, 'in-progress', -9, -3); // overdue, already being chased
  add(3, 'scheduled', 0, 0); // due today
  add(9, 'scheduled', 1, 21); // upcoming
  add(1, 'in-progress', 2, 6);
  add(11, 'completed', -45, -3);
  add(2, 'unresolved', -38, -16);

  return plans;
}

function buildFollowUps(
  rng: Rng,
  referrals: Referral[],
  screenings: Screening[],
  patients: Patient[],
): FollowUp[] {
  const plans = buildFollowUpPlans(rng);
  // Prefer referrals that genuinely imply a follow-up, then fall back to
  // screenings so contact-tracing and recheck tasks exist too.
  const referralPool = referrals.filter((r) => r.status !== 'draft');
  const screeningPool = screenings.filter((s) => s.status !== 'draft');

  return plans.map((plan, index) => {
    const useReferral = plan.reason !== 'contact-tracing' && chance(rng, 0.72);
    const referral = useReferral ? referralPool[index % referralPool.length]! : null;
    const screening = referral
      ? (screenings.find((s) => s.id === referral.screeningId) ?? null)
      : screeningPool[(index * 3) % screeningPool.length]!;
    const patientId = referral?.patientId ?? screening?.patientId ?? patients[index]!.id;

    const dueDate = dateOffset(plan.dueOffset);
    const createdDaysAgo = Math.abs(plan.dueOffset) + int(rng, 3, 14);
    const createdAt = dateTimeOffset(-createdDaysAgo, int(rng, 9, 15), int(rng, 0, 59));

    const attemptCount =
      plan.status === 'completed'
        ? int(rng, 1, 2)
        : plan.status === 'unresolved'
          ? 3
          : plan.status === 'in-progress'
            ? int(rng, 1, 2)
            : plan.dueOffset < 0
              ? int(rng, 0, 2)
              : 0;

    const attempts: ContactAttempt[] = Array.from({ length: attemptCount }, (_, i) => {
      const outcome =
        plan.status === 'completed'
          ? i === attemptCount - 1
            ? 'reached'
            : pick(rng, ['no-answer', 'rescheduled'] as const)
          : plan.status === 'unresolved'
            ? pick(rng, ['no-answer', 'wrong-number', 'moved-away'] as const)
            : pick(rng, ['no-answer', 'reached', 'rescheduled'] as const);

      return {
        id: `att_${index + 1}_${i + 1}`,
        at: dateTimeOffset(-(createdDaysAgo - i * 2 - 1), int(rng, 9, 17), int(rng, 0, 59)),
        actorId: pick(rng, assignableWorkerIds),
        channel: pick(rng, ['phone', 'home-visit', 'village-cadre', 'sms'] as const),
        outcome,
        note: pick(rng, ATTEMPT_NOTES[outcome] ?? ['Attempt logged.']),
      };
    });

    return {
      id: `fup_${String(index + 1).padStart(3, '0')}`,
      code: `FU-${String(index + 1).padStart(4, '0')}`,
      patientId,
      referralId: referral?.id ?? null,
      screeningId: screening?.id ?? null,
      reason: plan.reason,
      dueDate,
      status: plan.status,
      assignedWorkerId: pick(rng, assignableWorkerIds),
      createdAt,
      completedAt:
        plan.status === 'completed'
          ? dateTimeOffset(plan.dueOffset + int(rng, 0, 2), int(rng, 10, 16), int(rng, 0, 59))
          : null,
      unresolvedReason: plan.status === 'unresolved' ? pick(rng, UNRESOLVED_REASONS) : null,
      attempts,
      sync: chance(rng, 0.88) ? 'synced' : 'pending',
    } satisfies FollowUp;
  });
}

/* ── Patient notes ─────────────────────────────────────────────────────────── */

const GENERAL_NOTES = [
  'Lives a long way from the road; village cadre is the most reliable way to reach the family.',
  'Works away from the village during harvest season, best contacted in the evening.',
  'Household of six in two rooms. Flagged for contact screening.',
  'Patient is anxious about the X-ray; explained the procedure again in Manggarai.',
  'No personal phone. Neighbour’s number recorded as the contact of last resort.',
  'Previously completed TB treatment; keeps the treatment card at home.',
];

function buildNotes(rng: Rng, patients: Patient[], screenings: Screening[]): void {
  patients.forEach((patient, index) => {
    if (!chance(rng, 0.45)) return;
    patient.notes.push({
      id: `note_${index + 1}_g`,
      patientId: patient.id,
      authorId: pick(rng, assignableWorkerIds),
      createdAt: dateTimeOffset(-int(rng, 2, 120), int(rng, 9, 16), int(rng, 0, 59)),
      body: pick(rng, GENERAL_NOTES),
      context: 'general',
    } satisfies PatientNote);
  });

  // Attach the reviewer's note to the patient timeline as well, so the patient
  // record reads as one continuous story rather than disconnected tabs.
  screenings.forEach((screening) => {
    if (!screening.review) return;
    const patient = patients.find((p) => p.id === screening.patientId);
    if (!patient) return;
    patient.notes.push({
      id: `note_${screening.id}_r`,
      patientId: patient.id,
      authorId: screening.review.reviewerId,
      createdAt: screening.review.reviewedAt,
      body: screening.review.notes,
      context: 'screening',
      contextId: screening.id,
    });
  });

  patients.forEach((patient) => {
    patient.notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/* ── Sync queue ────────────────────────────────────────────────────────────── */

const SYNC_ERRORS = [
  'Upload interrupted. Connection dropped at 64%.',
  'Request timed out after three retries.',
];

function buildSyncQueue(
  rng: Rng,
  screenings: Screening[],
  referrals: Referral[],
  followUps: FollowUp[],
  patients: Patient[],
): SyncQueueItem[] {
  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const items: SyncQueueItem[] = [];
  let sequence = 0;

  const push = (
    kind: SyncQueueItem['kind'],
    entityId: string,
    label: string,
    state: SyncState,
    queuedAt: string,
    sizeBytes: number,
  ) => {
    sequence += 1;
    const failed = state === 'failed';
    const conflict = state === 'conflict';
    items.push({
      id: `syn_${String(sequence).padStart(3, '0')}`,
      kind,
      entityId,
      label,
      state,
      queuedAt,
      lastAttemptAt:
        state === 'local-draft' ? null : dateTimeOffset(0, int(rng, 6, 9), int(rng, 0, 59)),
      attempts: state === 'local-draft' ? 0 : failed ? 3 : 1,
      sizeBytes,
      error: failed ? pick(rng, SYNC_ERRORS) : null,
      conflict: conflict
        ? {
            field: 'review.decision',
            localValue: 'observe',
            remoteValue: 'refer',
            remoteUpdatedAt: dateTimeOffset(-1, 15, 20),
            remoteActor: 'dr. Hanif Ramadhan',
          }
        : null,
    });
  };

  screenings
    .filter((s) => s.sync !== 'synced')
    .forEach((s) => {
      const patient = patientsById.get(s.patientId);
      push(
        'screening',
        s.id,
        `Screening · ${patient?.mrn ?? s.patientId}`,
        s.sync,
        s.performedAt,
        (s.imageMeta?.sizeBytes ?? 180 * 1024) + 12 * 1024,
      );
    });

  referrals
    .filter((r) => r.sync !== 'synced')
    .forEach((r) => {
      push('referral', r.id, `Referral · ${r.code}`, r.sync, r.createdAt, int(rng, 4, 18) * 1024);
    });

  followUps
    .filter((f) => f.sync !== 'synced')
    .forEach((f) => {
      push('followup', f.id, `Follow-up · ${f.code}`, f.sync, f.createdAt, int(rng, 2, 9) * 1024);
    });

  // A few already-synced entries so the page shows a complete picture rather
  // than only problems.
  screenings.slice(0, 4).forEach((s) => {
    const patient = patientsById.get(s.patientId);
    push(
      'screening',
      s.id,
      `Screening · ${patient?.mrn ?? s.patientId}`,
      'synced',
      s.performedAt,
      (s.imageMeta?.sizeBytes ?? 200 * 1024) + 12 * 1024,
    );
  });

  return items.sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
}

/* ── Entry point ───────────────────────────────────────────────────────────── */

export function createSeedDataset(): SeedDataset {
  const rng = createRng(SEED);

  const patients = buildPatients(rng);
  const screenings = buildScreenings(rng, patients);
  const referrals = buildReferrals(rng, screenings, patients);
  const followUps = buildFollowUps(rng, referrals, screenings, patients);
  buildNotes(rng, patients, screenings);
  const syncQueue = buildSyncQueue(rng, screenings, referrals, followUps, patients);

  return {
    patients,
    screenings: screenings.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    referrals: referrals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    followUps: followUps.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    syncQueue,
    lastSyncAt: dateTimeOffset(0, 7, 12),
  };
}
