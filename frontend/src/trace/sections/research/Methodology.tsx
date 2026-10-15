import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { MethodChain } from '@/trace/components/research/PipelineDiagram';
import { FieldTable } from '@/trace/components/ui/DataTable';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import { METHOD_STAGES } from '@/trace/data/research';
import { MODEL_CONFIG } from '@/trace/data/evaluation';

/**
 * Methodology.
 *
 * Eight stages, with the output each one has to produce. The configuration
 * table beside it uses "Not yet specified" for undecided settings rather than
 * a plausible default — a config table that has been quietly filled in is
 * worse than an incomplete one, because it cannot be audited.
 */
export function Methodology() {
  return (
    <SectionBand id="methodology" tone="raised" labelledBy="method-heading">
      <Container>
        <SectionHeading
          id="method-heading"
          index="04"
          eyebrow="Methodology"
          title="From pixels to a screening output"
          standfirst="Eight stages. The order is not cosmetic: splitting before preprocessing, and validation before testing, are what keep the final number meaningful."
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <MethodChain stages={METHOD_STAGES} />

          <div className="space-y-5">
            <FieldTable
              rows={MODEL_CONFIG}
              caption="Illustrative model configuration — these are placeholder settings for a model that has not been trained. “Not yet specified” means undecided, not omitted."
            />

            <ResearchCallout label="The two stages that are easiest to get wrong" tone="caution">
              <strong>Validation and testing are not interchangeable.</strong> The validation split
              picks the checkpoint and sets the threshold; both of those decisions consume it. Score
              the model on that same split and the result is optimistic by an unknown amount. An
              independent test set is scored once, with everything frozen — and once it has been
              used to make a decision, it is a validation set.
            </ResearchCallout>

            <ResearchCallout label="Thresholds are a local decision" tone="quiet">
              WHO guidance on computer-aided detection for TB treats the operating threshold as
              something to calibrate against the population being screened, rather than a constant
              shipped with the software. A threshold tuned on one cohort does not transfer to
              another with different prevalence and a different cost of a missed case.
              <SourceCitation sourceId="whoCadToolkit" className="mt-3" />
            </ResearchCallout>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
