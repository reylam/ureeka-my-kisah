import { ArrowRight, BookOpen } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';

/** Closing call to action. One line, two destinations, no persuasion. */
export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden border-t border-trace-line"
    >
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
      <Container className="relative py-20 text-center sm:py-24">
        <Eyebrow className="justify-center">Next</Eyebrow>
        <h2
          id="final-cta-heading"
          className="mx-auto mt-5 max-w-2xl text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[38px]"
        >
          Inspect the model. Examine the evidence.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-trace-muted">
          The demo shows what a screening output should look like and what it cannot establish. The
          research page shows the method, the evaluation framework, and everything still missing
          from it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <TraceLinkButton to="/demo">
            Open Model Demo
            <ArrowRight aria-hidden className="size-4" />
          </TraceLinkButton>
          <TraceLinkButton to="/research" variant="secondary">
            <BookOpen aria-hidden className="size-4" />
            Read Research
          </TraceLinkButton>
        </div>
      </Container>
    </section>
  );
}
