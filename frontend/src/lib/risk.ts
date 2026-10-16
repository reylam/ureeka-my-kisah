import type { RiskLevel, ScreeningAnalysis } from '@/types/domain';

/**
 * Risk point.
 *
 * The model's TB probability on a 0 to 100 scale. It is the network's own
 * output restated, not a second calculation, and it is not the chance that a
 * person has tuberculosis: the model has not been calibrated against any
 * population. The bands decide only how the number is drawn, they are not
 * clinical thresholds. The API computes the same thing (`riskFrom` in
 * `backend/src/services/inferenceService.js`); this mirror exists so analyses
 * stored before the field existed still show a risk point.
 */

export const RISK_BANDS = { moderate: 30, high: 60 } as const;

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Rendah',
  moderate: 'Sedang',
  high: 'Tinggi',
};

export function riskLevelFor(point: number): RiskLevel {
  if (point >= RISK_BANDS.high) return 'high';
  if (point >= RISK_BANDS.moderate) return 'moderate';
  return 'low';
}

export function riskOf(
  analysis: Pick<ScreeningAnalysis, 'probabilities' | 'riskPoint' | 'riskLevel'>,
): { point: number; level: RiskLevel } {
  const point =
    typeof analysis.riskPoint === 'number'
      ? analysis.riskPoint
      : Math.round(Math.min(1, Math.max(0, analysis.probabilities.TB)) * 100);
  return { point, level: analysis.riskLevel ?? riskLevelFor(point) };
}
