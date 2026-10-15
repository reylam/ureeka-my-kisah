import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { RadiographFigure } from '@/trace/components/visuals/RadiographFigure';
import { EmptyResultsState } from '@/trace/components/ui/EmptyResultsState';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';

/**
 * Explainability.
 *
 * The three-panel comparison layout is reserved and labelled, not filled. The
 * middle panel is where a Grad-CAM overlay would go; it holds an empty state
 * instead, because a hand-drawn blob presented as a model explanation is a
 * fabricated result — and it is the easiest kind of fabrication to get away
 * with, since nobody can check it against anything.
 */
export function Explainability() {
  return (
    <SectionBand id="explainability" tone="raised" labelledBy="xai-heading">
      <Container>
        <SectionHeading
          id="xai-heading"
          index="08"
          eyebrow="Explainability"
          title="Visual explanations require careful interpretation"
          standfirst="Gradient-based saliency can show which regions moved a prediction. It cannot show that the model is reasoning about disease."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <div className="space-y-5 text-[14.5px] leading-7 text-trace-muted">
            <p>
              Grad-CAM and related methods take the gradient of a class score with respect to a
              late convolutional feature map and project it back onto the image, producing a coarse
              heatmap of regions the score was sensitive to. For a convolutional classifier like the
              one specified in the methodology section, it is available essentially for free.
            </p>
            <p>
              Its genuine use in research is catching gross failures. A model that keys on a
              laterality marker, a burned-in timestamp, the image border, or the characteristic
              post-processing of one hospital's equipment will usually show it in a saliency map —
              and that discovery is worth more than the metric it invalidates.
            </p>
            <p>
              What it does not do is establish that the highlighted region is a lesion, or that the
              model used clinically meaningful features. Saliency maps have been shown to look
              convincing when produced from randomised weights, which means a plausible-looking
              heatmap is not evidence of anything on its own.
            </p>
            <SourceCitation sourceId="sanityChecks" />
            <SourceCitation sourceId="gradcam" />
          </div>

          <ResearchCallout label="What a saliency map is not" tone="caution">
            It is not a segmentation, not a measurement, and not a diagnosis. It does not say the
            model found a cavity in the right upper zone; it says the score was sensitive to that
            part of the image. Those are different statements, and an overlay presented to a
            clinician without that distinction attached invites the stronger reading every time.
          </ResearchCallout>
        </div>

        {/* Reserved three-panel comparison */}
        <div className="mt-12">
          <h3 className="text-[17px] font-medium text-trace-text">
            Comparison layout, reserved
          </h3>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-trace-muted">
            The structure a real explainability review would use. The middle panel stays empty until
            there are model weights to compute a map from.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="trace-label mb-2.5 text-trace-dim">01 · Original radiograph</p>
              <RadiographFigure
                variant="sample-a"
                metadata={[
                  { label: 'Source', value: 'Synthetic SVG' },
                  { label: 'Overlay', value: 'None' },
                ]}
                caption="The input, unmodified. A procedurally drawn radiograph stands in for a real one."
              />
            </div>

            <div>
              <p className="trace-label mb-2.5 text-trace-dim">02 · Model explanation overlay</p>
              <EmptyResultsState
                title="No model-generated saliency map"
                requirement="Trained weights, a chosen target layer, and the gradients of a real prediction on this exact image."
                className="h-full"
              >
                <p className="max-w-sm text-[12.5px] leading-5 text-trace-dim">
                  A hand-drawn heatmap would fill this panel convincingly and would be a fabricated
                  model explanation. The panel stays empty instead.
                </p>
              </EmptyResultsState>
            </div>

            <div>
              <p className="trace-label mb-2.5 text-trace-dim">
                03 · Research interpretation
              </p>
              <div className="h-full rounded-md border border-trace-line bg-trace-card p-5">
                <p className="text-[13.5px] leading-6 text-trace-muted">
                  Where a reviewer records what the map shows, whether the highlighted regions
                  overlap the annotated lesions, whether a radiologist agrees, and what the map
                  would have to look like to count as a red flag rather than a reassurance.
                </p>
                <ul className="mt-4 space-y-2 border-t border-trace-line-soft pt-4">
                  {[
                    'Region overlap with lesion annotations, where they exist',
                    'Independent radiologist agreement on a sampled subset',
                    'Sanity check against randomised model weights',
                    'Behaviour on images with markers or text burned in',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[12.5px] leading-5 text-trace-dim"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-[1px] border border-trace-line"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
