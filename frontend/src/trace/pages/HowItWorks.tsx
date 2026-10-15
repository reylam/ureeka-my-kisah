import { useEffect } from 'react';
import { ArrowRight, Phone, Play, Stethoscope } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { Eyebrow, SectionHeading } from '@/trace/components/ui/SectionHeading';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Callout } from '@/trace/components/ui/Callout';
import { StepFlow } from '@/trace/components/ui/StepFlow';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import { SourceList } from '@/trace/components/ui/SourceCitation';
import { Mascot } from '@/trace/components/visuals/Mascot';
import { FAQ, STEPS } from '@/trace/data/content';
import { SOURCE_LIST } from '@/trace/data/sources';

/**
 * How it works.
 *
 * The explaining page, still written for someone with no medical or machine
 * learning background. Analogies instead of terminology, and a question list
 * instead of a methods section. The depth that used to live on the site is in
 * `docs/research-notes.txt` now, where it belongs.
 */
export function TraceHowItWorks() {
  useEffect(() => {
    document.title = 'How it works · PULMO-TRACE';
  }, []);

  return (
    <>
      {/* Masthead */}
      <div className="relative overflow-hidden border-b border-trace-line">
        <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
        <Container className="relative py-14 sm:py-16">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-5 max-w-3xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[42px]">
            What is actually going on behind a screening result
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-trace-muted">
            No medical or computing background needed. If you have five minutes, this explains the
            whole idea, including the parts that are not built and the parts that would never be
            safe to trust on their own.
          </p>
        </Container>
      </div>

      {/* Pattern matching, in plain terms */}
      <SectionBand bordered={false} labelledBy="pattern-heading" className="pt-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <SectionHeading
              id="pattern-heading"
              index="01"
              eyebrow="The idea"
              title="Software that has seen a lot of X-rays"
            />

            <div className="space-y-5 text-[15px] leading-7 text-trace-muted">
              <p>
                Think of someone who has sorted photographs for a living for twenty years. Show
                them a new photo and they can tell you instantly which pile it belongs in. They
                are not reasoning it out, they are recognising something.
              </p>
              <p>
                That is roughly what this kind of software does. It is shown thousands of chest
                X-rays that have already been labelled by people who knew the answer, and it
                gradually learns which arrangements of light and shadow tend to go with which
                label. Afterwards, given a new X-ray, it produces a number saying how much this
                one looks like the ones labelled tuberculosis.
              </p>
              <p>
                Two things follow from that, and they matter more than anything else on this page.
                The software only knows what was in the pile it learned from. And it recognises
                patterns, which is not the same as understanding a disease.
              </p>
            </div>
          </div>

          <Callout label="Why that second point is not a technicality" tone="caution" className="mt-12 max-w-3xl">
            Software like this has been caught, more than once, picking up on things that had
            nothing to do with illness: a marker a particular hospital puts in the corner, the way
            one brand of machine processes its images, even the border of the picture. It scored
            brilliantly in testing and then failed completely somewhere else. Recognising a pattern
            is not the same as knowing what the pattern means.
          </Callout>
        </Container>
      </SectionBand>

      {/* The four steps again, with room to breathe */}
      <SectionBand tone="raised" labelledBy="steps-heading">
        <Container>
          <SectionHeading
            id="steps-heading"
            index="02"
            eyebrow="The flow"
            title="From an X-ray to a next step"
            standfirst="The same four steps as on the home page. Here they are worth reading slowly, because the notes underneath say which parts exist."
          />
          <div className="mt-11 rounded-2xl border border-trace-line bg-trace-card p-6 sm:p-8">
            <StepFlow steps={STEPS} />
          </div>

          <DisclaimerBanner
            tone="caution"
            title="Steps three and four are the honest gap in this project."
            className="mt-6 max-w-3xl"
          >
            Step three needs a trained model, and there is not one. Step four shows a stand-in
            result so the format can be judged. Everything the demo displays is clearly marked as a
            placeholder, and the number it shows comes from the file’s name and size, not from the
            picture.
          </DisclaimerBanner>
        </Container>
      </SectionBand>

      {/* Score vs probability */}
      <SectionBand labelledBy="score-heading">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <SectionHeading
              id="score-heading"
              index="03"
              eyebrow="The number"
              title="Why a score is not a “chance of having TB”"
            />

            <div className="space-y-5 text-[15px] leading-7 text-trace-muted">
              <p>
                A screening tool usually reports a number between 0 and 1. It is tempting to read
                0.80 as “an 80% chance this person has tuberculosis”. That reading is wrong, and
                the difference is not academic.
              </p>
              <p>
                The score only says how strongly this image resembles the ones the software learned
                to flag. Whether a particular person actually has TB also depends on how common TB
                is where they live, what symptoms they have, and their history. The same 0.80 means
                something very different in a TB clinic, where many patients do have it, and in a
                routine workplace check, where almost nobody does.
              </p>
              <p>
                This is why a screening tool cannot be shipped with one fixed cut-off and used
                everywhere. The cut-off is a decision about which mistake you would rather make,
                and that decision belongs to the people running the clinic, not to the software.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TradeoffCard
              title="Set the cut-off low"
              body="Almost nobody with TB is missed, but a lot of healthy people get flagged and sent for tests they did not need."
            />
            <TradeoffCard
              title="Set it high"
              body="Nearly everyone flagged really does need testing, but more people with TB slip through unnoticed."
            />
            <TradeoffCard
              title="There is no setting that avoids both"
              body="Which way you lean depends on how reachable the follow-up test is, and on what a missed case costs in that community."
              tone="accent"
            />
          </div>
        </Container>
      </SectionBand>

      {/* Care pathway */}
      <SectionBand tone="raised" labelledBy="path-heading">
        <Container>
          <SectionHeading
            id="path-heading"
            index="04"
            eyebrow="Where this sits"
            title="Screening, testing, treating"
            standfirst="Three different jobs, done by different people, in this order. Software can only ever help with the first one."
          />

          <ol className="mt-11 grid gap-5 lg:grid-cols-3">
            {[
              {
                step: 'First',
                title: 'Screening',
                body: 'Who should be tested? Symptom questions and a chest X-ray. Quick, cheap, approximate, and the only place this kind of software belongs.',
                who: 'Health worker, or software helping one',
              },
              {
                step: 'Then',
                title: 'Testing',
                body: 'Does this person have the bacteria? A sputum sample goes to a rapid molecular test, a culture, or a microscope. This is what actually confirms tuberculosis.',
                who: 'Laboratory',
              },
              {
                step: 'Finally',
                title: 'Diagnosis and treatment',
                body: 'The test result read together with symptoms and history, then a course of treatment that typically runs for months and has to be completed.',
                who: 'Doctor, with the patient',
              },
            ].map((stage) => (
              <li
                key={stage.title}
                className="rounded-2xl border border-trace-line bg-trace-card p-6"
              >
                <p className="trace-label text-trace-dim">{stage.step}</p>
                <h3 className="mt-3 text-[19px] font-medium tracking-[-0.01em] text-trace-text">
                  {stage.title}
                </h3>
                <p className="mt-3 text-[14px] leading-6 text-trace-muted">{stage.body}</p>
                <p className="mt-4 flex items-center gap-2 border-t border-trace-line-soft pt-4 text-[12.5px] text-trace-dim">
                  <Stethoscope aria-hidden className="size-3.5 shrink-0" />
                  {stage.who}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </SectionBand>

      {/* FAQ */}
      <SectionBand labelledBy="faq-heading">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              id="faq-heading"
              index="05"
              eyebrow="Questions"
              title="The things people ask first"
            />
            <Mascot size="md" className="hidden sm:flex" />
          </div>

          <dl className="mt-11 max-w-3xl divide-y divide-trace-line border-t border-trace-line">
            {FAQ.map((item) => (
              <div key={item.question} className="py-7">
                <dt className="text-[17px] leading-snug font-medium tracking-[-0.01em] text-trace-text">
                  {item.question}
                </dt>
                <dd className="mt-3 text-[14.5px] leading-7 text-trace-muted">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </SectionBand>

      {/* If you are worried */}
      <SectionBand tone="raised" labelledBy="worried-heading">
        <Container width="narrow">
          <div className="rounded-2xl border border-trace-accent-edge bg-trace-accent-surface p-7 sm:p-9">
            <Phone aria-hidden className="size-5 text-trace-accent" />
            <h2
              id="worried-heading"
              className="mt-4 text-[22px] leading-snug font-medium tracking-[-0.015em]"
            >
              If you are worried about tuberculosis, do not use this site
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-trace-muted">
              See a health professional instead. A cough that has lasted more than two weeks, fever,
              night sweats, or losing weight without trying are all reasons to get checked. TB is
              curable, and in many countries testing and treatment are free. Getting tested early
              also protects the people around you.
            </p>
            <p className="mt-4 text-[14px] leading-6 text-trace-dim">
              Nothing on this site can tell you whether you have tuberculosis, and it is not
              intended to try.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <TraceLinkButton to="/demo">
              <Play aria-hidden className="size-4" />
              Open the screening demo
            </TraceLinkButton>
            <TraceLinkButton to="/" variant="secondary">
              Back to the overview
              <ArrowRight aria-hidden className="size-4" />
            </TraceLinkButton>
          </div>
        </Container>
      </SectionBand>

      {/* Sources */}
      <SectionBand id="sources" labelledBy="sources-heading">
        <Container>
          <SectionHeading
            id="sources-heading"
            eyebrow="Sources"
            title="Where the facts on this site come from"
            standfirst="Three World Health Organization documents. There is no entry here for a study of PULMO-TRACE, because none exists."
          />
          <SourceList sources={SOURCE_LIST} className="mt-10 max-w-3xl" />
        </Container>
      </SectionBand>
    </>
  );
}

function TradeoffCard({
  title,
  body,
  tone = 'plain',
}: {
  title: string;
  body: string;
  tone?: 'plain' | 'accent';
}) {
  return (
    <div
      className={
        tone === 'accent'
          ? 'rounded-2xl border border-trace-accent-edge bg-trace-accent-surface p-6'
          : 'rounded-2xl border border-trace-line bg-trace-card p-6'
      }
    >
      <h3 className="text-[15.5px] font-medium text-trace-text">{title}</h3>
      <p className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">{body}</p>
    </div>
  );
}
