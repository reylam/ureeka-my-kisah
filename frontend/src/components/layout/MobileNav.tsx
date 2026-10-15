import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Logo } from '@/components/ui/Logo';
import { navSections, allNavItems, type BadgeKey } from './navigation';
import { useWorkloadCounts } from '@/hooks/useWorkloadCounts';
import { IconButton } from '@/components/ui/IconButton';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';

/**
 * Mobile navigation.
 *
 * Two parts, because one pattern does not cover both needs:
 *
 * - A bottom bar with the five routes a health worker uses in the field, so
 *   screening and follow-ups are always one thumb-tap away.
 * - A slide-in drawer holding the complete navigation, opened from the top bar.
 */

const badgeTone: Record<BadgeKey, string> = {
  awaitingReview: 'bg-attention-500',
  pendingReferrals: 'bg-attention-500',
  overdueFollowUps: 'bg-urgent-500',
  pendingSync: 'bg-attention-500',
};

export function MobileTabBar() {
  const counts = useWorkloadCounts();
  const items = allNavItems.filter((item) => item.primaryMobile);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-obsidian-200 bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/screenings/new'}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors',
                    isActive ? 'text-obsidian-950' : 'text-obsidian-400',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className={cn('size-5', isActive && 'text-ct-700')} />
                      {item.badge && count > 0 ? (
                        <span
                          aria-hidden
                          className={cn(
                            'absolute -top-0.5 -right-1 size-2 rounded-full ring-2 ring-white',
                            badgeTone[item.badge],
                          )}
                        />
                      ) : null}
                    </span>
                    <span className="max-w-full truncate">
                      {item.label === 'New Screening' ? 'Screen' : item.label}
                    </span>
                    {item.badge && count > 0 ? (
                      <span className="sr-only">{count} need attention</span>
                    ) : null}
                    {isActive ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-ct-500"
                      />
                    ) : null}
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

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const counts = useWorkloadCounts();
  const location = useLocation();
  const facility = facilities.find((f) => f.id === OPERATING_FACILITY_ID);

  // Navigating should always dismiss the drawer.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-obsidian-950/50"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="on-dark relative flex h-full w-72 max-w-[85vw] flex-col bg-obsidian-950"
          >
            <div className="flex h-14 shrink-0 items-center justify-between px-4">
              <Logo tone="light" />
              <IconButton
                label="Close navigation"
                tone="onDark"
                icon={<X className="size-4" />}
                onClick={onClose}
              />
            </div>

            <nav aria-label="All sections" className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
              {navSections.map((section) => (
                <div key={section.id} className="mb-2">
                  {section.label ? (
                    <p className="px-2.5 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-obsidian-500 uppercase">
                      {section.label}
                    </p>
                  ) : (
                    <div className="pt-2" />
                  )}
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const count = item.badge ? counts[item.badge] : 0;
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.to === '/screenings/new'}
                            className={({ isActive }) =>
                              cn(
                                'flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors',
                                isActive
                                  ? 'bg-white/[0.07] text-white'
                                  : 'text-obsidian-300 active:bg-white/[0.04]',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <Icon
                                  className={cn(
                                    'mt-px size-4 shrink-0',
                                    isActive ? 'text-ct-300' : 'text-obsidian-400',
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2 text-[13px] font-medium">
                                    {item.label}
                                    {item.badge && count > 0 ? (
                                      <span className="inline-flex min-w-[18px] items-center justify-center rounded bg-white/10 px-1 text-[10px] font-semibold text-ct-200 tabular">
                                        {count}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] leading-snug text-obsidian-500">
                                    {item.description}
                                  </span>
                                </span>
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

            <div className="shrink-0 border-t border-white/5 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-obsidian-500">
                {facility?.name}
                <span className="mt-0.5 block text-obsidian-600">
                  Demo prototype · synthetic data
                </span>
              </p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
