import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import { ResearchCallout } from '@/trace/components/ui/ResearchCallout';
import { CONTEXT_POINTS } from '@/trace/data/research';

/**
 * The clinical problem, before any technology.
 *
 * Written as an editorial column with numbered points and a citation under
 * each factual claim, rather than a grid of three icon cards. The constraint
 * that produced this layout: every epidemiological sentence here has to be
 * traceable to a WHO document, and a card grid has nowhere to put the link.
 */
export function ClinicalContext() {
  return (
    <SectionBand id="context" tone="raised" labelledBy="context-heading">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading
              id="context-heading"
              index="01"
              eyebrow="Clinical context"
              title="Why chest X-ray screening matters"
              standfirst="Five things that have to be true at once: the disease is widespread, imaging helps find it, imaging cannot confirm it, and the gap between those last two is where a screening tool either helps or does harm."
            />

            <ResearchCallout label="The distinction this site rests on" className="mt-8">
              <strong>Screening</strong> sorts a population into "test further" and "probably not
              now". <strong>Diagnosis</strong> concludes what is wrong with one person, and carries
              a treatment decision. A model that reads an image can participate in the first. It
              cannot perform the second.
            </ResearchCallout>
          </div>

          <ol className="space-y-8">
            {CONTEXT_POINTS.map((point, index) => (
              <li
                key={point.heading}
                className="border-l border-trace-line pl-5 sm:pl-6"
              >
                <p className="trace-label text-trace-dim">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-[17px] font-medium tracking-[-0.01em] text-trace-text">
                  {point.heading}
                </h3>
                <p className="mt-2.5 max-w-2xl text-[14.5px] leading-7 text-trace-muted">
                  {point.body}
                </p>
                {point.sourceId ? (
                  <SourceCitation sourceId={point.sourceId} className="mt-3" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </SectionBand>
  );
}
