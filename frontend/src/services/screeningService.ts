/**
 * Screening analysis: demo simulator.
 *
 * ── What this actually does ────────────────────────────────────────────────
 * It does NOT look at the uploaded image. No model runs in the browser, and no
 * image leaves the device. The simulator produces a plausible, deterministic
 * result from data the health worker already typed in (symptom duration,
 * red-flag symptoms, declared image quality), purely so the downstream
 * workflow (review, referral, follow-up, report) can be demonstrated
 * end to end.
 *
 * Everything it returns is marked `simulated: true` and every surface that
 * displays it carries an explicit notice.
 *
 * ── Swapping in the real model ─────────────────────────────────────────────
 * `requestAnalysis` is the only seam. It returns an `InferenceResponse`, which
 * is the exact JSON shape emitted by the sibling Python service
 * (`tb-train/tb_ai/infer.py`). To go live: set `INFERENCE_ENDPOINT`, POST the
 * image blob there, and delete the simulator branch. Nothing else in the
 * application needs to change.
 */

import type {
  ImageQuality,
  LesionRegion,
  ScreeningAnalysis,
  ScreeningOutcome,
  SymptomSet,
  ClassLabel,
} from '@/types/domain';
import {
  INFERENCE_ENDPOINT,
  SCREENING_DISCLAIMER,
  type InferenceResponse,
} from '@/types/inference';
import { DEMO_MODEL } from '@/data/model';
import { jitteredDelay } from './delay';

export interface AnalysisRequest {
  symptoms: SymptomSet;
  imageQuality: ImageQuality;
  /** Used only to make the simulator's output stable per image. */
  imageFingerprint: string;
}

/* ── Deterministic pseudo-randomness from a string ─────────────────────────
   Keeps a given screening's numbers identical across reloads, so the report
   and the result page never disagree with each other. */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function seededValue(fingerprint: string, salt: string): number {
  return hashString(`${fingerprint}:${salt}`);
}

/* ── Rule-based scenario selection ─────────────────────────────────────────── */

/**
 * A crude symptom score. This is NOT a validated clinical score. It only
 * exists to make the demo's branching feel connected to the data entered.
 */
function symptomScore(symptoms: SymptomSet): number {
  let score = 0;
  if (symptoms.coughWeeks >= 2) score += 2;
  if (symptoms.coughWeeks >= 4) score += 1;
  if (symptoms.hemoptysis) score += 3;
  if (symptoms.weightLoss) score += 2;
  if (symptoms.nightSweats) score += 2;
  if (symptoms.fever) score += 1;
  if (symptoms.chestPain) score += 1;
  if (symptoms.fatigue) score += 1;
  if (symptoms.appetiteLoss) score += 1;
  return score;
}

export function chooseScenario(request: AnalysisRequest): ScreeningOutcome {
  // An unusable radiograph can only ever produce an inconclusive result.
  if (request.imageQuality === 'inadequate') return 'inconclusive';

  const score = symptomScore(request.symptoms);
  const roll = seededValue(request.imageFingerprint, 'scenario');

  if (request.imageQuality === 'borderline' && roll < 0.45) return 'inconclusive';
  if (score >= 6) return 'flagged-for-review';
  if (score >= 3) return roll < 0.55 ? 'flagged-for-review' : 'no-alert';
  return roll < 0.12 ? 'flagged-for-review' : 'no-alert';
}

/* ── Probability + region synthesis ────────────────────────────────────────── */

const ZONES: { zone: string; x: number; y: number }[] = [
  { zone: 'right upper zone', x: 0.2, y: 0.19 },
  { zone: 'left upper zone', x: 0.58, y: 0.18 },
  { zone: 'right mid zone', x: 0.22, y: 0.42 },
  { zone: 'left mid zone', x: 0.6, y: 0.43 },
];

function normalise(values: Record<ClassLabel, number>): Record<ClassLabel, number> {
  const total = values.Healthy + values['Sick-non-TB'] + values.TB;
  return {
    Healthy: Number((values.Healthy / total).toFixed(4)),
    'Sick-non-TB': Number((values['Sick-non-TB'] / total).toFixed(4)),
    TB: Number((values.TB / total).toFixed(4)),
  };
}

function buildProbabilities(
  outcome: ScreeningOutcome,
  fingerprint: string,
): { probabilities: Record<ClassLabel, number>; label: ClassLabel } {
  const a = seededValue(fingerprint, 'pa');
  const b = seededValue(fingerprint, 'pb');

  if (outcome === 'flagged-for-review') {
    return {
      probabilities: normalise({
        Healthy: 0.02 + a * 0.1,
        'Sick-non-TB': 0.05 + b * 0.18,
        TB: 0.64 + a * 0.28,
      }),
      label: 'TB',
    };
  }

  if (outcome === 'no-alert') {
    const healthyDominant = a > 0.4;
    return {
      probabilities: normalise({
        Healthy: healthyDominant ? 0.72 + b * 0.22 : 0.12 + b * 0.16,
        'Sick-non-TB': healthyDominant ? 0.06 + a * 0.14 : 0.64 + a * 0.26,
        TB: 0.01 + b * 0.06,
      }),
      label: healthyDominant ? 'Healthy' : 'Sick-non-TB',
    };
  }

  // Inconclusive: a flat distribution with no usable margin.
  const probabilities = normalise({
    Healthy: 0.3 + a * 0.08,
    'Sick-non-TB': 0.3 + b * 0.08,
    TB: 0.3 + (1 - a) * 0.08,
  });
  const label = (Object.entries(probabilities) as [ClassLabel, number][]).sort(
    (x, y) => y[1] - x[1],
  )[0]![0];
  return { probabilities, label };
}

function buildRegions(outcome: ScreeningOutcome, fingerprint: string): LesionRegion[] {
  if (outcome !== 'flagged-for-review') return [];

  const count = seededValue(fingerprint, 'count') < 0.55 ? 1 : 2;
  const offset = Math.floor(seededValue(fingerprint, 'zone') * ZONES.length);

  return Array.from({ length: count }, (_, i) => {
    const spot = ZONES[(offset + i * 2) % ZONES.length]!;
    const jitter = seededValue(fingerprint, `j${i}`);
    const size = 0.08 + jitter * 0.08;
    return {
      id: `rg_${i + 1}`,
      box: {
        x: Number((spot.x + (jitter - 0.5) * 0.04).toFixed(4)),
        y: Number((spot.y + (jitter - 0.5) * 0.04).toFixed(4)),
        width: Number(size.toFixed(4)),
        height: Number((size * 1.1).toFixed(4)),
      },
      score: Number((0.55 + jitter * 0.38).toFixed(4)),
      zone: spot.zone,
    };
  });
}

/* ── The seam ──────────────────────────────────────────────────────────────── */

const DETECTION_SKIPPED_NOTE =
  'Lesion localisation was not run because the top class was not TB. This matches the ' +
  'two-stage screening logic: classify first, localise only when TB is the leading class.';

const DETECTION_INCONCLUSIVE_NOTE =
  'No class reached the confidence margin required to report a screening result. ' +
  'Lesion localisation was not attempted.';

/**
 * Returns a response in the real service's wire format.
 *
 * When `INFERENCE_ENDPOINT` is configured this is where the HTTP call goes.
 * Until then, the simulator answers.
 */
export async function requestAnalysis(request: AnalysisRequest): Promise<InferenceResponse> {
  if (INFERENCE_ENDPOINT) {
    // Intentionally unreachable in the prototype. Left as the documented
    // integration point rather than a fabricated endpoint call.
    throw new Error('A real inference endpoint is configured but no transport is implemented yet.');
  }

  await jitteredDelay(1100, 500);

  const outcome = chooseScenario(request);
  const { probabilities, label } = buildProbabilities(outcome, request.imageFingerprint);
  const regions = buildRegions(outcome, request.imageFingerprint);

  return {
    image: request.imageFingerprint,
    prediction: label,
    probabilities,
    model: { classifier: DEMO_MODEL.version, backbone: DEMO_MODEL.backbone },
    disclaimer: SCREENING_DISCLAIMER,
    detection:
      outcome === 'flagged-for-review'
        ? {
            n_lesions: regions.length,
            // Converted back to pixel space to match the real service exactly.
            boxes: regions.map((region) => ({
              box_xyxy: [
                Number((region.box.x * 1024).toFixed(1)),
                Number((region.box.y * 1024).toFixed(1)),
                Number(((region.box.x + region.box.width) * 1024).toFixed(1)),
                Number(((region.box.y + region.box.height) * 1024).toFixed(1)),
              ] as [number, number, number, number],
              score: region.score,
            })),
            score_threshold: 0.5,
          }
        : {
            n_lesions: 0,
            boxes: [],
            skipped: true,
            reason: outcome === 'no-alert' ? DETECTION_SKIPPED_NOTE : DETECTION_INCONCLUSIVE_NOTE,
          },
  };
}

/** Map a wire response onto the domain model stored against a screening. */
export function toScreeningAnalysis(
  response: InferenceResponse,
  outcome: ScreeningOutcome,
): ScreeningAnalysis {
  const regions: LesionRegion[] = (response.detection?.boxes ?? []).map((box, index) => {
    const [x1, y1, x2, y2] = box.box_xyxy;
    return {
      id: `rg_${index + 1}`,
      box: {
        x: x1 / 1024,
        y: y1 / 1024,
        width: (x2 - x1) / 1024,
        height: (y2 - y1) / 1024,
      },
      score: box.score,
      zone: describeZone(x1 / 1024, y1 / 1024),
    };
  });

  return {
    outcome,
    predictedLabel: response.prediction,
    probabilities: response.probabilities,
    regions,
    model: DEMO_MODEL,
    analysedAt: new Date().toISOString(),
    simulated: true,
    detectionNote: response.detection?.reason ?? null,
  };
}

/** Plain-language anatomical hint from a normalised coordinate. */
export function describeZone(x: number, y: number): string {
  // Radiographs are displayed as if facing the patient, so image-left is the
  // patient's right side.
  const side = x < 0.5 ? 'right' : 'left';
  const band = y < 0.33 ? 'upper zone' : y < 0.66 ? 'mid zone' : 'lower zone';
  return `${side} ${band}`;
}

/**
 * Stable fingerprint for an uploaded file. Derived from metadata only. The
 * pixel data is never read, hashed or transmitted.
 */
export function fingerprintFile(file: { name: string; size: number }): string {
  return `${file.name}:${file.size}`;
}
