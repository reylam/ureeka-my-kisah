import { Fragment } from 'react';
import { Link, useLocation, useMatches } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlobalSearch } from './GlobalSearch';
import { ConnectionStatus } from './ConnectionStatus';
import { UserMenu } from './UserMenu';
import { IconButton } from '@/components/ui/IconButton';
import { LogoMark } from '@/components/ui/Logo';

export interface Crumb {
  label: string;
  to?: string;
}

/** Route handles may declare a breadcrumb trail; detail pages set it dynamically. */
interface RouteHandle {
  crumbs?: Crumb[];
}

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const matches = useMatches();
  const location = useLocation();

  // The deepest route that declares crumbs wins.
  const crumbs =
    [...matches]
      .reverse()
      .map((match) => (match.handle as RouteHandle | undefined)?.crumbs)
      .find(Boolean) ?? [];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-obsidian-200 bg-white/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4">
      <IconButton
        label="Open navigation"
        icon={<Menu className="size-4.5" />}
        onClick={onOpenNav}
        className="lg:hidden"
      />

      <Link to="/dashboard" className="lg:hidden" aria-label="Sentra TB dashboard">
        <LogoMark className="size-7" />
      </Link>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 md:block">
        <ol className="flex items-center gap-1.5 text-[13px]">
          {crumbs.length === 0 ? (
            <li className="font-medium text-obsidian-900">{location.pathname}</li>
          ) : (
            crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <li className="min-w-0">
                    {crumb.to && !last ? (
                      <Link
                        to={crumb.to}
                        className="truncate text-obsidian-500 transition-colors hover:text-obsidian-900"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        aria-current={last ? 'page' : undefined}
                        className={cn(
                          'truncate',
                          last ? 'font-medium text-obsidian-900' : 'text-obsidian-500',
                        )}
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
            })
          )}
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        <GlobalSearch className="w-40 sm:w-56 lg:w-80" />
        <ConnectionStatus />
        <div className="hidden h-5 w-px bg-obsidian-200 sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
