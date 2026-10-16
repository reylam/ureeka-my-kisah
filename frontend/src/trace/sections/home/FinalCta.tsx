import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Mascot } from '@/trace/components/visuals/Mascot';
import { Reveal } from '@/trace/components/ui/Reveal';

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
      <Reveal className="relative">
        <Container className="relative py-20 text-center sm:py-24">
          <Mascot size="lg" className="mb-8" />
          <Eyebrow className="justify-center">Lihat sendiri</Eyebrow>
          <h2
            id="final-cta-heading"
            className="mx-auto mt-5 max-w-2xl text-[30px] leading-[1.12] font-semibold tracking-[-0.03em] sm:text-[40px]"
          >
            Coba sendiri, lalu tentukan pendapatmu.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-7 text-trace-muted">
            Demo ini memandu seluruh alur screening dengan hasil placeholder yang diberi label
            jelas. Butuh sekitar satu menit, dan apa pun yang kamu pilih tidak keluar dari
            perangkatmu.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <TraceLinkButton to="/demo">
              <Play aria-hidden className="size-4" />
              Buka demo screening
            </TraceLinkButton>
            <TraceLinkButton to="/how-it-works" variant="secondary">
              Cara kerja
              <ArrowRight aria-hidden className="size-4" />
            </TraceLinkButton>
          </div>
        </Container>
      </Reveal>
    </section>
  );
}
