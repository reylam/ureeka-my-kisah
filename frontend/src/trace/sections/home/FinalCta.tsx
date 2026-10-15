import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Mascot } from '@/trace/components/visuals/Mascot';

/**
 * Closing call to action. One line, two destinations, no persuasion.
 *
 * The mascot appears here rather than in the hero: the hero already has the
 * radiograph figure carrying it, and two large images competing at the top of
 * the page would weaken both.
 */
export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden border-t border-trace-line"
    >
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
      <Container className="relative py-20 text-center sm:py-24">
        <Mascot size="lg" className="mb-8" />
        <Eyebrow className="justify-center">Have a look</Eyebrow>
        <h2
          id="final-cta-heading"
          className="mx-auto mt-5 max-w-2xl text-[30px] leading-[1.12] font-semibold tracking-[-0.03em] sm:text-[40px]"
        >
          Try it yourself, then decide what you think.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-7 text-trace-muted">
          The demo walks through the whole screening flow with a clearly labelled stand-in result.
          It takes about a minute, and nothing you choose leaves your device.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <TraceLinkButton to="/demo">
            <Play aria-hidden className="size-4" />
            Open the screening demo
          </TraceLinkButton>
          <TraceLinkButton to="/how-it-works" variant="secondary">
            How it works
            <ArrowRight aria-hidden className="size-4" />
          </TraceLinkButton>
        </div>
      </Container>
    </section>
  );
}
