import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { ConfusionMatrix } from '@/trace/components/research/ConfusionMatrix';
import { EmptyResultsState } from '@/trace/components/ui/EmptyResultsState';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { FAILURE_MODES } from '@/trace/data/research';
import { CONFUSION, EVAL_SPLIT } from '@/trace/data/evaluation';

/**
 * Error analysis.
 *
 * Each failure mode is paired with its cost to a person, not just its effect
 * on a metric. "False negative: a person with TB is told nothing was found" is
 * the sentence that makes the row mean something.
 *
 * The case-study slot is left explicitly empty. Writing a plausible-sounding
 * patient case would be fabricating clinical material, which is not a thing to
 * do for a presentation.
 */
export function ErrorAnalysis() {
  return (
    <SectionBand id="errors" labelledBy="errors-heading">
      <Container>
        <SectionHeading
          id="errors-heading"
          index="07"
          eyebrow="Error analysis"
          title="Where can the model fail?"
          standfirst="Seven failure modes, each with the consequence it carries. Three of them produce metrics that look fine while the model is broken."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <ol className="space-y-6">
            {FAILURE_MODES.map((mode, index) => (
              <li key={mode.title} className="border-t border-trace-line pt-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] text-trace-dim">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[16px] font-medium text-trace-text">{mode.title}</h3>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-2 text-[12.5px] leading-5 text-trace-flag">
                  <span className="trace-label text-trace-dim">Cost</span>
                  {mode.cost}
                </p>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-trace-muted">
                  {mode.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <ConfusionMatrix
              data={CONFUSION}
              thresholdLabel={`Simulated counts at τ = ${EVAL_SPLIT.threshold}`}
            />

            <ResearchCallout label="Reading the two error cells" tone="caution">
              <strong>13 missed</strong> and <strong>184 false alarms</strong> are not
              interchangeable. The 13 are people who leave with a negative screen and an untreated
              infection. The 184 are people sent for a test they did not need — a real cost in
              travel, time and anxiety, but a recoverable one. Where the threshold sits is a
              judgement about which of those costs the programme can carry, and it is not a
              judgement a model can make.
            </ResearchCallout>

            <EmptyResultsState
              title="Failure case studies"
              requirement="Misclassified images from a real evaluation run, reviewed with a clinician, published with consent and de-identification."
              compact
            >
              <p className="max-w-md text-[12.5px] leading-5 text-trace-dim">
                Reserved deliberately. A plausible-sounding patient case written for a slide is
                fabricated clinical material, and this section would rather be empty than contain
                one.
              </p>
            </EmptyResultsState>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
