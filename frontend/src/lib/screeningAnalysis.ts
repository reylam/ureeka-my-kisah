import type { ClassLabel, ScreeningAnalysis } from '@/types/domain';
import { riskLevelFor } from './risk';

/**
 * Turn the model's class probabilities into a `ScreeningAnalysis`.
 *
 * The same mapping the API applies to a model service's reply
 * (`toAnalysis` in `backend/src/services/inferenceService.js`): the leading
 * class, an outcome, and the risk point. Nothing here is invented. Every
 * number comes from the network's own output, and the rules for the outcome
 * are the ones the server uses, so a result looks the same whichever side
 * produced it.
 */

export const CLASS_LABELS: ClassLabel[] = ['Healthy', 'Sick-non-TB', 'TB'];

/** Below this top-class probability the result is reported as inconclusive. */
export const INCONCLUSIVE_BELOW = 0.6;

export interface ModelIdentity {
  name: string;
  version: string;
  backbone: string;
}

export function analysisFromProbabilities(
  probabilities: Record<ClassLabel, number>,
  model: ModelIdentity,
  now: Date = new Date(),
): ScreeningAnalysis {
  const predictedLabel = CLASS_LABELS.reduce((best, label) =>
    probabilities[label] > probabilities[best] ? label : best,
  );
  const top = probabilities[predictedLabel];

  const outcome =
    top < INCONCLUSIVE_BELOW
      ? 'inconclusive'
      : predictedLabel === 'Healthy'
        ? 'no-alert'
        : 'flagged-for-review';

  const riskPoint = Math.round(Math.min(1, Math.max(0, probabilities.TB)) * 100);

  return {
    outcome,
    predictedLabel,
    probabilities,
    riskPoint,
    riskLevel: riskLevelFor(riskPoint),
    regions: [],
    model: {
      name: model.name,
      version: model.version,
      backbone: model.backbone,
      labels: CLASS_LABELS,
      // No figure is claimed unless someone attaches a real evaluation.
      validation: null,
    },
    analysedAt: now.toISOString(),
    simulated: false,
    detectionNote: null,
  };
}
