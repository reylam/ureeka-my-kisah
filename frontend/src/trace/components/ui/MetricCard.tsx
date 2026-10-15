import type { MetricValue } from '@/trace/types';
import { ProvenanceBadge } from './ProvenanceBadge';
import { cn } from '@/utils/cn';

/**
 * One metric: name, value, and the sentence that says what the value counts.
 *
 * The caption is not decoration. "Sensitivity 0.897" is close to meaningless on
 * its own; "113 of 126 TB-labelled images flagged, 13 missed" is a fact a
 * reader can argue with. Every metric card on the site carries both.
 */
export function MetricCard({
  metric,
  className,
  showBar = true,
}: {
  metric: MetricValue;
  className?: string;
  showBar?: boolean;
}) {
  const hasBar = showBar && typeof metric.raw === 'number' && metric.raw >= 0 && metric.raw <= 1;

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-md border border-trace-line bg-trace-card p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="trace-label text-trace-dim">{metric.label}</p>
        <ProvenanceBadge provenance={metric.provenance} showLabel={false} />
      </div>

      <p className="mt-3 font-semibold tabular-nums text-[26px] leading-none tracking-[-0.02em] text-trace-text">
        {metric.value}
      </p>

      {hasBar ? (
        <div
          aria-hidden
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-trace-raised"
        >
          <div
            className="h-full rounded-full bg-trace-accent/70"
            style={{ width: `${(metric.raw ?? 0) * 100}%` }}
          />
        </div>
      ) : null}

      <p className="mt-3 text-[12.5px] leading-5 text-trace-dim">{metric.caption}</p>
    </div>
  );
}

/** Dense variant for the homepage preview strip. */
export function MetricRow({ metric }: { metric: MetricValue }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-trace-line-soft py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-trace-text">{metric.label}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-trace-dim">{metric.caption}</p>
      </div>
      <p className="shrink-0 font-mono text-[15px] tabular-nums text-trace-accent-soft">
        {metric.value}
      </p>
    </div>
  );
}
