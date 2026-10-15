import { Container } from '@/trace/components/ui/Container';
import { Eyebrow } from '@/trace/components/ui/SectionHeading';
import { FieldTable } from '@/trace/components/ui/DataTable';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import { PROJECT_METADATA } from '@/trace/data/research';

export const RESEARCH_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Research questions' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'evaluation', label: 'Evaluation framework' },
  { id: 'results', label: 'Results' },
  { id: 'errors', label: 'Error analysis' },
  { id: 'explainability', label: 'Explainability' },
  { id: 'limitations', label: 'Generalization' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'sources', label: 'References' },
] as const;

/**
 * Research overview, plus the page's own table of contents.
 *
 * The metadata panel is placed above the fold on purpose. Four of its rows —
 * inference status, training data, clinical validation, regulatory status —
 * say "none" or "not established", and a reader who sees that first will read
 * everything below it correctly.
 */
export function Overview() {
  return (
    <section
      id="overview"
      aria-labelledby="overview-heading"
      className="relative scroll-mt-20 overflow-hidden border-b border-trace-line"
    >
      <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
      <Container className="relative py-14 sm:py-16">
        <Eyebrow>Research documentation</Eyebrow>
        <h1
          id="overview-heading"
          className="mt-5 max-w-3xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[42px]"
        >
          Evaluating AI-assisted pulmonary TB screening
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div className="space-y-5 text-[14.5px] leading-7 text-trace-muted">
            <p>
              <span className="font-medium text-trace-text">Objective.</span> To work out what an
              image-based model could responsibly contribute to tuberculosis screening, and to build
              the interface and the reporting structure that such a model would need in order to be
              reviewed rather than merely believed.
            </p>
            <p>
              <span className="font-medium text-trace-text">Intended use.</span> Research, teaching
              and interface review. PULMO-TRACE is not a medical device, is not registered as one,
              and must not inform the care of any individual person.
            </p>
            <p>
              <span className="font-medium text-trace-text">Implementation status.</span> A frontend
              prototype. The full screening workflow is drawn end to end, the input contract and
              output format are specified, and the evaluation framework is written out — but no
              model has been trained and no inference engine is attached. The demo returns a
              labelled placeholder selected from file metadata.
            </p>
            <p>
              <span className="font-medium text-trace-text">What this demonstrates.</span> That a
              screening result can be presented with its threshold, its error profile, its
              population dependence and its limitations attached, without becoming unreadable. That
              is a design claim, and it is the only claim this build makes.
            </p>
            <p>
              <span className="font-medium text-trace-text">What has not been validated.</span>
              {' '}
              Everything else. No measurement of discrimination, calibration, generalization or
              clinical usefulness exists for this project. The figures in the results section below
              are mock data, labelled as such wherever they appear.
            </p>
          </div>

          <div>
            <FieldTable
              rows={PROJECT_METADATA}
              caption="Project metadata. Rows marked “not computed” are genuinely unknown, not withheld."
            />
          </div>
        </div>

        <DisclaimerBanner
          tone="caution"
          title="Read the provenance badge on everything below."
          className="mt-8 max-w-4xl"
        >
          Charts and tables on this page carry an <em>Illustrative</em> badge when their numbers
          were invented for the layout, and a <em>Not computed</em> badge when a value is missing
          because nobody has produced it. Nothing on this page is a measurement of a real model.
        </DisclaimerBanner>

        {/* Table of contents */}
        <nav aria-label="Sections on this page" className="mt-10 border-t border-trace-line pt-6">
          <p className="trace-label text-trace-dim">On this page</p>
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {RESEARCH_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="group inline-flex items-baseline gap-1.5 text-[13.5px] text-trace-muted transition-colors hover:text-trace-text"
                >
                  <span className="font-mono text-[10.5px] text-trace-dim">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="underline decoration-transparent underline-offset-[3px] transition-colors group-hover:decoration-trace-accent">
                    {section.label}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Container>
    </section>
  );
}
