import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { RESEARCH_QUESTIONS } from '@/trace/data/research';

/**
 * The three questions in full, each with its measurable criteria.
 *
 * The criteria list is what separates a research question from an aspiration:
 * it says in advance what evidence would count as an answer, which makes it
 * possible to notice later that the evidence was never gathered.
 */
export function Questions() {
  return (
    <SectionBand id="questions" tone="raised" labelledBy="rq-heading">
      <Container>
        <SectionHeading
          id="rq-heading"
          index="02"
          eyebrow="Research questions"
          title="Three questions, and what would count as answering them"
          standfirst="Stated as hypotheses with evaluation criteria fixed in advance. None has been tested."
        />

        <div className="mt-12 space-y-12">
          {RESEARCH_QUESTIONS.map((question) => (
            <article
              key={question.id}
              id={question.id.toLowerCase()}
              className="scroll-mt-24 border-t border-trace-line pt-8"
            >
              <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
                <div>
                  <p className="flex items-baseline gap-3">
                    <span className="font-mono text-[22px] font-medium text-trace-accent">
                      {question.id}
                    </span>
                    <span className="trace-label text-trace-dim">{question.shortLabel}</span>
                  </p>
                  <h3 className="mt-4 text-[20px] leading-snug font-medium tracking-[-0.015em] text-trace-text">
                    {question.title}
                  </h3>
                  <p className="mt-4 inline-flex rounded border border-trace-line bg-trace-card px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-trace-dim">
                    Status · open
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="trace-label text-trace-dim">Question</p>
                    <p className="mt-2 text-[14.5px] leading-7 text-trace-muted">
                      {question.question}
                    </p>
                  </div>

                  <div>
                    <p className="trace-label text-trace-dim">Hypothesis</p>
                    <p className="mt-2 text-[14.5px] leading-7 text-trace-muted">
                      {question.hypothesis}
                    </p>
                  </div>

                  <div>
                    <p className="trace-label text-trace-dim">
                      Evaluation criteria · fixed in advance
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {question.criteria.map((criterion) => (
                        <li
                          key={criterion}
                          className="flex gap-3 text-[13.5px] leading-6 text-trace-muted"
                        >
                          <span
                            aria-hidden
                            className="mt-2.5 size-1.5 shrink-0 rounded-[1px] border border-trace-accent"
                          />
                          {criterion}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-l-2 border-trace-flag pl-4">
                    <p className="trace-label text-trace-flag">Where this stands</p>
                    <p className="mt-2 text-[13.5px] leading-6 text-trace-muted">
                      {question.state}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </SectionBand>
  );
}
