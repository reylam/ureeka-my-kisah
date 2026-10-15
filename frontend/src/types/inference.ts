/**
 * Wire contract for the screening model service.
 *
 * This mirrors, field for field, the JSON emitted by the sibling Python
 * project (`tb-train/tb_ai/infer.py`). The frontend's demo simulator produces
 * objects of exactly this shape, so swapping in the real service later is a
 * matter of replacing the transport in `services/screeningService.ts`. No
 * component or store needs to change.
 *
 * Nothing in this file performs inference.
 */

import type { ClassLabel } from './domain';

export interface InferenceBox {
  /** [x1, y1, x2, y2] in the original image's pixel space. */
  box_xyxy: [number, number, number, number];
  score: number;
}

export interface InferenceDetection {
  n_lesions: number;
  boxes: InferenceBox[];
  score_threshold?: number;
  /** The real service skips detection unless the class is TB. */
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export interface InferenceResponse {
  image: string;
  prediction: ClassLabel;
  probabilities: Record<ClassLabel, number>;
  model: {
    classifier: string;
    backbone: string;
  };
  disclaimer: string;
  detection?: InferenceDetection;
}

/** Bilingual screening disclaimer, matching the Python service verbatim. */
export const SCREENING_DISCLAIMER =
  'Hasil ini adalah alat bantu SKRINING berbasis AI, bukan diagnosis medis. ' +
  'Konsultasikan dengan tenaga kesehatan untuk evaluasi lebih lanjut. / ' +
  'This AI SCREENING aid is not a medical diagnosis; consult a clinician.';

/**
 * Where a real inference service would live. Unset in this prototype. The
 * absence of this value is what puts the app into simulated mode.
 */
export const INFERENCE_ENDPOINT: string | null = null;
