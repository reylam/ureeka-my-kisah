import { cn } from '@/utils/cn';

/**
 * The four-step walkthrough.
 *
 * Every step carries a short note saying whether it exists in this build. A
 * note that starts with "Belum dibuat" draws the step as unbuilt; a flow chart
 * that draws built and unbuilt steps in identical boxes is a quiet claim that
 * everything works.
 *
 * On a wide screen the steps sit in a row joined by a hairline; on a narrow
 * one they stack with the line running down the left, rather than becoming a
 * squeezed version of the row.
 */
export function StepFlow({
  steps,
  className,
}: {
  steps: { id: string; label: string; body: string; note: string }[];
  className?: string;
}) {
  return (
    <ol className={cn('grid gap-5 lg:grid-cols-4 lg:gap-6', className)}>
      {steps.map((step, index) => {
        const built = !step.note.toLowerCase().startsWith('belum dibuat');
        return (
          <li key={step.id} className="relative flex gap-4 lg:block">
            {/* Marker and connector */}
            <div className="flex w-7 shrink-0 flex-col items-center lg:w-auto lg:flex-row">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px]',
                  built
                    ? 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft'
                    : 'border-trace-line bg-trace-card text-trace-dim',
                )}
              >
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <>
                  <span className="mt-1 w-px flex-1 bg-trace-line lg:hidden" />
                  <span className="ml-3 hidden h-px flex-1 bg-trace-line lg:block" />
                </>
              ) : null}
            </div>

            <div className="min-w-0 pb-2 lg:mt-5 lg:pr-5 lg:pb-0">
              <h3 className="text-[16px] leading-snug font-medium text-trace-text">
                {step.label}
              </h3>
              <p className="mt-2 text-[13.5px] leading-6 text-trace-muted">{step.body}</p>
              <p
                className={cn(
                  'mt-3 text-[12.5px] leading-5',
                  built ? 'text-trace-dim' : 'text-trace-flag',
                )}
              >
                {step.note}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
