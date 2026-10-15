import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { DataTable, type Column } from '@/trace/components/ui/DataTable';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { ProvenanceNote } from '@/trace/components/ui/ProvenanceBadge';
import { METRIC_DEFINITIONS } from '@/trace/data/research';
import { THRESHOLD_SWEEP } from '@/trace/data/evaluation';

type SweepRow = (typeof THRESHOLD_SWEEP)[number];

const SWEEP_COLUMNS: Column<SweepRow>[] = [
  {
    key: 'threshold',
    header: 'τ',
    numeric: true,
    render: (row) => (
      <span className={row.note ? 'text-trace-accent-soft' : undefined}>
        {row.threshold.toFixed(2)}
      </span>
    ),
  },
  { key: 'sens', header: 'Sensitivity', numeric: true, render: (row) => row.sensitivity.toFixed(3) },
  { key: 'spec', header: 'Specificity', numeric: true, render: (row) => row.specificity.toFixed(3) },
  { key: 'prec', header: 'Precision', numeric: true, render: (row) => row.precision.toFixed(3) },
  { key: 'f1', header: 'F1', numeric: true, render: (row) => row.f1.toFixed(3) },
  { key: 'flagged', header: 'Flagged', numeric: true, render: (row) => row.flagged },
  { key: 'missed', header: 'Missed', numeric: true, render: (row) => row.missed },
  {
    key: 'note',
    header: '',
    render: (row) =>
      row.note ? (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-trace-accent-soft">
          {row.note}
        </span>
      ) : null,
  },
];

/**
 * Evaluation framework.
 *
 * The glossary explains each metric in plain language, gives its formula, and
 * states what it hides. The threshold sweep underneath is the section's real
 * argument: one model, one test set, five thresholds, wildly different
 * headline numbers. Anybody quoting a single sensitivity is quoting one row.
 */
export function EvaluationFramework() {
  return (
    <SectionBand id="evaluation" labelledBy="eval-heading">
      <Container>
        <SectionHeading
          id="eval-heading"
          index="05"
          eyebrow="Evaluation framework"
          title="Measure performance from multiple perspectives"
          standfirst="Each of these answers a different question. Reporting one and omitting the rest is how a weak model is made to look strong."
        />

        <dl className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
          {METRIC_DEFINITIONS.map((metric) => (
            <div key={metric.name} className="border-t border-trace-line pt-5">
              <dt className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[16px] font-medium text-trace-text">{metric.name}</span>
                <code className="rounded border border-trace-line bg-trace-raised px-2 py-0.5 font-mono text-[11.5px] text-trace-accent-soft">
                  {metric.formula}
                </code>
              </dt>
              <dd className="mt-3">
                <p className="text-[13.5px] leading-6 text-trace-muted">{metric.plain}</p>
                <p className="mt-2.5 flex gap-2 text-[12.5px] leading-5 text-trace-dim">
                  <span className="trace-label shrink-0 text-trace-flag">Caveat</span>
                  <span>{metric.caution}</span>
                </p>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-14">
          <h3 className="text-[18px] font-medium tracking-[-0.015em] text-trace-text">
            One model, five thresholds
          </h3>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-trace-muted">
            The same imagined model, scored on the same 720 images. Only the decision threshold
            changes between rows. Sensitivity runs from 0.97 to 0.33 and precision from 0.27 to
            0.78, which is why a sensitivity quoted without its threshold is not a result.
          </p>

          <DataTable
            className="mt-5"
            columns={SWEEP_COLUMNS}
            rows={[...THRESHOLD_SWEEP]}
            rowKey={(row) => String(row.threshold)}
            highlight={(row) => Boolean(row.note)}
            caption="Illustrative threshold sweep. “Flagged” is the number of the 720 images sent for confirmatory testing; “missed” is the number of 126 TB-labelled images not flagged."
          />

          <ProvenanceNote provenance="illustrative" className="mt-3">
            Mock data, internally consistent with the confusion matrix and curves in the next
            section.
          </ProvenanceNote>
        </div>

        <ResearchCallout label="Accuracy is not usefulness" tone="caution" className="mt-12">
          A model that flags nothing at all scores 82.5% accuracy on this split, because 594 of the
          720 images are non-TB. It would also miss every case of tuberculosis. High accuracy on an
          imbalanced dataset is not evidence of clinical value, and on its own it is barely evidence
          of anything.
        </ResearchCallout>
      </Container>
    </SectionBand>
  );
}
