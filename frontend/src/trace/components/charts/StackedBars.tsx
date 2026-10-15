import { formatCount } from '@/trace/lib/format';
import { PALETTE } from './ResearchChart';

/**
 * Class composition across splits.
 *
 * Horizontal stacked bars rather than a pie: the comparison that matters is
 * "how small is the positive class", and a length is easier to compare than an
 * angle. Counts are printed on the bars, because the proportion alone hides
 * whether a split holds 126 positive cases or 12.
 */

export interface SplitRow {
  label: string;
  segments: { label: string; value: number }[];
}

const COLOURS = [PALETTE.neutral, PALETTE.accent];

export function StackedBars({ rows, unit = 'images' }: { rows: SplitRow[]; unit?: string }) {
  const max = Math.max(...rows.map((row) => row.segments.reduce((sum, s) => sum + s.value, 0)));

  return (
    <div className="space-y-4 px-2 pb-2">
      {rows.map((row) => {
        const total = row.segments.reduce((sum, segment) => sum + segment.value, 0);
        return (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-trace-text">{row.label}</p>
              <p className="font-mono text-[11.5px] tabular-nums text-trace-dim">
                {formatCount(total)} {unit}
              </p>
            </div>
            <div
              className="mt-2 flex h-5 overflow-hidden rounded-sm bg-trace-raised"
              style={{ width: `${(total / max) * 100}%` }}
            >
              {row.segments.map((segment, index) => (
                <div
                  key={segment.label}
                  title={`${segment.label}: ${formatCount(segment.value)} ${unit}`}
                  style={{
                    width: `${(segment.value / total) * 100}%`,
                    backgroundColor: COLOURS[index % COLOURS.length],
                    opacity: index === 0 ? 0.35 : 0.9,
                  }}
                />
              ))}
            </div>

            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
              {row.segments.map((segment, index) => (
                <li
                  key={segment.label}
                  className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-trace-dim"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: COLOURS[index % COLOURS.length],
                      opacity: index === 0 ? 0.35 : 0.9,
                    }}
                  />
                  {segment.label} {formatCount(segment.value)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
