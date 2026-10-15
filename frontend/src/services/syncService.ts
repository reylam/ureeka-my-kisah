/**
 * Demo synchronisation.
 *
 * To be unambiguous about what this does: it moves records between local
 * states. There is no server, nothing is transmitted, and no file leaves the
 * device. It exists so the offline workflow (queue, retry, conflict review) can
 * be demonstrated end to end, and every surface that triggers it says so.
 *
 * Deliberate behaviours:
 *  - Local drafts are never "synced". A draft is an incomplete record, and
 *    silently pushing incomplete clinical records would be the wrong default.
 *  - Items already marked failed stay failed in a bulk run; they have to be
 *    retried individually, which is how a worker would actually triage them.
 *  - Conflicts are never resolved automatically. Somebody has to choose.
 *  - Running it with no connection refuses, because pretending otherwise is
 *    the single most misleading thing an offline demo could do.
 */

import type { SyncQueueItem } from '@/types/domain';
import { useDataStore } from '@/stores/dataStore';
import { isConnectedNow } from '@/stores/connectionStore';
import { delay } from './delay';

export type SyncSkipReason = 'draft-incomplete' | 'needs-conflict-review' | 'needs-manual-retry';

export interface SyncRunResult {
  attempted: number;
  succeeded: number;
  skipped: { id: string; reason: SyncSkipReason }[];
  /** Set when the run could not start at all. */
  refused: 'offline' | null;
}

/** Items a bulk run will actually attempt. */
export function eligibleForBulkSync(queue: SyncQueueItem[]): SyncQueueItem[] {
  return queue.filter((item) => item.state === 'pending');
}

function skipReason(item: SyncQueueItem): SyncSkipReason | null {
  if (item.state === 'local-draft') return 'draft-incomplete';
  if (item.state === 'conflict') return 'needs-conflict-review';
  if (item.state === 'failed') return 'needs-manual-retry';
  return null;
}

export const SKIP_COPY: Record<SyncSkipReason, string> = {
  'draft-incomplete': 'Draft is incomplete and was left on the device',
  'needs-conflict-review': 'Conflict needs a decision before it can be resolved',
  'needs-manual-retry': 'Previously failed, retry it individually',
};

/**
 * Run the demo sync over the whole queue.
 *
 * `onProgress` reports completed-of-total so the UI can show a real bar rather
 * than an invented one.
 */
export async function runDemoSync(
  onProgress?: (completed: number, total: number) => void,
): Promise<SyncRunResult> {
  if (!isConnectedNow()) {
    return { attempted: 0, succeeded: 0, skipped: [], refused: 'offline' };
  }

  const store = useDataStore.getState();
  const queue = store.syncQueue;

  const skipped = queue
    .map((item) => {
      const reason = skipReason(item);
      return reason ? { id: item.id, reason } : null;
    })
    .filter((entry): entry is { id: string; reason: SyncSkipReason } => entry !== null);

  const targets = eligibleForBulkSync(queue);
  const total = targets.length;
  onProgress?.(0, total);

  let succeeded = 0;
  for (const [index, item] of targets.entries()) {
    // A short pause per record so progress is observable.
    await delay(260);

    // Lost connection mid-run: stop and leave the rest pending.
    if (!isConnectedNow()) break;

    useDataStore.getState().markSyncResult(item.id, 'synced');
    succeeded += 1;
    onProgress?.(index + 1, total);
  }

  if (succeeded > 0) {
    useDataStore.getState().setLastSyncAt(new Date().toISOString());
  }

  return { attempted: total, succeeded, skipped, refused: null };
}

/**
 * Retry one failed item.
 *
 * Succeeds on retry, which models the common real case: the first attempt died
 * with the connection, the second one goes through.
 */
export async function retrySyncItem(itemId: string): Promise<'synced' | 'failed' | 'offline'> {
  if (!isConnectedNow()) return 'offline';
  await delay(520);
  if (!isConnectedNow()) return 'offline';
  useDataStore.getState().markSyncResult(itemId, 'synced');
  useDataStore.getState().setLastSyncAt(new Date().toISOString());
  return 'synced';
}
