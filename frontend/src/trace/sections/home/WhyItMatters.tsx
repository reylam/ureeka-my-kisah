import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import { Callout } from '@/trace/components/ui/Callout';
import { BURDEN_FACTS, WHY_POINTS } from '@/trace/data/content';

/**
 * Why any of this matters, in plain terms.
 *
 * Three figures, then three short paragraphs, each with its WHO source
 * underneath. Nothing here is our own measurement, and the citations are what
 * make that visible without a paragraph of hedging.
 */
export function WhyItMatters() {
  return (
    <SectionBand id="why" tone="raised" labelledBy="why-heading">
      <Container>
        <SectionHeading
          id="why-heading"
          index="01"
          eyebrow="The problem"
          title="A curable disease that still kills, mostly because it is not found"
          standfirst="Tuberculosis is treatable. The reason it remains one of the world’s deadliest infections is that millions of people with it are never diagnosed."
        />

        {/* Three figures */}
        <dl className="mt-11 grid gap-px overflow-hidden rounded-2xl border border-trace-line bg-trace-line sm:grid-cols-3">
          {BURDEN_FACTS.map((fact) => (
            <div key={fact.figure} className="bg-trace-card p-6">
              <dt>
                <span className="block text-[34px] leading-none font-semibold tracking-[-0.03em] text-trace-accent-soft">
                  {fact.figure}
                </span>
                <span className="trace-label mt-2.5 block text-trace-dim">{fact.unit}</span>
              </dt>
              <dd className="mt-4 text-[13.5px] leading-6 text-trace-muted">{fact.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-trace-dim">
          Figures for 2024, from the World Health Organization. Full sources are listed at the
          bottom of this page.
        </p>

        {/* Three paragraphs */}
        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <ol className="space-y-9">
            {WHY_POINTS.map((point, index) => (
              <li key={point.title} className="border-l border-trace-line pl-5 sm:pl-6">
                <p className="trace-label text-trace-dim">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2.5 text-[18px] leading-snug font-medium tracking-[-0.01em] text-trace-text">
                  {point.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-7 text-trace-muted">{point.body}</p>
                {point.sourceId ? (
                  <SourceCitation sourceId={point.sourceId} className="mt-3" />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="lg:pt-4">
            <Callout label="The distinction everything here rests on">
              <strong>Screening</strong> sorts people into “worth testing” and “probably not right
              now”. <strong>Diagnosis</strong> works out what is actually wrong with one person,
              and comes with a treatment decision and someone accountable for it. Software that
              reads a picture can help with the first. It cannot do the second.
            </Callout>

            <Callout label="So what would this be for?" tone="quiet" className="mt-8">
              A tool like this would sit at the very front of the queue, helping decide whose X-ray
              a clinician should look at first and who should be sent for the lab test that
              actually confirms tuberculosis. It would never be the last word on anybody.
            </Callout>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
