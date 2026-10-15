import { ArrowRight } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { SourceList } from '@/trace/components/ui/SourceCitation';
import { CONCLUSION_POINTS } from '@/trace/data/research';
import { SOURCE_LIST } from '@/trace/data/sources';

/**
 * Conclusion and reference list.
 *
 * The conclusion does not conclude anything about predictive performance,
 * because there is nothing to conclude from. What it does state is what would
 * change that, in order — which is the most useful thing a page in this state
 * can offer a reader.
 */
export function Conclusion() {
  return (
    <>
      <SectionBand id="conclusion" tone="raised" labelledBy="conclusion-heading">
        <Container>
          <SectionHeading
            id="conclusion-heading"
            index="10"
            eyebrow="Conclusion"
            title="What the evidence can support"
            standfirst="On predictive performance: nothing yet. That is a statement about this build, not a hedge."
          />

          <dl className="mt-10 grid gap-x-12 gap-y-7 lg:grid-cols-2">
            {CONCLUSION_POINTS.map((point) => (
              <div key={point.label} className="border-t border-trace-line pt-5">
                <dt className="text-[15.5px] font-medium text-trace-text">{point.label}</dt>
                <dd className="mt-2 text-[13.5px] leading-6 text-trace-muted">{point.body}</dd>
              </div>
            ))}
          </dl>

          <ResearchCallout label="The sentence to leave with" className="mt-12">
            A chest radiograph can raise the suspicion of tuberculosis. It cannot confirm it, and
            neither can a model that reads one. Whatever a future version of this system reports, the
            useful output is a reason to test somebody — never a conclusion about them.
          </ResearchCallout>

          <div className="mt-10 flex flex-wrap gap-3">
            <TraceLinkButton to="/demo">
              Open the Model Demo
              <ArrowRight aria-hidden className="size-4" />
            </TraceLinkButton>
            <TraceLinkButton to="/" variant="secondary">
              Back to the overview
            </TraceLinkButton>
          </div>
        </Container>
      </SectionBand>

      <SectionBand id="sources" labelledBy="sources-heading">
        <Container>
          <SectionHeading
            id="sources-heading"
            index="11"
            eyebrow="References"
            title="Documented sources"
            standfirst="Every external claim on this site points at one of these. There is no entry here for an evaluation of PULMO-TRACE, because none exists."
          />
          <SourceList sources={SOURCE_LIST} className="mt-10 max-w-3xl" />
        </Container>
      </SectionBand>
    </>
  );
}
