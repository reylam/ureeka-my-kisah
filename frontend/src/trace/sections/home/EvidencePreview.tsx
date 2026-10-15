import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { MetricRow } from '@/trace/components/ui/MetricCard';
import { ProvenanceNote } from '@/trace/components/ui/ProvenanceBadge';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { EmptyResultsState } from '@/trace/components/ui/EmptyResultsState';
import {
  EVAL_SPLIT,
  HOME_METRIC_PREVIEW,
  MISSING_ANALYSES,
  PREVALENCE_EXAMPLE,
} from '@/trace/data/evaluation';

/**
 * Evidence preview.
 *
 * Shows four mock metrics and then immediately undercuts the instinct to read
 * them as a score, with the prevalence table. The same sensitivity and
 * specificity produce a PPV of 0.38 on this imagined split and 0.014 in a
 * community screening queue, and that gap is the most useful thing on the
 * homepage.
 */
export function EvidencePreview() {
  return (
    <SectionBand id="evidence" labelledBy="evidence-heading">
      <Container>
        <SectionHeading
          id="evidence-heading"
          index="04"
          eyebrow="Evaluation"
          title="Evaluate the model beyond accuracy"
          standfirst="Accuracy is the least informative number a screening model produces. These are the dimensions that decide whether it helps."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* Metric preview */}
          <div className="rounded-md border border-trace-line bg-trace-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-[15px] font-medium text-trace-text">
                Metric summary, demo values
              </h3>
              <p className="font-mono text-[11px] text-trace-dim">τ = {EVAL_SPLIT.threshold}</p>
            </div>

            <div className="mt-3">
              {HOME_METRIC_PREVIEW.map((metric) => (
                <MetricRow key={metric.key} metric={metric} />
              ))}
            </div>

            <ProvenanceNote provenance="illustrative" className="mt-4">
              Demo values. No model has been trained or measured for this build — these numbers
              exist to show the reporting format.
            </ProvenanceNote>

            <Link
              to="/research#results"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-trace-accent transition-colors hover:text-trace-accent-soft"
            >
              Full results dashboard
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>

          {/* Prevalence worked example */}
          <div className="rounded-md border border-trace-line bg-trace-card p-5">
            <h3 className="text-[15px] font-medium text-trace-text">
              Why the same model behaves differently in different places
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-trace-muted">
              Holding sensitivity at 0.897 and specificity at 0.690, per 10 000 people screened:
            </p>

            <table className="mt-4 w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-trace-line">
                  <th scope="col" className="trace-label py-2 font-normal text-trace-dim">
                    Setting
                  </th>
                  <th scope="col" className="trace-label py-2 text-right font-normal text-trace-dim">
                    TB prevalence
                  </th>
                  <th scope="col" className="trace-label py-2 text-right font-normal text-trace-dim">
                    Flagged, no TB
                  </th>
                  <th scope="col" className="trace-label py-2 text-right font-normal text-trace-dim">
                    PPV
                  </th>
                </tr>
              </thead>
              <tbody>
                {PREVALENCE_EXAMPLE.map((row) => (
                  <tr key={row.setting} className="border-b border-trace-line-soft last:border-0">
                    <td className="py-2.5 pr-3 text-trace-muted">{row.setting}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-trace-muted">
                      {row.prevalence}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-trace-text">
                      {row.falsePositives.toLocaleString('en-GB')}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-trace-accent-soft">
                      {row.ppv}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ProvenanceNote provenance="illustrative" className="mt-4">
              Arithmetic on the demo values above. The model does not change between these rows —
              only the population does.
            </ProvenanceNote>
          </div>
        </div>

        <ResearchCallout label="What a complete evaluation reports" tone="quiet" className="mt-10">
          Sensitivity and specificity at a stated threshold · precision and F1 · ROC-AUC ·
          the raw confusion matrix · calibration, where the scores support it · and performance per
          subgroup, wherever the labels permit it. Any one of these alone is a partial answer.
        </ResearchCallout>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MISSING_ANALYSES.slice(0, 3).map((item) => (
            <EmptyResultsState
              key={item.title}
              title={item.title}
              requirement={item.requirement}
              compact
            />
          ))}
        </div>
      </Container>
    </SectionBand>
  );
}
