import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import { RESEARCH_QUESTIONS } from '@/trace/data/research';

/**
 * The three research questions, as questions.
 *
 * Each block states the question, the hypothesis, and where the question
 * currently stands — which on this build is "open" in all three cases. The
 * state line is the point of the section: a hypothesis presented without it
 * reads like a finding within about two seconds.
 */
export function ResearchQuestions() {
  return (
    <SectionBand id="questions" labelledBy="questions-heading">
      <Container>
        <SectionHeading
          id="questions-heading"
          index="02"
          eyebrow="Research questions"
          title="What can an image-based model actually tell us?"
          standfirst="Three questions, in the order they have to be answered. None of them has been answered here."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {RESEARCH_QUESTIONS.map((question) => (
            <article
              key={question.id}
              className="flex flex-col rounded-md border border-trace-line bg-trace-card p-5"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-[13px] font-medium text-trace-accent">
                  {question.id}
                </span>
                <span className="trace-label text-trace-dim">{question.shortLabel}</span>
              </div>

              <h3 className="mt-3 text-[16.5px] leading-snug font-medium text-trace-text">
                {question.title}
              </h3>

              <p className="mt-3 text-[13.5px] leading-6 text-trace-muted">{question.question}</p>

              <dl className="mt-5 space-y-3 border-t border-trace-line-soft pt-4">
                <div>
                  <dt className="trace-label text-trace-dim">Hypothesis</dt>
                  <dd className="mt-1.5 text-[13px] leading-6 text-trace-muted">
                    {question.hypothesis}
                  </dd>
                </div>
                <div>
                  <dt className="trace-label text-trace-dim">Current state</dt>
                  <dd className="mt-1.5 text-[13px] leading-6 text-trace-muted">
                    {question.state}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/research#${question.id.toLowerCase()}`}
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-trace-accent transition-colors hover:text-trace-accent-soft"
              >
                Evaluation criteria
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            </article>
          ))}
        </div>

        <DisclaimerBanner
          tone="info"
          title="These are questions, not findings."
          className="mt-6"
          compact
        >
          A hypothesis is a statement we intend to test. Nothing on this page reports that any of
          the three has been tested, confirmed or refuted.
        </DisclaimerBanner>
      </Container>
    </SectionBand>
  );
}
