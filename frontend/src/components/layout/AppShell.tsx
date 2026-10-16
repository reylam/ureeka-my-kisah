import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toaster } from '@/components/ui/Toaster';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileTabBar } from './MobileNav';

/** The staff workspace: sidebar on desktop, bottom bar on mobile, a scrolling content column. */
export function AppShell() {
  const location = useLocation();

  // Detail pages otherwise inherit the previous page's scroll position.
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

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="app-content" className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-24 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8">
          <div className="mx-auto w-full max-w-[90rem]">
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

function PageFallback() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-5">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-64" />
    </div>
  );
}
