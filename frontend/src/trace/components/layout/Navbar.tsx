import { useEffect, useId, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogIn, Menu, X } from 'lucide-react';
import { TraceWordmark } from './TraceMark';
import { TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { Container } from '@/trace/components/ui/Container';
import { useScrolled } from '@/trace/hooks/useScrolled';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

/**
 * Persistent navigation.
 *
 * Three routes, one call to action, no theme switcher: the site has one
 * treatment, and a toggle that changes nothing useful is a control that lies.
 *
 * The header reacts to scroll. At the top it is tall and the brand lockup
 * shows its tagline; past a few pixels the tagline collapses, the mark shrinks
 * and the wordmark settles into the vertical centre. All of it is CSS
 * transitions, so the reduced-motion rule in the base layer switches it off
 * without any extra code.
 *
 * The row is a three-column grid rather than `justify-between`, which is what
 * keeps the links optically centred no matter how wide the brand or the button
 * on either side becomes.
 *
 * Every destination is a real route. The active one is marked by colour and a
 * filled pill, and `aria-current` comes from NavLink, so the state is never
 * carried by colour alone.
 */

export const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/demo', label: 'Screening Demo' },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const location = useLocation();
  const scrolled = useScrolled(8);
  const signedIn = useAuthStore((state) => Boolean(state.accountId));

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

  const collapsed = scrolled || open;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-colors duration-300',
        collapsed
          ? 'border-trace-line bg-trace-bg/90 backdrop-blur-md'
          : 'border-transparent bg-trace-bg',
      )}
    >
      <Container>
        <div
          className={cn(
            'grid grid-cols-[auto_1fr_auto] items-center gap-4 transition-all duration-300 ease-out',
            collapsed ? 'h-16' : 'h-[88px]',
          )}
        >
          <Link
            to="/"
            aria-label="PULMO-TRACE, home"
            className="-ml-1 rounded-full px-1 py-1"
          >
            <TraceWordmark compact={collapsed} />
          </Link>

          <nav aria-label="Primary" className="hidden justify-self-center md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex h-9 items-center rounded-full px-4 text-[13.5px] transition-colors',
                        isActive
                          ? 'bg-trace-accent-surface text-trace-text'
                          : 'text-trace-muted hover:bg-trace-card hover:text-trace-text',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
            <TraceLinkButton to="/demo" size="sm" className="hidden sm:inline-flex">
              Try the demo
            </TraceLinkButton>

            {/* Way into the clinical workflow prototype. It is a separate
                application behind a sign-in, so it gets a quiet link rather
                than competing with the demo for the primary button. */}
            <Link
              to={signedIn ? '/dashboard' : '/login'}
              className="hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-trace-muted transition-colors hover:bg-trace-card hover:text-trace-text md:inline-flex"
            >
              <LogIn aria-hidden className="size-3.5" />
              {signedIn ? 'Dashboard' : 'Log in'}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={panelId}
              className="grid size-10 place-items-center rounded-full border border-trace-line text-trace-muted transition-colors hover:border-trace-hover hover:text-trace-text md:hidden"
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
            <ul className="space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between rounded-full border px-5 py-3 text-[15px]',
                        isActive
                          ? 'border-trace-accent-edge bg-trace-accent-surface text-trace-text'
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
            Try the demo
          </TraceLinkButton>
          <Link
            to={signedIn ? '/dashboard' : '/login'}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-trace-line text-[14px] text-trace-muted"
          >
            <LogIn aria-hidden className="size-4" />
            {signedIn ? 'Open dashboard' : 'Log in'}
          </Link>
        </Container>
      </div>
    </header>
  );
}
