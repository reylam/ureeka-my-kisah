import { NavLink } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { navSections, type BadgeKey } from './navigation';
import { useWorkloadCounts } from '@/hooks/useWorkloadCounts';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';

/**
 * Desktop sidebar.
 *
 * Obsidian surface: this is where the brand's black lives. Compact by design:
 * 15rem wide, 32px rows, so the content area keeps the space. The active item
 * is marked by a CT-blue rule plus a lighter background, not by a filled pill.
 */

const badgeTone: Record<BadgeKey, 'urgent' | 'attention'> = {
  awaitingReview: 'attention',
  pendingReferrals: 'attention',
  overdueFollowUps: 'urgent',
  pendingSync: 'attention',
};

export function Sidebar({ className }: { className?: string }) {
  const counts = useWorkloadCounts();
  const facility = facilities.find((f) => f.id === OPERATING_FACILITY_ID);

  return (
    <div
      className={cn(
        'on-dark flex h-full w-60 shrink-0 flex-col border-r border-white/5 bg-obsidian-950',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-4">
        <Logo tone="light" />
      </div>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
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
                          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-white/[0.07] text-white'
                            : 'text-obsidian-300 hover:bg-white/[0.04] hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden
                            className={cn(
                              'absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-ct-400 transition-opacity',
                              isActive ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <Icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              isActive ? 'text-ct-300' : 'text-obsidian-400 group-hover:text-obsidian-200',
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.badge && count > 0 ? (
                            <span
                              className={cn(
                                'inline-flex min-w-[18px] items-center justify-center rounded px-1 text-[10px] font-semibold tabular',
                                badgeTone[item.badge] === 'urgent'
                                  ? 'bg-urgent-500/20 text-urgent-300'
                                  : 'bg-attention-500/20 text-attention-300',
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

      <div className="shrink-0 border-t border-white/5 p-2">
        <NavLink
          to="/screenings/new"
          className="flex items-center justify-center gap-2 rounded-md bg-ct-400 px-3 py-2 text-[13px] font-semibold text-obsidian-950 transition-colors hover:bg-ct-300 active:bg-ct-500"
        >
          <ScanLine aria-hidden className="size-4" />
          New Screening
        </NavLink>
        <p className="mt-2.5 px-1 text-[11px] leading-relaxed text-obsidian-500">
          {facility?.name}
          <span className="mt-0.5 block text-obsidian-600">Demo prototype · synthetic data</span>
        </p>
      </div>
    </div>
  );
}
