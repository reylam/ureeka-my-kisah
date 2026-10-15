import type { ReactNode } from 'react';
import type { Provenance } from '@/trace/types';
import { ProvenanceBadge } from '@/trace/components/ui/ProvenanceBadge';
import { cn } from '@/utils/cn';

/**
 * The frame every chart on this site sits in.
 *
 * It exists so that no chart can be published without the things that make a
 * chart readable: a title, what the axes are, a legend, the sample size, a
 * provenance badge, and a caption explaining what the reader is supposed to
 * take from it. A decorative chart with none of that is worse than no chart.
 */
export function ResearchChart({
  title,
  subtitle,
  provenance,
  legend,
  sampleSize,
  caption,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  provenance: Provenance;
  legend?: { label: string; colour: string; dashed?: boolean }[];
  sampleSize?: string;
  caption: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'flex h-full flex-col rounded-md border border-trace-line bg-trace-card',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-trace-line px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-[14.5px] font-medium text-trace-text">{title}</h4>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-trace-dim">{subtitle}</p> : null}
        </div>
        <ProvenanceBadge provenance={provenance} />
      </div>

      <div className="px-2 pt-4 pb-1 sm:px-3">{children}</div>

      {legend?.length ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pb-1">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-[12px] text-trace-muted">
              <span
                aria-hidden
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={
                  item.dashed
                    ? {
                        backgroundImage: `repeating-linear-gradient(to right, ${item.colour} 0 3px, transparent 3px 6px)`,
                      }
                    : { backgroundColor: item.colour }
                }
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      <figcaption className="mt-auto border-t border-trace-line px-4 py-3 text-[12.5px] leading-5 text-trace-dim">
        {caption}
        {sampleSize ? (
          <span className="mt-1 block font-mono text-[11px] tracking-[0.04em] text-trace-dim">
            n = {sampleSize}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/* ───────────────────────────── shared scales ───────────────────────────── */

export const PALETTE = {
  accent: '#5b9fe8',
  accentSoft: '#82b9f0',
  flag: '#d8a657',
  neutral: '#8d96a3',
  grid: '#232832',
  axis: '#6d7480',
} as const;

export interface Plot {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export function makeScales(
  plot: Plot,
  domain: { x: [number, number]; y: [number, number] },
) {
  const innerWidth = plot.width - plot.padding.left - plot.padding.right;
  const innerHeight = plot.height - plot.padding.top - plot.padding.bottom;
  const [x0, x1] = domain.x;
  const [y0, y1] = domain.y;

  return {
    innerWidth,
    innerHeight,
    x: (value: number) => plot.padding.left + ((value - x0) / (x1 - x0)) * innerWidth,
    y: (value: number) => plot.padding.top + innerHeight - ((value - y0) / (y1 - y0)) * innerHeight,
  };
}

/** Axis frame: gridlines, tick labels and axis titles. Decorative parts hidden. */
export function Axes({
  plot,
  scales,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  formatX = (value) => String(value),
  formatY = (value) => String(value),
}: {
  plot: Plot;
  scales: ReturnType<typeof makeScales>;
  xTicks: number[];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
}) {
  return (
    <g aria-hidden>
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line
            x1={plot.padding.left}
            x2={plot.width - plot.padding.right}
            y1={scales.y(tick)}
            y2={scales.y(tick)}
            stroke={PALETTE.grid}
            strokeWidth={1}
          />
          <text
            x={plot.padding.left - 8}
            y={scales.y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill={PALETTE.axis}
          >
            {formatY(tick)}
          </text>
        </g>
      ))}

      {xTicks.map((tick) => (
        <text
          key={`x-${tick}`}
          x={scales.x(tick)}
          y={plot.height - plot.padding.bottom + 16}
          textAnchor="middle"
          fontSize={10}
          fontFamily="ui-monospace, monospace"
          fill={PALETTE.axis}
        >
          {formatX(tick)}
        </text>
      ))}

      <text
        x={plot.padding.left + scales.innerWidth / 2}
        y={plot.height - 2}
        textAnchor="middle"
        fontSize={10}
        letterSpacing={0.6}
        fill={PALETTE.axis}
      >
        {xLabel}
      </text>
      <text
        x={10}
        y={plot.padding.top + scales.innerHeight / 2}
        textAnchor="middle"
        fontSize={10}
        letterSpacing={0.6}
        fill={PALETTE.axis}
        transform={`rotate(-90 10 ${plot.padding.top + scales.innerHeight / 2})`}
      >
        {yLabel}
      </text>
    </g>
  );
}

/** Builds an SVG path through points. Straight segments only — no smoothing. */
export function linePath(
  points: { x: number; y: number }[],
  scales: ReturnType<typeof makeScales>,
): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${scales.x(point.x)} ${scales.y(point.y)}`)
    .join(' ');
}
