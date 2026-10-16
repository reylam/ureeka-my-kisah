import { useState } from 'react';
import type { ActivityPoint } from '@/stores/selectors';
import { formatDateShort, isToday, parseISODate } from '@/utils/date';
import { cn } from '@/utils/cn';

/**
 * Daily screening volume.
 *
 * Hand-rolled SVG rather than a charting library: the chart has exactly one
 * job: show how many screenings were recorded each day and how many of those
 * were flagged. A dependency would bring a generic look with it.
 *
 * Every bar is computed from real records in the local dataset. There is no
 * synthetic smoothing, no projected trend and no second axis.
 */
export function ActivityChart({
  data,
  className,
}: {
  data: ActivityPoint[];
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((point) => point.total));
  // Round the axis up to something tidy so the gridlines read cleanly.
  const axisMax = max <= 4 ? 4 : Math.ceil(max / 2) * 2;

  const height = 132;
  const barGap = 3;

  const total = data.reduce((sum, point) => sum + point.total, 0);
  const flagged = data.reduce((sum, point) => sum + point.flagged, 0);

  if (total === 0) {
    return (
      <div className={cn('flex h-40 items-center justify-center', className)}>
        <p className="text-[13px] text-obsidian-500">
          Belum ada screening yang tercatat dalam {data.length} hari terakhir.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-4">
          <Legend swatch="bg-ct-400" label="Screening" value={total} />
          <Legend swatch="bg-attention-500" label="Ditandai untuk review" value={flagged} />
        </div>
        <p className="text-xs text-obsidian-400">{data.length} hari terakhir</p>
      </div>

      <div className="relative mt-3" style={{ height }}>
        {/* Gridlines + axis labels */}
        <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
          {[axisMax, axisMax / 2, 0].map((value) => (
            <div key={value} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right text-[10px] text-obsidian-400 tabular">
                {value}
              </span>
              <span className="h-px flex-1 bg-obsidian-100" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-[3px] pl-6">
          {data.map((point, index) => {
            const totalHeight = (point.total / axisMax) * height;
            const flaggedHeight = (point.flagged / axisMax) * height;
            const today = isToday(point.date);
            return (
              <button
                key={point.date}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${formatDateShort(point.date)}: ${point.total} screening, ${point.flagged} ditandai untuk review`}
                className="group relative flex h-full flex-1 cursor-default flex-col justify-end rounded-sm"
                style={{ marginRight: barGap - 3 }}
              >
                {/* Hover column */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 inset-y-0 rounded-sm transition-colors',
                    active === index ? 'bg-obsidian-100/70' : 'bg-transparent',
                  )}
                />
                <span
                  aria-hidden
                  className="relative w-full rounded-t-sm bg-ct-300 transition-colors group-hover:bg-ct-400"
                  style={{ height: Math.max(point.total > 0 ? 3 : 0, totalHeight) }}
                >
                  {point.flagged > 0 ? (
                    <span
                      className="absolute inset-x-0 bottom-0 rounded-t-sm bg-attention-500"
                      style={{ height: Math.max(3, flaggedHeight) }}
                    />
                  ) : null}
                </span>
                {today ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-px inset-x-0 h-0.5 rounded bg-obsidian-950"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tooltip */}
        {active !== null && data[active] ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-1 right-0 z-10 rounded-md border border-obsidian-200 bg-white px-2.5 py-1.5 text-xs shadow-overlay"
          >
            <p className="font-medium text-obsidian-900">
              {parseISODate(data[active].date).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              })}
            </p>
            <p className="mt-0.5 text-obsidian-600 tabular">
              {data[active].total} screening
            </p>
            {data[active].flagged > 0 ? (
              <p className="text-attention-700 tabular">{data[active].flagged} ditandai</p>
            ) : null}
          </div>
        ) : null}

      </div>

      {/* Date axis: only the ends and the midpoint, to avoid a crowded ruler */}
      <div aria-hidden className="mt-1.5 flex justify-between pl-6 text-[10px] text-obsidian-400">
        <span>{data[0] ? formatDateShort(data[0].date) : ''}</span>
        <span>
          {data[Math.floor(data.length / 2)]
            ? formatDateShort(data[Math.floor(data.length / 2)]!.date)
            : ''}
        </span>
        <span className="font-medium text-obsidian-600">Hari ini</span>
      </div>
    </div>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-obsidian-500">
      <span aria-hidden className={cn('size-2 rounded-sm', swatch)} />
      {label}
      <span className="font-semibold text-obsidian-900 tabular">{value}</span>
    </span>
  );
}
