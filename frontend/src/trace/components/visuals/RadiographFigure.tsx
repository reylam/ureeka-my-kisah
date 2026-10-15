import type { ReactNode } from 'react';
import { SampleRadiograph } from '@/components/screening/SampleRadiograph';
import type { SampleRadiograph as SampleId } from '@/types/domain';
import { cn } from '@/utils/cn';

/**
 * Radiographic viewer frame.
 *
 * The image inside is the project's existing procedurally drawn SVG chest
 * radiograph, watermarked SYNTHETIC. No real patient radiograph is bundled
 * anywhere in this frontend, for two reasons: the licensing of public TB
 * datasets is restrictive about redistribution, and a hero image that looks
 * like a real scan invites the reader to believe a model looked at it.
 *
 * The frame carries corner ticks, a scale bar and mono metadata, which is what
 * makes it read as an instrument rather than a stock photo. The metadata says
 * "synthetic" and "not acquired" where that is the truth.
 */

export function RadiographFigure({
  variant = 'sample-a',
  annotations,
  annotationLabel,
  caption,
  metadata,
  className,
  children,
}: {
  variant?: SampleId;
  /** Schematic regions in normalised 0–1 coordinates. Never model output. */
  annotations?: { label: string; x: number; y: number; r: number }[];
  annotationLabel?: string;
  caption?: ReactNode;
  metadata?: { label: string; value: string }[];
  className?: string;
  children?: ReactNode;
}) {
  return (
    <figure
      className={cn(
        'overflow-hidden rounded-md border border-trace-line bg-trace-surface',
        className,
      )}
    >
      <div className="relative">
        <div className="trace-grid-fine aspect-square w-full bg-[#0a0c10]">
          <SampleRadiograph variant={variant} />
        </div>

        {/* Corner ticks */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {(
            [
              'left-3 top-3 border-l border-t',
              'right-3 top-3 border-r border-t',
              'left-3 bottom-3 border-l border-b',
              'right-3 bottom-3 border-r border-b',
            ] as const
          ).map((position) => (
            <span
              key={position}
              className={cn('absolute size-4 border-trace-accent/50', position)}
            />
          ))}
        </div>

        {/* Schematic annotation overlay */}
        {annotations?.length ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {annotations.map((region) => (
              <g key={region.label}>
                <circle
                  cx={region.x * 100}
                  cy={region.y * 100}
                  r={region.r * 100}
                  fill="rgb(91 159 232 / 0.1)"
                  stroke="#5b9fe8"
                  strokeWidth={0.4}
                  strokeDasharray="1.6 1.2"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={region.x * 100 + region.r * 100 + 1.5}
                  y={region.y * 100 - region.r * 100 + 2}
                  fontSize={3.2}
                  fontFamily="ui-monospace, monospace"
                  fill="#82b9f0"
                >
                  {region.label}
                </text>
              </g>
            ))}
          </svg>
        ) : null}

        {annotationLabel ? (
          <p className="absolute right-3 bottom-3 rounded border border-[#2b445f] bg-[#0a0c10]/85 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-trace-accent-soft">
            {annotationLabel}
          </p>
        ) : null}

        {children}
      </div>

      {metadata?.length ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-trace-line px-4 py-3 sm:grid-cols-4">
          {metadata.map((item) => (
            <div key={item.label}>
              <dt className="trace-label text-trace-dim">{item.label}</dt>
              <dd className="mt-1 font-mono text-[11.5px] text-trace-muted">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {caption ? (
        <figcaption className="border-t border-trace-line px-4 py-3 text-[12.5px] leading-5 text-trace-dim">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
