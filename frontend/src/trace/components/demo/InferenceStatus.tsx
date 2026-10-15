import { AlertTriangle, Check, Circle, Loader2 } from 'lucide-react';
import { STAGES, type InferenceState } from '@/trace/hooks/useSimulatedInference';
import { cn } from '@/utils/cn';

/**
 * The run state, named.
 *
 * Six states are reachable and all six are labelled here: waiting for a file,
 * file selected, running, complete, failed, and reset. The middle stages are
 * phrased in the conditional ("would resize") because that work is not
 * happening, and a progress bar implying otherwise would be the single most
 * misleading element on the page.
 *
 * `aria-live="polite"` on the status line means a screen reader hears the
 * transitions instead of watching a bar it cannot see.
 */
export function InferenceStatus({
  state,
  hasImage,
  stageIndex,
  progress,
  errorMessage,
  className,
}: {
  state: InferenceState;
  hasImage: boolean;
  stageIndex: number;
  progress: number;
  errorMessage: string | null;
  className?: string;
}) {
  const display = resolveDisplay(state, hasImage);

  return (
    <div className={cn('rounded-md border border-trace-line bg-trace-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-trace-line px-4 py-3">
        <p className="trace-label text-trace-dim">Run state</p>
        <p
          aria-live="polite"
          className={cn(
            'inline-flex items-center gap-2 rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]',
            display.tone,
          )}
        >
          {display.spinning ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
          {display.label}
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13.5px] leading-6 text-trace-muted">{display.description}</p>

        {state === 'running' || state === 'done' ? (
          <>
            <div
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Simulated run progress"
              className="mt-4 h-1 w-full overflow-hidden rounded-full bg-trace-raised"
            >
              <div
                className="h-full rounded-full bg-trace-accent transition-[width] duration-300"
                style={{ width: `${Math.max(progress * 100, 4)}%` }}
              />
            </div>

            <ol className="mt-4 space-y-2.5">
              {STAGES.map((stage, index) => {
                const done = index < stageIndex || state === 'done';
                const active = index === stageIndex && state === 'running';
                return (
                  <li key={stage.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <Check aria-hidden className="size-3.5 text-trace-accent" />
                      ) : active ? (
                        <Loader2 aria-hidden className="size-3.5 animate-spin text-trace-accent" />
                      ) : (
                        <Circle aria-hidden className="size-3.5 text-trace-line" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[13px]',
                          done || active ? 'text-trace-text' : 'text-trace-dim',
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-5 text-trace-dim">
                        {stage.detail}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}

        {state === 'error' && errorMessage ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-trace-flag-edge bg-trace-flag-surface px-3.5 py-3 text-[13px] leading-5 text-trace-flag-soft"
          >
            <AlertTriangle aria-hidden className="mt-px size-4 shrink-0 text-trace-flag" />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function resolveDisplay(state: InferenceState, hasImage: boolean) {
  const neutral = 'border-trace-line bg-trace-raised text-trace-dim';
  const accent = 'border-trace-accent-edge bg-trace-accent-surface text-trace-accent-soft';
  const flag = 'border-trace-flag-edge bg-trace-flag-surface text-trace-flag-soft';

  if (state === 'error') {
    return {
      label: 'Failed',
      tone: flag,
      spinning: false,
      description: 'The run stopped. The selected image is still loaded, so you can try again.',
    };
  }
  if (state === 'running') {
    return {
      label: 'Working',
      tone: accent,
      spinning: true,
      description:
        'Walking through the steps a real screening tool would take. Nothing is examining the picture.',
    };
  }
  if (state === 'done') {
    return {
      label: 'Done',
      tone: accent,
      spinning: false,
      description:
        'The example result is below. It was picked from the file’s name and size, not worked out from the picture.',
    };
  }
  if (hasImage) {
    return {
      label: 'Image loaded',
      tone: accent,
      spinning: false,
      description: 'Your image is loaded and the button is ready. Nothing has been sent anywhere.',
    };
  }
  return {
    label: 'Ready',
    tone: neutral,
    spinning: false,
    description: 'Waiting for a chest X-ray. Drop a JPG or PNG file, or browse for one.',
  };
}
