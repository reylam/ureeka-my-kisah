import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { navSectionsFor, PRIMARY_ACTION, ROLE_ICON, type BadgeKey } from './navigation';
import { useCurrentAccount } from '@/stores/authStore';
import { ROLE_LABEL } from '@/lib/permissions';
import { useWorkloadCounts } from '@/hooks/useWorkloadCounts';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';

/**
 * Desktop sidebar.
 *
 * Obsidian surface: this is where the brand's black lives. Compact by design,
 * so the content area keeps the space. The active item is a filled pill with a
 * CT-blue icon, matching the pill navigation on the public site, and the row
 * shape follows the rounded buttons used everywhere else.
 */

const badgeTone: Record<BadgeKey, 'urgent' | 'attention'> = {
  awaitingReview: 'attention',
  pendingReferrals: 'attention',
  overdueFollowUps: 'urgent',
  pendingSync: 'attention',
};

export function Sidebar({ className }: { className?: string }) {
  const counts = useWorkloadCounts();
  const account = useCurrentAccount();
  const role = account?.role ?? null;
  const navSections = navSectionsFor(role);
  const primary = role ? PRIMARY_ACTION[role] : null;
  const RoleIcon = role ? ROLE_ICON[role] : null;
  const facility = facilities.find((f) => f.id === OPERATING_FACILITY_ID);

  return (
    <div
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-obsidian-200 bg-white',
        className,
      )}
    >
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <Logo tone="dark" />
        {/* Which workspace you are in. Three roles share this shell, and
            without a label the only clue is which links happen to be here. */}
        {role && RoleIcon ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-obsidian-200 bg-obsidian-50 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-obsidian-600 uppercase">
            <RoleIcon className="size-3" />
            {ROLE_LABEL[role]}
          </p>
        ) : null}
      </div>

      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {navSections.map((section) => (
          <div key={section.id} className="mb-1">
            {section.label ? (
              <p className="px-2.5 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-obsidian-500 uppercase">
                {section.label}
              </p>
            ) : (
              <div className="pt-1" />
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/screenings/new'}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-ct-100 text-ct-900'
                            : 'text-obsidian-600 hover:bg-obsidian-50 hover:text-obsidian-950',
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
                          {item.badge && count > 0 ? (
                            <span
                              className={cn(
                                'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular',
                                badgeTone[item.badge] === 'urgent'
                                  ? 'bg-urgent-100 text-urgent-800'
                                  : 'bg-attention-100 text-attention-800',
                              )}
                            >
                              {count}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-obsidian-200 p-3">
        {primary ? (
          <NavLink
            to={primary.to}
            className="flex items-center justify-center gap-2 rounded-full bg-obsidian-950 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-obsidian-800 active:bg-obsidian-900"
          >
            <primary.icon className="size-4" />
            {primary.label}
          </NavLink>
        ) : null}

        {/* Way back out to the public research site, which is the project's
            front door. Without this the application is a dead end. */}
        <Link
          to="/"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] text-obsidian-500 transition-colors hover:bg-obsidian-50 hover:text-obsidian-950"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Situs riset
        </Link>

        <p className="mt-3 px-2 text-[11px] leading-relaxed text-obsidian-500">
          {facility?.name}
        </p>
      </div>
    </div>
  );
}
