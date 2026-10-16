import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Boundary to the screening model.
 *
 * The model lives in a separate Python service (`train/tb-train/tb_ai/infer.py`
 * is the reference). This backend does not run it and does not imitate it:
 *
 *   - without INFERENCE_SERVICE_URL, analysis answers 503 and the report is
 *     marked `unavailable`;
 *   - with it, the image is posted as multipart (field `image`) and the JSON
 *     reply is validated and mapped. A reply that does not validate is
 *     rejected, not repaired.
 *
 * Nothing here ever produces a probability the model did not return.
 */

export const LABELS = ['Healthy', 'Sick-non-TB', 'TB'];

const probability = z.number().min(0).max(1);

// Shape of `predict()` in infer.py.
const rawResponse = z.object({
  prediction: z.enum(LABELS),
  probabilities: z.object({
    Healthy: probability,
    'Sick-non-TB': probability,
    TB: probability,
  }),
  model: z
    .object({
      classifier: z.string().optional(),
      backbone: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  detection: z
    .object({
      n_lesions: z.number().int().min(0).optional(),
      boxes: z
        .array(
          z.object({
            box_xyxy: z.tuple([z.number(), z.number(), z.number(), z.number()]),
            score: probability,
          }),
        )
        .default([]),
      score_threshold: z.number().optional(),
      skipped: z.boolean().optional(),
      reason: z.string().nullable().optional(),
    })
    .optional(),
});

/** Below this top-class probability the result is reported as inconclusive. */
const INCONCLUSIVE_BELOW = 0.6;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const baseName = (value) => (value ? String(value).split(/[\\/]/).pop() || undefined : undefined);

/**
 * Where a box sits on the film, in words a reader can check against the image.
 * Radiographs are viewed as if facing the patient, so the patient's right is
 * the left of the picture.
 */
export function zoneFor(box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = cx < 0.5 ? 'right' : 'left';
  const level = cy < 1 / 3 ? 'upper' : cy < 2 / 3 ? 'mid' : 'lower';
  return `${side} ${level} zone`;
}

/**
 * Map the service's reply onto the frontend's `ScreeningAnalysis`.
 * `size` is the image's pixel size, read from the stored file.
 */
export function toAnalysis(rawInput, size, now = new Date()) {
  const parsed = rawResponse.safeParse(rawInput);
  if (!parsed.success) {
    throw new ApiError(502, 'MODEL_BAD_RESPONSE', 'The screening model returned a response in an unexpected format.');
  }
  const raw = parsed.data;
  const detection = raw.detection;

  const regions = [];
  if (detection && !detection.skipped && size) {
    detection.boxes.forEach((entry, index) => {
      const [x1, y1, x2, y2] = entry.box_xyxy;
      const x = clamp01(x1 / size.width);
      const y = clamp01(y1 / size.height);
      const box = {
        x,
        y,
        width: clamp01(x2 / size.width) - x,
        height: clamp01(y2 / size.height) - y,
      };
      if (box.width <= 0 || box.height <= 0) return;
      regions.push({ id: `region-${index + 1}`, box, score: entry.score, zone: zoneFor(box) });
    });
  }

  const top = Math.max(...LABELS.map((label) => raw.probabilities[label]));
  let outcome;
  if (top < INCONCLUSIVE_BELOW) outcome = 'inconclusive';
  else if (raw.prediction === 'Healthy') outcome = 'no-alert';
  else outcome = 'flagged-for-review';

  return {
    outcome,
    predictedLabel: raw.prediction,
    probabilities: raw.probabilities,
    regions,
    model: {
      // A service might report a checkpoint path; keep only the file name so
      // no server directory ends up in the database or the UI.
      name: baseName(raw.model?.classifier) ?? 'unnamed classifier',
      version: raw.model?.version ?? 'unversioned',
      backbone: raw.model?.backbone ?? 'unknown',
      labels: LABELS,
      // No figure is claimed unless someone attaches a real evaluation.
      validation: null,
    },
    analysedAt: now.toISOString(),
    simulated: false,
    detectionNote: detection?.skipped ? (detection.reason ?? 'Lesion detection was skipped.') : null,
  };
}

export function createInferenceClient({ url, timeoutMs, apiKey = null }, fetchImpl = globalThis.fetch) {
  return {
    configured: Boolean(url),

    async analyze({ bytes, mime, fileName }) {
      if (!url) {
        throw ApiError.unavailable('MODEL_NOT_CONNECTED', 'The screening model is not connected to this server.');
      }
      const form = new FormData();
      form.append('image', new Blob([bytes], { type: mime }), fileName || 'image');

      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          body: form,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new ApiError(502, 'MODEL_UNREACHABLE', 'The screening model did not respond.');
      }
      if (!response.ok) {
        throw new ApiError(502, 'MODEL_ERROR', 'The screening model could not process this image.');
      }
      try {
        return await response.json();
      } catch {
        throw new ApiError(502, 'MODEL_BAD_RESPONSE', 'The screening model returned a response in an unexpected format.');
      }
    },
  };
}
