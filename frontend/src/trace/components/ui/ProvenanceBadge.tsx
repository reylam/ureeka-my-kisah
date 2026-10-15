import type { ReactNode } from 'react';
import { FlaskConical, HelpCircle, Link2 } from 'lucide-react';
import type { Provenance } from '@/trace/types';
import { cn } from '@/utils/cn';

/**
 * The label that keeps the rest of the site honest.
 *
 * Every number, table and chart renders one. A reader should be able to tell,
 * without reading any prose, whether a figure was measured, invented for the
 * layout, or simply never computed. The badge carries an icon as well as a
 * colour, so it survives greyscale printing and colour-blind vision.
 */

const CONFIG: Record<
  Provenance,
  { label: string; title: string; icon: typeof FlaskConical; tone: string }
> = {
  illustrative: {
    label: 'Illustrative',
    title: 'Mock data. Invented for this prototype, and not a measurement of any model.',
    icon: FlaskConical,
    tone: 'border-[#4a3b1c] bg-trace-flag-surface text-[#e0b76f]',
  },
  'not-computed': {
    label: 'Not computed',
    title: 'This value would be meaningful, but it has not been computed for this project.',
    icon: HelpCircle,
    tone: 'border-trace-line bg-trace-raised text-trace-dim',
  },
  external: {
    label: 'Cited',
    title: 'Documented from an external published source.',
    icon: Link2,
    tone: 'border-[#2b445f] bg-trace-accent-surface text-trace-accent-soft',
  },
};

export function ProvenanceBadge({
  provenance,
  className,
  showLabel = true,
}: {
  provenance: Provenance;
  className?: string;
  showLabel?: boolean;
}) {
  const config = CONFIG[provenance];
  const Icon = config.icon;
  return (
    <span
      title={config.title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-0.5',
        'font-mono text-[10px] uppercase tracking-[0.08em]',
        config.tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2} />
      {showLabel ? config.label : <span className="sr-only">{config.label}</span>}
    </span>
  );
}

/** Caption form, for use beneath a chart or a table. */
export function ProvenanceNote({
  provenance,
  children,
  className,
}: {
  provenance: Provenance;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-trace-dim',
        className,
      )}
    >
      <ProvenanceBadge provenance={provenance} />
      <span>{children ?? CONFIG[provenance].title}</span>
    </p>
  );
}
