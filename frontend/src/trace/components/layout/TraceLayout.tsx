import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Container } from '@/trace/components/ui/Container';

/**
 * Shell for the research site.
 *
 * Three jobs:
 *
 *  1. Flag the dark theme on <html>, so the scroll container, overscroll area
 *     and mobile browser chrome match the page instead of flashing white. The
 *     flag is removed on unmount, which is what keeps the light clinical
 *     prototype in the same app unaffected.
 *  2. Handle in-page anchors. React Router does not scroll to a hash target on
 *     a client navigation, so links like /research#dataset would otherwise land
 *     at the top of a very long page.
 *  3. Provide the skip link, since the research page is long enough that
 *     tabbing past the header on every visit is a real cost.
 */
export function TraceLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.site;
    root.dataset.site = 'pulmo-trace';
    return () => {
      if (previous) root.dataset.site = previous;
      else delete root.dataset.site;
    };
  }, []);

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // Let the route's content commit before looking for the target.
    const id = window.setTimeout(() => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, hash]);

  return (
    <div className="trace-scope flex min-h-screen flex-col bg-trace-bg text-trace-text antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-trace-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-[#06121f]"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

/**
 * Loading state for a code-split route. Deliberately plain: a skeleton of a
 * page this varied would be guesswork, and a spinner on a fast local chunk is
 * noise. A line of text that announces itself to a screen reader is enough.
 */
function RouteFallback() {
  return (
    <Container className="py-24">
      <p role="status" className="trace-label text-trace-dim">
        Loading section…
      </p>
    </Container>
  );
}
