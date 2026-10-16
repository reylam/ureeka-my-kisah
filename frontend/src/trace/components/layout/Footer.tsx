import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/trace/components/ui/Container';
import { TraceFooterMark } from './TraceMark';
import { NAV_ITEMS } from './Navbar';
import { cn } from '@/utils/cn';

/**
 * Footer.
 *
 * Three blocks and a disclaimer. The disclaimer sits above the copyright line
 * rather than beside it, because it is the most important sentence on the site
 * and a reader who reaches the bottom of a page should land on it.
 *
 * "Paper" is absent from the resources list on purpose. There is no paper, and
 * a greyed-out "soon" link is a promise the project has not made.
 */

const RESOURCES: { label: string; href: string; detail: string }[] = [
  {
    label: 'Repository GitHub',
    href: 'https://github.com/reylam/ureeka-my-kisah',
    detail: 'Source code',
  },
  {
    label: 'Sample dataset',
    href: 'https://www.kaggle.com/datasets/usmanshams/tbx-11',
    detail: 'Koleksi chest X-ray publik',
  },
];

export function Footer() {
  return (
    <footer className="border-t border-trace-line bg-trace-surface">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-12">
          <div>
            <TraceFooterMark />
            <p className="mt-5 max-w-sm text-[13.5px] leading-6 text-trace-muted">
              Prototipe riset yang mengeksplorasi bagaimana software bisa membantu mengenali tanda
              tuberkulosis di chest X-ray, dan bagaimana hasil seperti itu seharusnya dijelaskan
              kepada orang yang membacanya.
            </p>
          </div>

          <nav aria-labelledby="footer-nav">
            <h2 id="footer-nav" className="trace-label text-trace-dim">
              Navigasi
            </h2>
            <ul className="mt-4 space-y-3">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/how-it-works#sources" className={footerLink}>
                  Sumber
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="trace-label text-trace-dim">Sumber daya</h2>
            <ul className="mt-4 space-y-3">
              {RESOURCES.map((resource) => (
                <li key={resource.href}>
                  <a
                    href={resource.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(footerLink, 'inline-flex items-baseline gap-1.5')}
                  >
                    {resource.label}
                    <ArrowUpRight aria-hidden className="size-3.5 self-center" />
                  </a>
                  <span className="mt-0.5 block text-[12px] text-trace-dim">
                    {resource.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-trace-line pt-7">
          <p className="text-[12.5px] text-trace-dim">© 2026 PULMO-TRACE</p>
        </div>
      </Container>
    </footer>
  );
}

const footerLink = 'text-[13.5px] text-trace-muted transition-colors hover:text-trace-text';
