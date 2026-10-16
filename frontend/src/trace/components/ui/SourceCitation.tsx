import { ExternalLink } from 'lucide-react';
import { SOURCES } from '@/trace/data/sources';
import type { Source } from '@/trace/types';
import { cn } from '@/utils/cn';

/**
 * Citations.
 *
 * `SourceCitation` is the inline form that sits under a claim. `SourceList` is
 * the full reference list. Both resolve by id from `sources.ts`, so a claim
 * cannot cite a source that does not exist. A missing id is a visible
 * "unknown source" rather than a silently plausible footnote.
 */

export function SourceCitation({
  sourceId,
  className,
  prefix = 'Sumber',
}: {
  sourceId: string;
  className?: string;
  prefix?: string;
}) {
  const source: Source | undefined = SOURCES[sourceId];
  if (!source) {
    return (
      <p className={cn('text-xs text-trace-flag', className)}>
        ID sumber “{sourceId}” tidak dikenal. Sitasi hilang.
      </p>
    );
  }

  return (
    <p className={cn('text-xs leading-5 text-trace-dim', className)}>
      {/* An empty prefix is used inside tables, where a "Source:" label would
          repeat the column header on every row. */}
      {prefix ? `${prefix}: ` : null}
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-baseline gap-1 text-trace-accent underline decoration-trace-accent-edge underline-offset-[3px] transition-colors hover:text-trace-accent-soft"
      >
        {source.label}
        <ExternalLink aria-hidden className="size-3 self-center" strokeWidth={2} />
      </a>{' '}
      <span className="text-trace-dim">
        · {source.publisher}, {source.year}
      </span>
    </p>
  );
}

export function SourceList({
  sources,
  className,
}: {
  sources: Source[];
  className?: string;
}) {
  return (
    <ol className={cn('space-y-4', className)}>
      {sources.map((source, index) => (
        <li key={source.id} className="flex gap-4">
          <span className="trace-label mt-1 shrink-0 text-trace-dim">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-baseline gap-1.5 text-[14.5px] font-medium text-trace-text transition-colors hover:text-trace-accent-soft"
            >
              {source.label}
              <ExternalLink aria-hidden className="size-3.5 self-center text-trace-dim" strokeWidth={2} />
            </a>
            <p className="mt-1 text-[13px] text-trace-muted">
              {source.publisher} · {source.year}
            </p>
            <p className="mt-1 text-[12.5px] leading-5 text-trace-dim">{source.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
