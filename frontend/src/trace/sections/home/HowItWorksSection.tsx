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
          eyebrow="Cara kerja"
          title="Empat langkah, dari gambar sampai keputusan"
          standfirst="Dua dari empat langkah ini sudah berfungsi di prototipe. Dua langkah di tengah, yang butuh model terlatih, belum."
        />

        <div className="mt-11 rounded-2xl border border-trace-line bg-trace-card p-6 sm:p-8">
          <StepFlow steps={STEPS} />
        </div>

        <Link
          to="/how-it-works"
          className="mt-8 inline-flex items-center gap-2 text-[14px] text-trace-accent transition-colors hover:text-trace-accent-soft"
        >
          Baca penjelasan lengkapnya
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Container>
    </SectionBand>
  );
}
