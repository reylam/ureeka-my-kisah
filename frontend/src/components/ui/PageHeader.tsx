import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Page header.
 *
 * Deliberately modest: operational dashboards do not need 40px display type.
 * The title sits at 20px so the data below it stays the focus.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Primary actions, right-aligned on desktop. */
  actions?: ReactNode;
  /** Small inline facts shown under the title, e.g. record counts. */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-xl leading-tight font-semibold text-obsidian-950">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-obsidian-500">{description}</p>
        ) : null}
        {meta ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-obsidian-500">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Small key/value pair for the header's meta row. */
export function HeaderMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-obsidian-400">{label}</span>
      <span className="font-medium text-obsidian-800 tabular">{value}</span>
    </span>
  );
}
