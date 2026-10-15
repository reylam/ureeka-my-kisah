import { ArrowRight, BookOpen } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { InlineDisclaimer } from '@/trace/components/ui/DisclaimerBanner';
import { RadiographFigure } from '@/trace/components/visuals/RadiographFigure';

/**
 * Hero.
 *
 * Two columns: the claim on the left, an instrument on the right. The figure is
 * a synthetic radiograph in a measurement frame, and its overlay is labelled
 * "schematic annotation" because nothing has analysed it. That label is the
 * difference between a technical illustration and a fabricated detection.
 *
 * The one entrance animation is a CSS class (`.trace-rise`), not a motion
 * component: a single fade is not worth putting an animation library in the
 * first chunk the site loads, and the reduced-motion rule in the base layer
 * already neutralises CSS animations.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-trace-line">
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />

      <Container className="relative py-16 sm:py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="trace-rise">
            <Eyebrow>AI-assisted TB screening · Research prototype</Eyebrow>

            <h1 className="mt-5 max-w-xl text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[44px] lg:text-[52px]">
              Looking for TB patterns.
              <span className="block text-trace-muted">Understanding the evidence.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15.5px] leading-7 text-trace-muted">
              Explore a research prototype that examines chest X-ray images for patterns associated
              with pulmonary tuberculosis, alongside the methodology, evaluation and limitations
              behind its predictions.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <TraceLinkButton to="/demo">
                Explore Model Demo
                <ArrowRight aria-hidden className="size-4" />
              </TraceLinkButton>
              <TraceLinkButton to="/research" variant="secondary">
                <BookOpen aria-hidden className="size-4" />
                Read the Research
              </TraceLinkButton>
            </div>

            <InlineDisclaimer className="mt-8 max-w-md">
              Research and educational use only. Not for clinical diagnosis. No model is connected
              to this build.
            </InlineDisclaimer>
          </div>

          <RadiographFigure
            variant="sample-a"
            annotations={[
              { label: 'Z1 · upper zone', x: 0.33, y: 0.3, r: 0.1 },
              { label: 'Z2 · mid zone', x: 0.63, y: 0.42, r: 0.08 },
            ]}
            annotationLabel="Schematic annotation — not model output"
            metadata={[
              { label: 'Projection', value: 'Frontal (PA)' },
              { label: 'Source', value: 'Synthetic SVG' },
              { label: 'Model run', value: 'None' },
              { label: 'Regions', value: 'Hand-placed' },
            ]}
            caption="A procedurally drawn chest radiograph, used so that no real patient image is bundled in this prototype. The circled zones mark where upper- and mid-zone findings are conventionally described; they are not a detection, and no model has seen this image."
          />
        </div>
      </Container>
    </section>
  );
}
