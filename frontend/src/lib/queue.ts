import type { QueuePriority, ScreeningAnalysis } from '@/types/domain';
import { riskOf } from './risk';

/** Most urgent first. */
export const PRIORITY_ORDER: QueuePriority[] = ['high', 'medium', 'low'];

export const PRIORITY_LABEL: Record<QueuePriority, string> = {
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Rendah',
};

export const PRIORITY_HINT: Record<QueuePriority, string> = {
  high: 'Dipanggil lebih dulu dari prioritas lain.',
  medium: 'Dipanggil setelah prioritas tinggi.',
  low: 'Dipanggil setelah prioritas tinggi dan sedang.',
};

/**
 * Where the model would put this visit in the queue, as a starting point for
 * the radiologist, who decides. It follows the risk point's display bands
 * (lib/risk.ts) and nothing else: a flagged reading with a high TB score goes
 * first, a confident healthy reading last, and anything unclear in between.
 */
export function suggestPriority(analysis: ScreeningAnalysis | null): { priority: QueuePriority; reason: string } {
  if (!analysis) {
    return { priority: 'medium', reason: 'Tidak ada hasil model, jadi saran ada di tengah.' };
  }
  const { point, level } = riskOf(analysis);
  if (analysis.outcome === 'inconclusive') {
    return { priority: 'medium', reason: 'Hasil model belum meyakinkan.' };
  }
  if (level === 'high') return { priority: 'high', reason: `Risk point ${point}, di pita tinggi.` };
  if (level === 'moderate' || analysis.outcome === 'flagged-for-review') {
    return { priority: 'medium', reason: `Risk point ${point}; model menandai gambar ini.` };
  }
  return { priority: 'low', reason: `Risk point ${point}, tanpa peringatan dari model.` };
}

/** "K7M29QXP" -> "K7M2-9QXP", the way the code is read out and written down. */
export function formatAccessCode(code: string): string {
  const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** The alphabet codes are drawn from (no I, O, 0 or 1). */
const CODE_CHARS = /[A-HJ-NP-Z2-9]/g;

/** Tidy what a person types into a code box: only code characters, grouped. */
export function formatTypedCode(value: string): string {
  return formatAccessCode((value.toUpperCase().match(CODE_CHARS) ?? []).join('').slice(0, 8));
}
