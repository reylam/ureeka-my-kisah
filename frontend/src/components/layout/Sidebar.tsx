import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, ScanLine, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { navItemsFor } from './navigation';
import { useCurrentAccount } from '@/stores/authStore';
import { ROLE_LABEL } from '@/lib/permissions';

/** Desktop sidebar: which workspace you are in, and the two or three places it has. */
export function Sidebar({ className }: { className?: string }) {
  const account = useCurrentAccount();
  const role = account?.role ?? null;
  const items = navItemsFor(role);
  const RoleIcon = role === 'radiologist' ? ScanLine : ShieldCheck;

  return (
    <div className={cn('flex h-full w-60 shrink-0 flex-col border-r border-obsidian-200 bg-white', className)}>
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <Logo tone="dark" />
        {role ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-obsidian-200 bg-obsidian-50 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-obsidian-600 uppercase">
            <RoleIcon className="size-3" />
            {ROLE_LABEL[role]}
          </p>
        ) : null}
      </div>

      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors',
                      isActive ? 'bg-ct-100 text-ct-900' : 'text-obsidian-600 hover:bg-obsidian-50 hover:text-obsidian-950',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive ? 'text-ct-700' : 'text-obsidian-400 group-hover:text-obsidian-700',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-obsidian-200 p-3">
        <Link
          to="/"
          className="flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] text-obsidian-500 transition-colors hover:bg-obsidian-50 hover:text-obsidian-950"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Situs publik
        </Link>
      </div>
    </div>
  );
}
