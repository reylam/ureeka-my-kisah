import { Link } from 'react-router-dom';
import { Container } from '@/trace/components/ui/Container';
import { TraceWordmark } from './TraceMark';
import { TraceAnchor } from '@/trace/components/ui/TraceButton';
import { SOURCES } from '@/trace/data/sources';
import { PROJECT } from '@/trace/data/research';
import { NAV_ITEMS } from './Navbar';

/**
 * Footer. Carries the disclaimer that matters most, the build status, and
 * links to the sources the site leans on — so a reader who arrives at the
 * bottom of the page leaves with the caveat rather than without it.
 */
export function Footer() {
  const resources = [
    SOURCES.whoScreening2021,
    SOURCES.whoCxr2016,
    SOURCES.whoGtb2025,
    SOURCES.tripodAi,
  ];

  return (
    <footer className="border-t border-trace-line bg-trace-surface">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1.3fr]">
          <div>
            <TraceWordmark />
            <p className="mt-4 max-w-sm text-[13.5px] leading-6 text-trace-muted">
              A research prototype for AI-assisted tuberculosis screening from chest radiographs.
              It exists to make a method, an evaluation framework and a set of limitations
              inspectable — not to screen anybody.
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="trace-label text-trace-dim">Pages</h2>
            <ul className="mt-4 space-y-2.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-[13.5px] text-trace-muted transition-colors hover:text-trace-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/research#sources"
                  className="text-[13.5px] text-trace-muted transition-colors hover:text-trace-text"
                >
                  Reference list
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="trace-label text-trace-dim">Dataset and methodology resources</h2>
            <ul className="mt-4 space-y-2.5">
              {resources.map((source) => (
                <li key={source.id}>
                  <TraceAnchor href={source.url} className="text-[13.5px]">
                    {source.label}
                  </TraceAnchor>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-trace-line pt-6">
          <p className="max-w-3xl text-[13px] leading-6 text-trace-muted">
            <span className="font-medium text-trace-text">Research disclaimer.</span>{' '}
            PULMO-TRACE is a research and educational prototype. It is not a medical device, it has
            not been clinically validated, and it must not be used to diagnose, rule out or treat
            tuberculosis. No model is connected to this build: the demo returns a clearly labelled
            placeholder, and every figure on the research page is mock data. If tuberculosis is a
            concern for a real person, consult a qualified health professional.
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] text-trace-dim">
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.1em]">Version</dt>
              <dd className="text-trace-muted">{PROJECT.version}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.1em]">Stage</dt>
              <dd className="text-trace-muted">{PROJECT.stage}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.1em]">Inference</dt>
              <dd className="text-trace-muted">Simulated</dd>
            </div>
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.1em]">Updated</dt>
              <dd className="text-trace-muted">{PROJECT.updated}</dd>
            </div>
          </dl>
        </div>
      </Container>
    </footer>
  );
}
