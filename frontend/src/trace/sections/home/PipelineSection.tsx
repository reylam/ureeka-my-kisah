import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { PipelineDiagram } from '@/trace/components/research/PipelineDiagram';
import { SCREENING_PIPELINE } from '@/trace/data/research';

/**
 * The workflow, with the honest half shaded differently.
 *
 * Three of the six steps run in this prototype and two do not; the sixth is
 * prose. Rather than hide that, the diagram prints a status chip on every box.
 */
export function PipelineSection() {
  const implemented = SCREENING_PIPELINE.filter((s) => s.status === 'in-prototype').length;

  return (
    <SectionBand id="pipeline" tone="raised" labelledBy="pipeline-heading">
      <Container>
        <SectionHeading
          id="pipeline-heading"
          index="03"
          eyebrow="System pipeline"
          title="From chest X-ray to research output"
          standfirst={`Six steps between a file and a conclusion. ${implemented} of them exist in this build; the rest are specified and not implemented.`}
        />

        <div className="mt-10 rounded-md border border-trace-line bg-trace-card p-5 sm:p-7">
          <PipelineDiagram stages={SCREENING_PIPELINE} />
        </div>

        <p className="mt-5 max-w-3xl text-[13.5px] leading-6 text-trace-dim">
          The two planned steps are where a real system earns or loses its credibility.
          Preprocessing decides what the model sees; inference is the only step that could produce a
          prediction, and in this build it produces a placeholder instead. Everything downstream of
          those two steps is presentation, which is exactly the part this prototype is for.
        </p>
      </Container>
    </SectionBand>
  );
}
