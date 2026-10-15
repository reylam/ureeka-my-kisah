import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Step {
  id: string;
  label: string;
  /** Shown under the label on wide screens. */
  hint?: string;
}

/**
 * Horizontal step indicator.
 *
 * Completed steps are clickable so the user can go back and correct something
 * without losing their place; steps ahead are not, because they may depend on
 * data that has not been entered yet.
 */
export function Stepper({
  steps,
  current,
  completed,
  onStepClick,
  className,
}: {
  steps: Step[];
  /** Index of the active step. */
  current: number;
  /** Indices the user has already completed. */
  completed: number[];
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn('flex w-full items-stretch gap-1', className)}>
      {steps.map((step, index) => {
        const isDone = completed.includes(index) && index !== current;
        const isCurrent = index === current;
        const reachable = isDone || isCurrent;

        const content = (
          <>
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular',
                  isCurrent
                    ? 'bg-obsidian-950 text-white'
                    : isDone
                      ? 'bg-ct-400 text-obsidian-950'
                      : 'bg-obsidian-200 text-obsidian-500',
                )}
              >
                {isDone ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  'truncate text-[13px] font-medium',
                  isCurrent
                    ? 'text-obsidian-950'
                    : isDone
                      ? 'text-obsidian-700'
                      : 'text-obsidian-400',
                )}
              >
                {step.label}
              </span>
            </span>
            {step.hint ? (
              <span className="mt-1 hidden truncate pl-7 text-[11px] text-obsidian-400 lg:block">
                {step.hint}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={step.id} className="min-w-0 flex-1">
            {onStepClick && reachable && !isCurrent ? (
              <button
                type="button"
                onClick={() => onStepClick(index)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col border-t-2 pt-2.5 pb-1 text-left transition-colors',
                  'border-ct-400 hover:border-ct-500',
                )}
              >
                {content}
              </button>
            ) : (
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col border-t-2 pt-2.5 pb-1',
                  isCurrent
                    ? 'border-obsidian-950'
                    : isDone
                      ? 'border-ct-400'
                      : 'border-obsidian-200',
                )}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
