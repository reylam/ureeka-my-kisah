import { Fragment } from 'react';
import { Link, useMatches } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { UserMenu } from './UserMenu';
import { LogoMark } from '@/components/ui/Logo';

export interface Crumb {
  label: string;
  to?: string;
}

/** Routes declare their breadcrumb trail in `handle.crumbs`. */
interface RouteHandle {
  crumbs?: Crumb[];
}

export function TopBar() {
  const matches = useMatches();

  // The deepest route that declares crumbs wins.
  const crumbs =
    [...matches]
      .reverse()
      .map((match) => (match.handle as RouteHandle | undefined)?.crumbs)
      .find(Boolean) ?? [];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-obsidian-200 bg-white/95 px-3 backdrop-blur-sm sm:px-4">
      <Link to="/app" className="lg:hidden" aria-label="Beranda petugas">
        <LogoMark className="size-7" />
      </Link>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-[13px]">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <li className="min-w-0">
                  {crumb.to && !last ? (
                    <Link to={crumb.to} className="truncate text-obsidian-500 transition-colors hover:text-obsidian-900">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={last ? 'page' : undefined}
                      className={cn('truncate', last ? 'font-medium text-obsidian-900' : 'text-obsidian-500')}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
                {!last ? (
                  <li aria-hidden className="text-obsidian-300">
                    <ChevronRight className="size-3.5" />
                  </li>
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <UserMenu />
    </header>
  );
}
