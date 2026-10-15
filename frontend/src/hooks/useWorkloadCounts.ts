import { useMemo } from 'react';
import { useDataStore } from '@/stores/dataStore';
import { followUpBucket } from '@/stores/selectors';
import type { BadgeKey } from '@/components/layout/navigation';

/**
 * The counts that drive the navigation badges.
 *
 * Kept in one hook so the sidebar, the mobile bar and the dashboard can never
 * disagree about how much work is outstanding.
 */
export function useWorkloadCounts(): Record<BadgeKey, number> {
  const screenings = useDataStore((state) => state.screenings);
  const referrals = useDataStore((state) => state.referrals);
  const followUps = useDataStore((state) => state.followUps);
  const syncQueue = useDataStore((state) => state.syncQueue);

  return useMemo(
    () => ({
      awaitingReview: screenings.filter((s) => s.status === 'awaiting-review').length,
      pendingReferrals: referrals.filter((r) => r.status === 'pending' || r.status === 'draft')
        .length,
      overdueFollowUps: followUps.filter((f) => followUpBucket(f) === 'overdue').length,
      pendingSync: syncQueue.filter(
        (item) =>
          item.state === 'pending' || item.state === 'failed' || item.state === 'conflict',
      ).length,
    }),
    [screenings, referrals, followUps, syncQueue],
  );
}
