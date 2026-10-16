/**
 * Synchronisation of records captured offline.
 *
 * A screening recorded with no connection is held on the device (the record in
 * the outbox, the radiograph in IndexedDB). Syncing sends it to the API:
 * create the screening, upload the radiograph, then remove the device copy.
 * It is a real upload; if the server rejects a record, that record is marked
 * failed with the server's reason and stays on the device.
 *
 * Deliberate behaviours:
 *  - Local drafts are never sent. A draft is an incomplete record, and
 *    pushing incomplete clinical records would be the wrong default.
 *  - Items already marked failed stay failed in a bulk run; they have to be
 *    retried individually, which is how a worker would actually triage them.
 *  - Running it with no connection refuses, because pretending otherwise is
 *    the single most misleading thing an offline workflow could do.
 */

import type { SyncQueueItem } from '@/types/domain';
import { useDataStore } from '@/stores/dataStore';
import { isConnectedNow } from '@/stores/connectionStore';

export type SyncSkipReason = 'draft-incomplete' | 'needs-manual-retry';

export interface SyncRunResult {
  attempted: number;
  succeeded: number;
  failed: number;
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
  if (item.state === 'failed') return 'needs-manual-retry';
  return null;
}

export const SKIP_COPY: Record<SyncSkipReason, string> = {
  'draft-incomplete': 'Draft is incomplete and was left on the device',
  'needs-manual-retry': 'Previously failed, retry it individually',
};

/**
 * Send every pending item.
 *
 * `onProgress` reports completed-of-total so the UI can show a real bar.
 */
export async function runSync(
  onProgress?: (completed: number, total: number) => void,
): Promise<SyncRunResult> {
  if (!isConnectedNow()) {
    return { attempted: 0, succeeded: 0, failed: 0, skipped: [], refused: 'offline' };
  }

  const queue = useDataStore.getState().syncQueue;

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
  let failed = 0;
  for (const [index, item] of targets.entries()) {
    // Lost connection mid-run: stop and leave the rest pending.
    if (!isConnectedNow()) break;

    const outcome = await useDataStore.getState().syncItem(item.id);
    if (outcome === 'synced') succeeded += 1;
    else failed += 1;
    onProgress?.(index + 1, total);
  }

  return { attempted: total, succeeded, failed, skipped, refused: null };
}

/** Retry one item. */
export async function retrySyncItem(itemId: string): Promise<'synced' | 'failed' | 'offline'> {
  if (!isConnectedNow()) return 'offline';
  return useDataStore.getState().syncItem(itemId);
}
