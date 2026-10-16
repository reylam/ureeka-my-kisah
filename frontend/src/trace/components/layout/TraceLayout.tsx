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
 *  2. Reset the scroll position on navigation, which React Router leaves to
 *     the application.
 *  3. Provide the skip link, since the pages are long enough that tabbing past
 *     the header on every visit is a real cost.
 */
export function TraceLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.site;
    root.dataset.site = 'parupintas';
    return () => {
      if (previous) root.dataset.site = previous;
      else delete root.dataset.site;
    };
  }, []);

  // React Router leaves scroll position to the application. Navigating to a
  // route means "start at the top"; the one link that carries a hash, the
  // footer's link to the sources list, has to be scrolled to by hand.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const id = window.setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, hash]);

  return (
    <div className="trace-scope flex min-h-screen flex-col bg-trace-bg text-trace-text antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-trace-accent focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-trace-ink"
      >
        Lewati ke konten utama
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
        Memuat bagian…
      </p>
    </Container>
  );
}
