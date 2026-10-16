import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { navItemsFor } from './navigation';
import { useCurrentAccount } from '@/stores/authStore';

/**
 * Mobile navigation: a bottom bar. Each role has only two or three places, so
 * they all fit and no drawer is needed.
 */
export function MobileTabBar() {
  const account = useCurrentAccount();
  const items = navItemsFor(account?.role ?? null);

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-obsidian-200 bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                    isActive ? 'text-obsidian-950' : 'text-obsidian-400',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-5', isActive && 'text-ct-700')} />
                    <span className="max-w-full truncate">{item.label}</span>
                    {isActive ? <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-ct-500" /> : null}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
