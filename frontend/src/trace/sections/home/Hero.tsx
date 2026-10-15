import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { RadiographFigure } from '@/trace/components/visuals/RadiographFigure';

/**
 * Hero.
 *
 * Two columns: the claim on the left, an instrument on the right. The figure
 * is a drawn chest X-ray, and its overlay is labelled as a hand-drawn marking
 * because nothing has analysed it. That label is the difference between a
 * technical illustration and a fabricated detection.
 *
 * The one entrance animation is a CSS class, not a motion component. A single
 * fade is not worth putting an animation library in the first chunk the site
 * loads, and the reduced-motion rule in the base layer already switches CSS
 * animation off for anyone who asked for that.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-trace-line">
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />

      <Container className="relative py-16 sm:py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="trace-rise">
            <Eyebrow>AI-assisted TB screening · Research prototype</Eyebrow>

            <h1 className="mt-5 max-w-xl text-[36px] leading-[1.06] font-semibold tracking-[-0.03em] sm:text-[46px] lg:text-[54px]">
              See beyond
              <br />
              the scan.
            </h1>

            <p className="mt-6 max-w-lg text-[16px] leading-7 text-trace-muted">
              Tuberculosis often shows on a chest X-ray before anyone is sure about it.
              PULMO-TRACE explores how software could help flag those signs earlier, and it is
              built to be straight with you about what a result does and does not mean.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <TraceLinkButton to="/demo">
                <Play aria-hidden className="size-4" />
                Try the screening demo
              </TraceLinkButton>
              <TraceLinkButton to="/how-it-works" variant="secondary">
                How it works
                <ArrowRight aria-hidden className="size-4" />
              </TraceLinkButton>
            </div>

          </div>

          <RadiographFigure
            variant="sample-a"
            annotations={[
              { label: 'upper zone', x: 0.33, y: 0.3, r: 0.1 },
              { label: 'mid zone', x: 0.63, y: 0.42, r: 0.08 },
            ]}
            annotationLabel="Drawn by hand, not by a model"
            metadata={[
              { label: 'View', value: 'Front-facing' },
              { label: 'Image', value: 'Illustration' },
              { label: 'Analysed', value: 'No' },
            ]}
            caption="A chest X-ray drawn in code, so that no real patient’s image is used as decoration. The circles mark the areas doctors usually describe. Nothing has examined this picture."
          />
        </div>
      </Container>
    </section>
  );
}
