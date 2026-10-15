import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Database,
  FileEdit,
  GitCompareArrows,
  HardDrive,
  RefreshCw,
  Trash2,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { SyncStateBadge } from '@/components/ui/StatusBadge';
import { Toggle } from '@/components/forms/Inputs';
import { useDataStore } from '@/stores/dataStore';
import { useConnectionStore, useIsConnected } from '@/stores/connectionStore';
import { toast } from '@/stores/toastStore';
import { SKIP_COPY, eligibleForBulkSync, retrySyncItem, runDemoSync } from '@/services/syncService';
import { formatBytes, pluralise } from '@/utils/format';
import { formatDateTime, formatRelative } from '@/utils/date';
import type { SyncQueueItem, SyncState } from '@/types/domain';

/**
 * Offline queue.
 *
 * The page is built around one honest distinction, because conflating these
 * four things is how offline demos end up lying:
 *
 *   1. Offline form entry      works with no connection
 *   2. Local persistence       records live in this browser's storage
 *   3. Synchronisation         moves records between local states here
 *   4. Model inference         needs a connection, and is not local
 */

type TabId = 'pending' | 'drafts' | 'failed' | 'conflicts' | 'synced';

const TAB_STATES: Record<TabId, SyncState[]> = {
  pending: ['pending'],
  drafts: ['local-draft'],
  failed: ['failed'],
  conflicts: ['conflict'],
  synced: ['synced'],
};

const KIND_LABEL: Record<SyncQueueItem['kind'], string> = {
  screening: 'Screening record',
  referral: 'Referral',
  followup: 'Follow-up',
  patient: 'Patient record',
};

export function OfflineQueuePage() {
  const navigate = useNavigate();
  const connected = useIsConnected();
  const browserOnline = useConnectionStore((state) => state.online);
  const simulatedOffline = useConnectionStore((state) => state.simulatedOffline);
  const setSimulatedOffline = useConnectionStore((state) => state.setSimulatedOffline);

  const queue = useDataStore((state) => state.syncQueue);
  const screenings = useDataStore((state) => state.screenings);
  const lastSyncAt = useDataStore((state) => state.lastSyncAt);
  const resolveConflict = useDataStore((state) => state.resolveConflict);
  const removeSyncItem = useDataStore((state) => state.removeSyncItem);
  const deleteScreening = useDataStore((state) => state.deleteScreening);

  const [tab, setTab] = useState<TabId>('pending');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [conflictItem, setConflictItem] = useState<SyncQueueItem | null>(null);
  const [discarding, setDiscarding] = useState<SyncQueueItem | null>(null);

  const counts = useMemo(() => {
    const result: Record<SyncState, number> = {
      pending: 0,
      'local-draft': 0,
      failed: 0,
      conflict: 0,
      synced: 0,
    };
    queue.forEach((item) => {
      result[item.state] += 1;
    });
    return result;
  }, [queue]);

  const rows = useMemo(
    () => queue.filter((item) => TAB_STATES[tab].includes(item.state)),
    [queue, tab],
  );

  const pendingBytes = queue
    .filter((item) => item.state === 'pending' || item.state === 'local-draft')
    .reduce((sum, item) => sum + item.sizeBytes, 0);

  const runSync = async () => {
    setRunning(true);
    setProgress({ done: 0, total: eligibleForBulkSync(queue).length });

    const result = await runDemoSync((done, total) => setProgress({ done, total }));
    setRunning(false);
    setProgress({ done: 0, total: 0 });

    if (result.refused === 'offline') {
      toast.error(
        'Cannot sync while offline.',
        'Records stay on this device. Nothing was lost.',
      );
      return;
    }
    if (result.attempted === 0) {
      toast.info(
        'Nothing queued to sync.',
        result.skipped.length > 0
          ? `${pluralise(result.skipped.length, 'record')} need attention first.`
          : undefined,
      );
      return;
    }

    toast.success(
      `${pluralise(result.succeeded, 'record')} marked as synced.`,
      result.skipped.length > 0
        ? `${pluralise(result.skipped.length, 'record')} skipped and left for review.`
        : 'This is a local state change, not an upload.',
    );
  };

  const handleRetry = async (item: SyncQueueItem) => {
    setRetrying(item.id);
    const outcome = await retrySyncItem(item.id);
    setRetrying(null);

    if (outcome === 'offline') {
      toast.error('Cannot retry while offline.');
      return;
    }
    toast.success(`${item.label} marked as synced.`);
  };

  const discard = async () => {
    if (!discarding) return;
    if (discarding.kind === 'screening') {
      // Removes the record and its stored radiograph together.
      await deleteScreening(discarding.entityId);
    } else {
      removeSyncItem(discarding.id);
    }
    toast.info('Draft discarded from this device.');
    setDiscarding(null);
  };

  const emptyCopy: Record<TabId, { title: string; description: string }> = {
    pending: {
      title: 'Nothing waiting to sync',
      description: 'Every completed record on this device has been marked as synced.',
    },
    drafts: {
      title: 'No local drafts',
      description: 'Screenings saved before they were finished would appear here.',
    },
    failed: {
      title: 'No failed attempts',
      description: 'Records that could not be synced would be listed here for retry.',
    },
    conflicts: {
      title: 'No conflicts',
      description: 'A conflict happens when the same record changed in two places.',
    },
    synced: {
      title: 'Nothing synced yet',
      description: 'Records appear here once a demo sync has run.',
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Offline queue"
        description="What is stored on this device, what is waiting, and what needs a decision before it can move."
        meta={
          <>
            <HeaderMeta label="Waiting" value={counts.pending} />
            <HeaderMeta label="Drafts" value={counts['local-draft']} />
            <HeaderMeta label="Needs attention" value={counts.failed + counts.conflict} />
            <HeaderMeta label="On device" value={formatBytes(pendingBytes)} />
          </>
        }
        actions={
          <Button
            variant="primary"
            loading={running}
            disabled={!connected}
            leadingIcon={<CloudUpload className="size-4" />}
            onClick={() => void runSync()}
          >
            {running ? 'Running demo sync' : 'Run demo sync'}
          </Button>
        }
      />

      {/* Connection panel */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={connected ? <CloudUpload /> : <WifiOff />}
            title="Connection"
            description={
              connected
                ? 'A connection is available, so the demo sync can run.'
                : 'No connection. Forms and drafts keep working on this device.'
            }
          />
          <CardBody className="space-y-3">
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Browser reports">
                {browserOnline ? (
                  <span className="inline-flex items-center gap-1.5 text-complete-800">
                    <CheckCircle2 aria-hidden className="size-3.5" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-attention-800">
                    <WifiOff aria-hidden className="size-3.5" />
                    No connection
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Last demo sync">
                {lastSyncAt ? (
                  <>
                    {formatRelative(lastSyncAt)}
                    <span className="ml-1.5 text-obsidian-400">{formatDateTime(lastSyncAt)}</span>
                  </>
                ) : (
                  'Not run yet'
                )}
              </DetailRow>
              <DetailRow label="Image analysis">
                {connected ? 'Available' : 'Unavailable until a connection returns'}
              </DetailRow>
            </dl>

            <div className="rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
              <Toggle
                tone="attention"
                checked={simulatedOffline}
                onChange={(value) => {
                  setSimulatedOffline(value);
                  toast.info(
                    value ? 'Offline mode simulated.' : 'Offline simulation switched off.',
                    value
                      ? 'The app now behaves as if there were no connection.'
                      : undefined,
                  );
                }}
                label="Simulate being offline"
                description="Forces the offline behaviour without disconnecting the network, so the queue and draft flow can be demonstrated."
              />
            </div>

            {running ? (
              <ProgressBar
                value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
                label={`Processing ${progress.done} of ${progress.total} records`}
              />
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Database />}
            title="What this actually means"
            description="Four different things, kept separate on purpose."
          />
          <CardBody>
            <dl className="space-y-3 text-[13px]">
              <Meaning
                icon={<FileEdit />}
                term="Offline form entry"
                detail="Screening forms, referrals and follow-up edits all work with no connection."
                available
              />
              <Meaning
                icon={<HardDrive />}
                term="Local persistence"
                detail="Records are written to this browser's storage on this device. Radiographs go to IndexedDB, never into the service worker cache."
                available
              />
              <Meaning
                icon={<CloudUpload />}
                term="Synchronisation"
                detail="In this prototype a sync only changes local record states. Nothing is transmitted and there is no server."
                available
              />
              <Meaning
                icon={<CloudOff />}
                term="Model inference"
                detail="Analysis is not performed on the device. It needs a connection, so queued records wait."
                available={connected}
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Notice tone="demo" title="Local storage is not a secured backend">
        Anyone with access to this device profile can read these records. Clearing demo data from
        Settings removes them, including stored radiographs.
      </Notice>

      {/* Queue */}
      <Card className="overflow-hidden">
        <Tabs<TabId>
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { id: 'pending', label: 'Waiting', count: counts.pending, icon: <CloudUpload /> },
            { id: 'drafts', label: 'Drafts', count: counts['local-draft'], icon: <FileEdit /> },
            {
              id: 'failed',
              label: 'Failed',
              count: counts.failed,
              countTone: counts.failed > 0 ? 'urgent' : 'neutral',
              icon: <XCircle />,
            },
            {
              id: 'conflicts',
              label: 'Conflicts',
              count: counts.conflict,
              countTone: counts.conflict > 0 ? 'urgent' : 'neutral',
              icon: <GitCompareArrows />,
            },
            { id: 'synced', label: 'Synced', count: counts.synced, icon: <CheckCircle2 /> },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState
            compact
            icon={tab === 'synced' ? <CloudUpload /> : <CheckCircle2 />}
            title={emptyCopy[tab].title}
            description={emptyCopy[tab].description}
          />
        ) : (
          <ul className="divide-y divide-obsidian-100">
            {rows.map((item) => {
              const screening =
                item.kind === 'screening'
                  ? screenings.find((s) => s.id === item.entityId)
                  : undefined;

              return (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-medium text-obsidian-900">{item.label}</p>
                        <SyncStateBadge state={item.state} size="sm" />
                      </div>
                      <p className="mt-1 text-xs text-obsidian-500 tabular">
                        {KIND_LABEL[item.kind]} · queued {formatRelative(item.queuedAt)} ·{' '}
                        {formatBytes(item.sizeBytes)}
                        {item.attempts > 0
                          ? ` · ${pluralise(item.attempts, 'attempt')}`
                          : ''}
                      </p>

                      {item.error ? (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-urgent-700">
                          <XCircle aria-hidden className="mt-px size-3.5 shrink-0" />
                          {item.error}
                        </p>
                      ) : null}

                      {item.state === 'local-draft' ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-obsidian-500">
                          {SKIP_COPY['draft-incomplete']}. Finish the record to queue it.
                        </p>
                      ) : null}

                      {item.conflict ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-urgent-700">
                          {item.conflict.remoteActor} changed{' '}
                          <span className="font-medium">{item.conflict.field}</span> elsewhere.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {screening ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(
                              screening.status === 'draft'
                                ? `/screenings/new?draft=${screening.id}`
                                : `/screenings/${screening.id}`,
                            )
                          }
                        >
                          {screening.status === 'draft' ? 'Finish record' : 'Open record'}
                        </Button>
                      ) : null}

                      {item.state === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!connected}
                          loading={retrying === item.id}
                          leadingIcon={<RefreshCw className="size-3.5" />}
                          onClick={() => void handleRetry(item)}
                        >
                          Retry
                        </Button>
                      ) : null}

                      {item.state === 'conflict' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          leadingIcon={<GitCompareArrows className="size-3.5" />}
                          onClick={() => setConflictItem(item)}
                        >
                          Review conflict
                        </Button>
                      ) : null}

                      {item.state === 'local-draft' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={<Trash2 className="size-3.5" />}
                          onClick={() => setDiscarding(item)}
                        >
                          Discard
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Conflict review */}
      <Dialog
        open={Boolean(conflictItem)}
        onClose={() => setConflictItem(null)}
        title="Resolve a conflict"
        description={
          conflictItem
            ? `${conflictItem.label} changed in two places. Choose which version to keep.`
            : undefined
        }
        footer={
          conflictItem ? (
            <>
              <Button variant="ghost" onClick={() => setConflictItem(null)}>
                Decide later
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resolveConflict(conflictItem.id, 'local');
                  toast.info(
                    'Keeping the version on this device.',
                    'The record was re-queued for the next sync.',
                  );
                  setConflictItem(null);
                }}
              >
                Keep this device
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  resolveConflict(conflictItem.id, 'remote');
                  toast.success(
                    'Keeping the other version.',
                    'The local edit was discarded and the record marked synced.',
                  );
                  setConflictItem(null);
                }}
              >
                Keep the other version
              </Button>
            </>
          ) : null
        }
      >
        {conflictItem?.conflict ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-obsidian-600">
              Both versions changed{' '}
              <span className="font-medium text-obsidian-900">{conflictItem.conflict.field}</span>.
              There is no safe automatic answer, so nothing is merged for you.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-obsidian-200 p-3">
                <p className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                  On this device
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-obsidian-900">
                  {conflictItem.conflict.localValue}
                </p>
                <p className="mt-1 text-xs text-obsidian-500">
                  Edited here while offline
                </p>
              </div>
              <div className="rounded-md border border-ct-300 bg-ct-50/60 p-3">
                <p className="text-[11px] font-semibold tracking-wide text-ct-800 uppercase">
                  Other version
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-obsidian-900">
                  {conflictItem.conflict.remoteValue}
                </p>
                <p className="mt-1 text-xs text-obsidian-500">
                  {conflictItem.conflict.remoteActor} ·{' '}
                  {formatRelative(conflictItem.conflict.remoteUpdatedAt)}
                </p>
              </div>
            </div>

            <Notice tone="demo" compact>
              Both versions are stored locally in this prototype. This models the decision a real
              sync would force, without any network exchange.
            </Notice>
          </div>
        ) : null}
      </Dialog>

      {/* Discard a draft */}
      <ConfirmDialog
        open={Boolean(discarding)}
        onClose={() => setDiscarding(null)}
        onConfirm={() => void discard()}
        tone="danger"
        title="Discard this draft?"
        description={
          discarding?.kind === 'screening'
            ? 'The screening record and the radiograph stored with it will be deleted from this device. This cannot be undone.'
            : 'The queued record will be removed from this device. This cannot be undone.'
        }
        confirmLabel="Discard draft"
      />
    </div>
  );
}

function Meaning({
  icon,
  term,
  detail,
  available,
}: {
  icon: React.ReactNode;
  term: string;
  detail: string;
  available: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={
          available
            ? 'mt-px flex size-6 shrink-0 items-center justify-center rounded bg-complete-50 text-complete-700 [&>svg]:size-3.5'
            : 'mt-px flex size-6 shrink-0 items-center justify-center rounded bg-attention-50 text-attention-700 [&>svg]:size-3.5'
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="flex flex-wrap items-center gap-2 font-medium text-obsidian-900">
          {term}
          <span
            className={
              available
                ? 'rounded bg-complete-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-complete-800 uppercase'
                : 'rounded bg-attention-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-attention-800 uppercase'
            }
          >
            {available ? 'Working' : 'Needs connection'}
          </span>
        </dt>
        <dd className="mt-0.5 text-xs leading-relaxed text-obsidian-600">{detail}</dd>
      </div>
    </div>
  );
}
