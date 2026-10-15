import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { SourceCitation } from '@/trace/components/ui/SourceCitation';
import { GENERALIZATION_TOPICS } from '@/trace/data/research';

const COMPARISON = [
  {
    axis: 'Question asked',
    retrospective: 'Can the model separate labels on archived images?',
    deployment: 'Does a service using the model find more TB, and harm fewer people?',
  },
  {
    axis: 'Population',
    retrospective: 'Whoever happens to be in the dataset',
    deployment: 'Whoever walks through the door, at local prevalence',
  },
  {
    axis: 'Reference standard',
    retrospective: 'Dataset labels, of varying origin',
    deployment: 'Bacteriological confirmation, where it is reachable',
  },
  {
    axis: 'Failure visibility',
    retrospective: 'Visible in the metrics',
    deployment: 'Often invisible until someone is missed',
  },
  {
    axis: 'Threshold',
    retrospective: 'Tuned on held-out data',
    deployment: 'Must be recalibrated, then monitored as the population shifts',
  },
  {
    axis: 'What a good result licenses',
    retrospective: 'A reason to run a prospective study',
    deployment: 'Use in care, under governance, with audit',
  },
];

/**
 * Generalization and limitations.
 *
 * The table is the section. Retrospective evaluation and clinical deployment
 * get collapsed into one claim constantly — "95% accurate, ready for clinics" —
 * and setting the two side by side makes the gap between them structural
 * rather than rhetorical.
 */
export function Generalization() {
  return (
    <SectionBand id="limitations" labelledBy="general-heading">
      <Container>
        <SectionHeading
          id="general-heading"
          index="09"
          eyebrow="Generalization and limitations"
          title="Good benchmark performance is not enough"
          standfirst="Eight things that stand between a benchmark number and a tool that helps anyone."
        />

        <dl className="mt-10 grid gap-x-12 gap-y-7 lg:grid-cols-2">
          {GENERALIZATION_TOPICS.map((topic) => (
            <div key={topic.title} className="border-t border-trace-line pt-5">
              <dt className="text-[16px] font-medium text-trace-text">{topic.title}</dt>
              <dd className="mt-2 text-[13.5px] leading-6 text-trace-muted">
                {topic.body}
                {topic.sourceId ? (
                  <SourceCitation sourceId={topic.sourceId} className="mt-2.5" />
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-14">
          <h3 className="text-[18px] font-medium tracking-[-0.015em] text-trace-text">
            Retrospective evaluation is not clinical deployment
          </h3>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-trace-muted">
            These two activities are routinely reported as though a good result in the left column
            implied readiness for the right. It does not. The left column licenses one thing: a
            reason to attempt the right.
          </p>

          <div className="mt-5 overflow-hidden rounded-md border border-trace-line bg-trace-card">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="bg-trace-raised">
                    <th scope="col" className="trace-label px-4 py-2.5 font-normal text-trace-dim">
                      Axis
                    </th>
                    <th scope="col" className="trace-label px-4 py-2.5 font-normal text-trace-dim">
                      Retrospective research evaluation
                    </th>
                    <th scope="col" className="trace-label px-4 py-2.5 font-normal text-trace-dim">
                      Clinical deployment
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.axis} className="border-t border-trace-line-soft align-top">
                      <th
                        scope="row"
                        className="w-[22%] min-w-[140px] px-4 py-3 text-left font-medium text-trace-text"
                      >
                        {row.axis}
                      </th>
                      <td className="px-4 py-3 text-trace-muted">{row.retrospective}</td>
                      <td className="px-4 py-3 text-trace-muted">{row.deployment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Container>
    </SectionBand>
  );
}
