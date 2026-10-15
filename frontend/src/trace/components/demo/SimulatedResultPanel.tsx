import { ArrowUpRight, FlaskConical, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SelectedImage } from '@/trace/hooks/useImageUpload';
import { DEMO_THRESHOLD, RESULT_DISCLOSURES, type DemoScenario } from '@/trace/data/demoResults';
import { formatBytes } from '@/trace/lib/format';
import { cn } from '@/utils/cn';

/**
 * The result report.
 *
 * Four deliberate choices:
 *
 *  - "Example result, not a medical finding" is printed inside the panel
 *    rather than in a footnote, because screenshots get cropped.
 *  - "Flagged" is amber and "nothing stood out" is grey. Neither is red and
 *    neither is green: those colours read as "sick" and "healthy", and a
 *    screening result means neither.
 *  - The score sits on a track with the cut-off marked, so a reader sees a
 *    line being crossed rather than a percentage.
 *  - The "nothing stood out" outcome carries just as much caveat as the other
 *    one. A reassuring result is the easier one to over-read.
 */
export function SimulatedResultPanel({
  scenario,
  image,
  className,
}: {
  scenario: DemoScenario;
  image: SelectedImage;
  className?: string;
}) {
  const indicated = scenario.score >= DEMO_THRESHOLD;
  const nearThreshold = Math.abs(scenario.score - DEMO_THRESHOLD) < 0.08;

  return (
    <section
      aria-labelledby="result-heading"
      className={cn('overflow-hidden rounded-md border border-trace-flag-edge', className)}
    >
      <h3
        id="result-heading"
        className="flex items-center gap-2 border-b border-trace-flag-edge bg-trace-flag-surface px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-trace-flag-soft"
      >
        <FlaskConical aria-hidden className="size-3.5" />
        {RESULT_DISCLOSURES.panelLabel}
      </h3>

      <div className="bg-trace-card">
        {/* 1. Screening output */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">The result</p>
          <p
            className={cn(
              'mt-2.5 text-[23px] leading-tight font-semibold tracking-[-0.02em]',
              indicated ? 'text-trace-flag' : 'text-trace-neutral',
            )}
          >
            {indicated ? 'Flagged for a closer look' : 'Nothing stood out'}
          </p>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-trace-muted">
            {indicated
              ? 'In a working system this would mean: this picture resembles the ones the software learned to flag, so somebody should look at it and the person should be sent for a test. It would not mean they have tuberculosis.'
              : 'In a working system this would mean: nothing in this picture resembled the patterns the software learned to flag. It would not mean the person is free of tuberculosis, because chest X-rays do miss cases.'}
          </p>
        </div>

        {/* 2. Score */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="trace-label text-trace-dim">{RESULT_DISCLOSURES.scoreLabel}</p>
            <p className="font-mono text-[11px] text-trace-dim">
              cut-off {DEMO_THRESHOLD.toFixed(2)}
            </p>
          </div>

          <p className="mt-2 font-mono text-[30px] leading-none tabular-nums text-trace-text">
            {scenario.score.toFixed(2)}
            <span className="ml-1.5 text-[14px] text-trace-dim">/ 1.00</span>
          </p>

          {/* Score track with the decision boundary marked */}
          <div className="relative mt-4 h-7" aria-hidden>
            <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-trace-raised" />
            <div
              className={cn(
                'absolute top-3 left-0 h-1 rounded-full',
                indicated ? 'bg-trace-flag' : 'bg-trace-neutral',
              )}
              style={{ width: `${scenario.score * 100}%` }}
            />
            <div
              className="absolute top-0 h-7 w-px bg-trace-accent"
              style={{ left: `${DEMO_THRESHOLD * 100}%` }}
            />
            <span
              className="absolute top-0 -translate-x-1/2 font-mono text-[9px] whitespace-nowrap text-trace-accent"
              style={{ left: `${DEMO_THRESHOLD * 100}%` }}
            >
              cut-off
            </span>
          </div>

          <p className="mt-2 text-[12.5px] leading-5 text-trace-dim">
            {RESULT_DISCLOSURES.scoreCaution}
          </p>

          {nearThreshold ? (
            <p className="mt-3 rounded-xl border border-trace-accent-edge bg-trace-accent-surface px-3.5 py-2.5 text-[12.5px] leading-5 text-trace-accent-soft">
              This score sits right on the line. Nudge the cut-off a little and the answer flips,
              while the picture itself has not changed at all.
            </p>
          ) : null}
        </div>

        {/* 3 and 4. Model status and input record */}
        <dl className="grid gap-x-6 gap-y-4 border-b border-trace-line px-4 py-5 sm:grid-cols-2 sm:px-5">
          <div className="sm:col-span-2">
            <dt className="trace-label text-trace-dim">Where this answer came from</dt>
            <dd className="mt-1.5 text-[13.5px] leading-6 text-trace-muted">
              {RESULT_DISCLOSURES.modelStatus} The outcome above was picked from the file’s name,
              size and date, so the same file always gives the same answer and the picture itself
              played no part in it.
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="trace-label text-trace-dim">Your file</dt>
            <dd
              title={image.file.name}
              className="mt-1.5 truncate font-mono text-[11.5px] text-trace-muted"
            >
              {image.file.name}
            </dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Properties</dt>
            <dd className="mt-1.5 font-mono text-[11.5px] text-trace-muted">
              {image.width} × {image.height} px · {formatBytes(image.file.size)}
            </dd>
          </div>
        </dl>

        {/* 5. Interpretation */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">What to make of it</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
            {RESULT_DISCLOSURES.interpretation}
          </p>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
            {scenario.note}
          </p>
        </div>

        {/* 6. Limitations */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Where a result like this falls short</p>
          <ul className="mt-3 space-y-2">
            {RESULT_DISCLOSURES.limitations.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-[13px] leading-6 text-trace-muted"
              >
                <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-trace-dim" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 7. Next step */}
        <div className="px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">What to do next</p>
          <p className="mt-2.5 flex gap-2.5 text-[13.5px] leading-6 text-trace-text">
            <Stethoscope aria-hidden className="mt-1 size-4 shrink-0 text-trace-accent" />
            <span>{RESULT_DISCLOSURES.nextStep}</span>
          </p>

          <Link
            to="/how-it-works"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-trace-accent transition-colors hover:text-trace-accent-soft"
          >
            Why a score is not a chance of being ill
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
