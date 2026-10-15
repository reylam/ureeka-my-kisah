import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { LIMITATION_SUMMARY } from '@/trace/data/research';

/**
 * Limitations, placed before the final call to action rather than in a footnote.
 *
 * Two columns of short paragraphs with a hairline between them: dense enough
 * that a reader takes in all six, and plain enough that none reads as a
 * disclaimer being performed.
 */
export function Limitations() {
  return (
    <SectionBand id="limitations" tone="raised" labelledBy="limitations-heading">
      <Container>
        <SectionHeading
          id="limitations-heading"
          index="05"
          eyebrow="Limitations"
          title="Useful research starts with clear limitations"
          standfirst="Not a legal footnote. These are the specific reasons a chest X-ray screening model can look good in a notebook and fail in a clinic."
        />

        <dl className="mt-10 grid gap-x-12 gap-y-7 sm:grid-cols-2">
          {LIMITATION_SUMMARY.map((item) => (
            <div key={item.title} className="border-t border-trace-line pt-5">
              <dt className="text-[15px] font-medium text-trace-text">{item.title}</dt>
              <dd className="mt-2 text-[13.5px] leading-6 text-trace-muted">{item.body}</dd>
            </div>
          ))}
        </dl>

        <Link
          to="/research#limitations"
          className="mt-9 inline-flex items-center gap-1.5 text-[13.5px] text-trace-accent transition-colors hover:text-trace-accent-soft"
        >
          Read the full limitations and generalization analysis
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </Container>
    </SectionBand>
  );
}
