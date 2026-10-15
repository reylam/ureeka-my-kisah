import { ChevronRight } from 'lucide-react';
import type { PipelineStage } from '@/trace/types';
import { cn } from '@/utils/cn';

/**
 * Horizontal workflow diagram.
 *
 * Each step carries a status chip, because the difference between "this runs in
 * the prototype" and "this is planned" is the single most important thing the
 * diagram has to convey. A flow chart that shows planned and implemented steps
 * in identical boxes is a claim that everything is built.
 *
 * On narrow screens the row becomes a vertical list with the connector running
 * down the left, rather than a horizontally squeezed version of the same thing.
 */
export function PipelineDiagram({
  stages,
  className,
}: {
  stages: PipelineStage[];
  className?: string;
}) {
  return (
    <ol className={cn('grid gap-3 lg:grid-cols-6 lg:gap-0', className)}>
      {stages.map((stage, index) => (
        <li key={stage.id} className="relative flex lg:block">
          {/* Connector: horizontal on wide screens, vertical on narrow ones */}
          <div
            aria-hidden
            className="mr-3 flex w-6 shrink-0 flex-col items-center lg:mr-0 lg:w-auto lg:flex-row lg:pb-3"
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[10px]',
                stage.status === 'in-prototype'
                  ? 'border-[#2b445f] bg-trace-accent-surface text-trace-accent-soft'
                  : 'border-trace-line bg-trace-card text-trace-dim',
              )}
            >
              {index + 1}
            </span>
            {index < stages.length - 1 ? (
              <>
                <span className="w-px flex-1 bg-trace-line lg:hidden" />
                <span className="hidden h-px flex-1 bg-trace-line lg:block" />
                <ChevronRight className="hidden size-3.5 shrink-0 text-trace-line lg:block" />
              </>
            ) : null}
          </div>

          <div className="min-w-0 pb-6 lg:pr-4 lg:pb-0">
            <h3 className="text-[13.5px] font-medium text-trace-text">{stage.label}</h3>
            <p className="mt-1.5 text-[12.5px] leading-5 text-trace-dim">{stage.description}</p>
            <p
              className={cn(
                'mt-2 inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                stage.status === 'in-prototype'
                  ? 'border-[#2b445f] bg-trace-accent-surface text-trace-accent-soft'
                  : 'border-trace-line bg-trace-raised text-trace-dim',
              )}
            >
              {stage.status === 'in-prototype' ? 'In prototype' : 'Planned'}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Vertical, numbered methodology chain with a description and an output per
 * stage. Separate from the diagram above because this one is read, not scanned.
 */
export function MethodChain({
  stages,
  className,
}: {
  stages: { id: string; label: string; description: string; outputs: string }[];
  className?: string;
}) {
  return (
    <ol className={cn('relative', className)}>
      <span aria-hidden className="absolute top-2 bottom-2 left-[13px] w-px bg-trace-line" />
      {stages.map((stage, index) => (
        <li key={stage.id} className="relative flex gap-4 pb-7 last:pb-0">
          <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-trace-line bg-trace-card font-mono text-[11px] text-trace-accent-soft">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-[15px] font-medium text-trace-text">{stage.label}</h3>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
              {stage.description}
            </p>
            <p className="mt-2 font-mono text-[11.5px] leading-5 text-trace-dim">
              <span className="trace-label mr-2">Output</span>
              {stage.outputs}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
