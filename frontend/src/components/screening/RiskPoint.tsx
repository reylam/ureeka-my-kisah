import type { ScreeningAnalysis } from '@/types/domain';
import { RISK_BANDS, RISK_LABEL, riskOf } from '@/lib/risk';
import { cn } from '@/utils/cn';

/**
 * Risk point gauge.
 *
 * One number from 0 to 100 with the two band edges marked on the track, so a
 * reader sees where it sits instead of reading a bare figure. The number is
 * the model's TB score restated, and the line underneath says so: nothing on
 * this panel is a probability of illness.
 */

const TONE = {
  low: { text: 'text-ct-800', bar: 'bg-ct-500', chip: 'border-ct-200 bg-ct-50 text-ct-800' },
  moderate: {
    text: 'text-attention-800',
    bar: 'bg-attention-500',
    chip: 'border-attention-300/70 bg-attention-50 text-attention-800',
  },
  high: {
    text: 'text-urgent-800',
    bar: 'bg-urgent-500',
    chip: 'border-urgent-300/70 bg-urgent-50 text-urgent-800',
  },
} as const;

export function RiskPoint({
  analysis,
  className,
}: {
  analysis: ScreeningAnalysis;
  className?: string;
}) {
  const { point, level } = riskOf(analysis);
  const tone = TONE[level];

  return (
    <div className={cn('rounded-card border border-obsidian-200 bg-white p-3.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-obsidian-500 uppercase">
          Risk point
        </p>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
            tone.chip,
          )}
        >
          {RISK_LABEL[level]}
        </span>
      </div>

      <p className={cn('mt-1.5 text-3xl leading-none font-semibold tabular', tone.text)}>
        {point}
        <span className="ml-1 text-sm font-normal text-obsidian-400">/ 100</span>
      </p>

      <div
        role="meter"
        aria-label="Risk point"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={point}
        aria-valuetext={`${point} dari 100, ${RISK_LABEL[level].toLowerCase()}`}
        className="relative mt-3 h-1.5 w-full rounded-full bg-obsidian-100"
      >
        <div
          className={cn('h-full rounded-full', tone.bar)}
          style={{ width: `${Math.max(1, point)}%` }}
        />
        {[RISK_BANDS.moderate, RISK_BANDS.high].map((edge) => (
          <span
            key={edge}
            aria-hidden
            className="absolute -top-0.5 h-2.5 w-px bg-obsidian-400"
            style={{ left: `${edge}%` }}
          />
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-3.5 text-[10.5px] text-obsidian-400">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${RISK_BANDS.moderate}%` }}>
          {RISK_BANDS.moderate}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${RISK_BANDS.high}%` }}>
          {RISK_BANDS.high}
        </span>
        <span className="absolute right-0">100</span>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-obsidian-500">
        Score TB dari model pada skala 0 sampai 100. Ini bukan peluang bahwa orang ini menderita
        tuberkulosis, dan belum dikalibrasi terhadap populasi mana pun.
      </p>
    </div>
  );
}
