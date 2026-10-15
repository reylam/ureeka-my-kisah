import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { TraceWordmark } from './TraceMark';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Container } from '@/trace/components/ui/Container';
import { cn } from '@/utils/cn';

/**
 * Persistent navigation.
 *
 * Three routes, one call to action, and no theme switcher: the site has one
 * treatment and a toggle that changes nothing useful is a control that lies.
 *
 * The active route is marked twice over — colour plus an underline rule — and
 * `aria-current` comes from NavLink, so the state is not carried by colour
 * alone. The mobile panel closes on navigation and on Escape, and the trigger
 * owns `aria-expanded` and `aria-controls`.
 */

export const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/demo', label: 'Model Demo' },
  { to: '/research', label: 'Research' },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const location = useLocation();

  // Close on navigation.
  useEffect(() => setOpen(false), [location.pathname]);

  // Close on Escape, and stop the page scrolling behind the open panel.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-trace-line bg-trace-bg/90 backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className="rounded-sm"
            aria-label="PULMO-TRACE, research edition — home"
          >
            <TraceWordmark />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'relative flex h-16 items-center px-3.5 text-[13.5px] transition-colors',
                        isActive
                          ? 'text-trace-text'
                          : 'text-trace-muted hover:text-trace-text',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-x-2.5 bottom-0 h-px',
                            isActive ? 'bg-trace-accent' : 'bg-transparent',
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <TraceLinkButton to="/demo" size="sm" className="hidden sm:inline-flex">
              Open Screening Demo
            </TraceLinkButton>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={panelId}
              className="grid size-10 place-items-center rounded-md border border-trace-line text-trace-muted transition-colors hover:text-trace-text md:hidden"
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </Container>

      {/* Mobile panel: a stacked list with room to tap, not a shrunken menu bar */}
      <div
        id={panelId}
        hidden={!open}
        className="border-t border-trace-line bg-trace-surface md:hidden"
      >
        <Container className="py-4">
          <nav aria-label="Primary, mobile">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between rounded-md border px-4 py-3 text-[15px]',
                        isActive
                          ? 'border-[#2b445f] bg-trace-accent-surface text-trace-text'
                          : 'border-trace-line text-trace-muted',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <TraceLinkButton to="/demo" className="mt-4 w-full">
            Open Screening Demo
          </TraceLinkButton>
        </Container>
      </div>
    </header>
  );
}
