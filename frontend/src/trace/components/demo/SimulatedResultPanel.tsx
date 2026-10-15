import { ArrowUpRight, FlaskConical, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SelectedImage } from '@/trace/hooks/useImageUpload';
import { DEMO_THRESHOLD, RESULT_DISCLOSURES, type DemoScenario } from '@/trace/data/demoResults';
import { formatBytes } from '@/trace/lib/format';
import { cn } from '@/utils/cn';

/**
 * The result report.
 *
 * Several deliberate choices, each of which took an argument to settle:
 *
 *  - The header says SIMULATED MODEL OUTPUT — NOT A CLINICAL RESULT, in the
 *    panel itself rather than in a footnote, because screenshots get cropped.
 *  - "Pattern indicated" is amber and "not indicated" is grey. Neither is red
 *    and neither is green: those colours read as "sick" and "healthy", and a
 *    screening output means neither.
 *  - The score is drawn on a track with the threshold marked, so the reader
 *    sees a decision boundary rather than a percentage. It is labelled a
 *    simulated model score every time it appears.
 *  - The "not indicated" outcome gets the same amount of caveat as the other
 *    one. A negative screening result is the easier one to over-read.
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
      className={cn('overflow-hidden rounded-md border border-[#4a3b1c]', className)}
    >
      <h3
        id="result-heading"
        className="flex items-center gap-2 border-b border-[#4a3b1c] bg-trace-flag-surface px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#e0b76f]"
      >
        <FlaskConical aria-hidden className="size-3.5" />
        {RESULT_DISCLOSURES.panelLabel}
      </h3>

      <div className="bg-trace-card">
        {/* 1 — screening output */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Screening output</p>
          <p
            className={cn(
              'mt-2.5 text-[21px] leading-tight font-semibold tracking-[-0.02em]',
              indicated ? 'text-trace-flag' : 'text-trace-neutral',
            )}
          >
            {indicated ? 'TB-associated pattern indicated' : 'TB-associated pattern not indicated'}
          </p>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-trace-muted">
            {indicated
              ? 'In a real system this would mean: this image resembles those labelled TB-related in the model’s training data, and the person should be referred for confirmatory testing. It would not mean the person has tuberculosis.'
              : 'In a real system this would mean: this image does not resemble those labelled TB-related in the model’s training data. It would not mean the person is free of tuberculosis — chest radiography misses cases.'}
          </p>
        </div>

        {/* 2 — score */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="trace-label text-trace-dim">{RESULT_DISCLOSURES.scoreLabel}</p>
            <p className="font-mono text-[11px] text-trace-dim">
              threshold τ = {DEMO_THRESHOLD.toFixed(2)}
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
              className="absolute top-0 -translate-x-1/2 font-mono text-[9.5px] text-trace-accent"
              style={{ left: `${DEMO_THRESHOLD * 100}%` }}
            >
              τ
            </span>
          </div>

          <p className="mt-2 text-[12.5px] leading-5 text-trace-dim">
            {RESULT_DISCLOSURES.scoreCaution}
          </p>

          {nearThreshold ? (
            <p className="mt-3 rounded-md border border-[#2b445f] bg-trace-accent-surface px-3 py-2 text-[12.5px] leading-5 text-trace-accent-soft">
              This score sits within 0.08 of the threshold. Move the threshold slightly and the
              category flips while the image does not change.
            </p>
          ) : null}
        </div>

        {/* 3 + 4 — model status and input record */}
        <dl className="grid gap-x-6 gap-y-4 border-b border-trace-line px-4 py-5 sm:grid-cols-2 sm:px-5">
          <div className="sm:col-span-2">
            <dt className="trace-label text-trace-dim">Model status</dt>
            <dd className="mt-1.5 text-[13.5px] text-trace-muted">
              {RESULT_DISCLOSURES.modelStatus} The outcome shown was selected deterministically from
              this file’s name, size and modification time — so the same file always yields the same
              report, and the pixels play no part in it.
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="trace-label text-trace-dim">Input image</dt>
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

        {/* 5 — interpretation */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Interpretation</p>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
            {RESULT_DISCLOSURES.interpretation}
          </p>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
            {scenario.note}
          </p>
        </div>

        {/* 6 — limitations */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Limitations of a result like this</p>
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

        {/* 7 — next step */}
        <div className="px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Recommended next step</p>
          <p className="mt-2.5 flex gap-2.5 text-[13.5px] leading-6 text-trace-text">
            <Stethoscope aria-hidden className="mt-1 size-4 shrink-0 text-trace-accent" />
            <span>{RESULT_DISCLOSURES.nextStep}</span>
          </p>

          <Link
            to="/research#evaluation"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-trace-accent transition-colors hover:text-trace-accent-soft"
          >
            How a result like this would be evaluated
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
