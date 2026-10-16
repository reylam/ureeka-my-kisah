import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNavDrawer, MobileTabBar } from './MobileNav';
import { Toaster } from '@/components/ui/Toaster';
import { initConnectionListeners } from '@/stores/connectionStore';
import { OfflineBanner } from './OfflineBanner';

/**
 * Application shell.
 *
 * Layout: fixed-width obsidian sidebar on the left (desktop only), sticky top
 * bar, and a scrolling content column. Content is capped at a readable width
 * and padded modestly. Operational screens benefit from using the width, so
 * this is not a narrow centred column.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => initConnectionListeners(), []);

  // Scroll to top on navigation; detail pages otherwise inherit the previous
  // page's scroll position, which is disorienting.
  useEffect(() => {
    document.getElementById('app-content')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-cloud">
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-obsidian-950 focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Langsung ke konten
      </a>

      <Sidebar className="hidden lg:flex" />
      <MobileNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <OfflineBanner />

        <main
          id="app-content"
          data-print="root"
          className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-24 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8"
        >
          <div className="mx-auto w-full max-w-[90rem]">
            {/* Page bundles are code-split, so a boundary is needed here. */}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <MobileTabBar />
      <Toaster />
    </div>
  );
}

/**
 * Shown while a page bundle is still arriving. Shaped like a page header plus
 * a content block so the layout does not jump once the real page mounts.
 */
function PageFallback() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-5">
      <div className="space-y-2.5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
