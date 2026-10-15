import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { StepFlow } from '@/trace/components/ui/StepFlow';
import { STEPS } from '@/trace/data/content';

/** Four steps from an X-ray to a next step, with the unbuilt ones marked. */
export function HowItWorksSection() {
  return (
    <SectionBand id="how" labelledBy="how-heading">
      <Container>
        <SectionHeading
          id="how-heading"
          index="02"
          eyebrow="How it works"
          title="Four steps, from a picture to a decision"
          standfirst="Two of these four work in this prototype. The two in the middle, the ones that would need a trained model, do not yet."
        />

        <div className="mt-11 rounded-2xl border border-trace-line bg-trace-card p-6 sm:p-8">
          <StepFlow steps={STEPS} />
        </div>

        <Link
          to="/how-it-works"
          className="mt-8 inline-flex items-center gap-2 text-[14px] text-trace-accent transition-colors hover:text-trace-accent-soft"
        >
          Read the longer explanation
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Container>
    </SectionBand>
  );
}
