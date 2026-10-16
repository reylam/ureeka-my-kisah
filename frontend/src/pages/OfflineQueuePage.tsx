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
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SyncStateBadge } from '@/components/ui/StatusBadge';
import { Toggle } from '@/components/forms/Inputs';
import { useDataStore } from '@/stores/dataStore';
import { useConnectionStore, useIsConnected } from '@/stores/connectionStore';
import { toast } from '@/stores/toastStore';
import { SKIP_COPY, eligibleForBulkSync, retrySyncItem, runSync as sendQueue } from '@/services/syncService';
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
  screening: 'Record screening',
  referral: 'Referral',
  followup: 'Follow-up',
  patient: 'Data pasien',
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
  const removeSyncItem = useDataStore((state) => state.removeSyncItem);
  const deleteScreening = useDataStore((state) => state.deleteScreening);

  const [tab, setTab] = useState<TabId>('pending');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [retrying, setRetrying] = useState<string | null>(null);
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

    const result = await sendQueue((done, total) => setProgress({ done, total }));
    setRunning(false);
    setProgress({ done: 0, total: 0 });

    if (result.refused === 'offline') {
      toast.error(
        'Sync tidak bisa dijalankan saat offline.',
        'Record tetap tersimpan di perangkat ini. Tidak ada yang hilang.',
      );
      return;
    }
    if (result.attempted === 0) {
      toast.info(
        'Tidak ada antrean yang perlu di-sync.',
        result.skipped.length > 0
          ? `${pluralise(result.skipped.length, 'record', 'record')} perlu dicek dulu.`
          : undefined,
      );
      return;
    }

    if (result.failed > 0) {
      toast.error(
        `${pluralise(result.failed, 'record', 'record')} gagal dikirim.`,
        'Record tetap tersimpan di perangkat ini. Buka tab Gagal untuk melihat penyebabnya, lalu coba lagi.',
      );
      return;
    }
    toast.success(
      `${pluralise(result.succeeded, 'record', 'record')} berhasil dikirim.`,
      result.skipped.length > 0
        ? `${pluralise(result.skipped.length, 'record', 'record')} dilewati dan menunggu review.`
        : undefined,
    );
  };

  const handleRetry = async (item: SyncQueueItem) => {
    setRetrying(item.id);
    const outcome = await retrySyncItem(item.id);
    setRetrying(null);

    if (outcome === 'offline') {
      toast.error('Tidak bisa mencoba ulang saat offline.');
      return;
    }
    if (outcome === 'failed') {
      toast.error(`${item.label} gagal dikirim.`, 'Lihat alasannya di record terkait.');
      return;
    }
    toast.success(`${item.label} berhasil dikirim.`);
  };

  const discard = async () => {
    if (!discarding) return;
    if (discarding.kind === 'screening') {
      // Removes the record and its stored radiograph together.
      await deleteScreening(discarding.entityId);
    } else {
      removeSyncItem(discarding.id);
    }
    toast.info('Draf dihapus dari perangkat ini.');
    setDiscarding(null);
  };

  const emptyCopy: Record<TabId, { title: string; description: string }> = {
    pending: {
      title: 'Tidak ada yang menunggu sync',
      description: 'Semua record yang sudah selesai di perangkat ini sudah terkirim.',
    },
    drafts: {
      title: 'Belum ada draf lokal',
      description: 'Screening yang disimpan sebelum selesai akan muncul di sini.',
    },
    failed: {
      title: 'Tidak ada percobaan yang gagal',
      description: 'Record yang gagal di-sync akan muncul di sini untuk dicoba lagi.',
    },
    conflicts: {
      title: 'Tidak ada konflik',
      description: 'Belum ada data di perangkat ini yang diubah orang lain dalam waktu bersamaan.',
    },
    synced: {
      title: 'Belum ada yang ter-sync',
      description: 'Record akan hilang dari daftar ini begitu sudah diterima server.',
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Offline queue"
        description="Apa saja yang tersimpan di perangkat ini, apa yang sedang menunggu, dan apa yang perlu keputusan sebelum bisa dikirim."
        meta={
          <>
            <HeaderMeta label="Menunggu" value={counts.pending} />
            <HeaderMeta label="Draf" value={counts['local-draft']} />
            <HeaderMeta label="Perlu dicek" value={counts.failed + counts.conflict} />
            <HeaderMeta label="Di perangkat" value={formatBytes(pendingBytes)} />
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
            {running ? 'Sedang sync' : 'Sync sekarang'}
          </Button>
        }
      />

      {/* Connection panel */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={connected ? <CloudUpload /> : <WifiOff />}
            title="Koneksi"
            description={
              connected
                ? 'Koneksi tersedia, jadi record dalam antrean bisa dikirim.'
                : 'Tidak ada koneksi. Form dan draf tetap bisa dipakai di perangkat ini.'
            }
          />
          <CardBody className="space-y-3">
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Status dari browser">
                {browserOnline ? (
                  <span className="inline-flex items-center gap-1.5 text-complete-800">
                    <CheckCircle2 aria-hidden className="size-3.5" />
                    Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-attention-800">
                    <WifiOff aria-hidden className="size-3.5" />
                    Tidak ada koneksi
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Sync terakhir">
                {lastSyncAt ? (
                  <>
                    {formatRelative(lastSyncAt)}
                    <span className="ml-1.5 text-obsidian-400">{formatDateTime(lastSyncAt)}</span>
                  </>
                ) : (
                  'Belum pernah dijalankan'
                )}
              </DetailRow>
              <DetailRow label="Analisis gambar">
                {connected ? 'Tersedia' : 'Tidak tersedia sampai koneksi kembali'}
              </DetailRow>
            </dl>

            <div className="rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
              <Toggle
                tone="attention"
                checked={simulatedOffline}
                onChange={(value) => {
                  setSimulatedOffline(value);
                  toast.info(
                    value ? 'Mode offline disimulasikan.' : 'Simulasi offline dimatikan.',
                    value
                      ? 'Aplikasi sekarang berperilaku seolah-olah tidak ada koneksi.'
                      : undefined,
                  );
                }}
                label="Kerja offline"
                description="Memaksa perilaku offline tanpa memutus jaringan, jadi alur queue dan draf bisa didemokan."
              />
            </div>

            {running ? (
              <ProgressBar
                value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
                label={`Memproses ${progress.done} dari ${progress.total} record`}
              />
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Database />}
            title="Apa artinya sebenarnya"
            description="Empat hal berbeda yang sengaja dipisahkan."
          />
          <CardBody>
            <dl className="space-y-3 text-[13px]">
              <Meaning
                icon={<FileEdit />}
                term="Pengisian form offline"
                detail="Form screening, referral, dan perubahan follow-up semuanya bisa dipakai tanpa koneksi."
                available
              />
              <Meaning
                icon={<HardDrive />}
                term="Penyimpanan lokal"
                detail="Screening yang dibuat saat offline disimpan di storage browser ini. X-ray-nya masuk ke IndexedDB, tidak pernah ke cache service worker, dan dihapus setelah record terkirim."
                available
              />
              <Meaning
                icon={<CloudUpload />}
                term="Sinkronisasi"
                detail="Sync mengirim setiap screening dalam antrean ke server PARUPINTAS dan meng-upload X-ray-nya, lalu menghapus salinan di perangkat ini."
                available
              />
              <Meaning
                icon={<CloudOff />}
                term="Inferensi model"
                detail="Analisis tidak dijalankan di perangkat. Butuh koneksi, jadi record dalam antrean menunggu."
                available={connected}
              />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Notice tone="demo" title="Tersimpan di perangkat ini sampai terkirim">
        Record dalam antrean beserta X-ray-nya berada di storage browser ini. Siapa pun yang
        punya akses ke profil perangkat ini bisa membacanya sampai sync selesai.
      </Notice>

      {/* Queue */}
      <Card className="overflow-hidden">
        <Tabs<TabId>
          value={tab}
          onChange={setTab}
          className="px-2"
          items={[
            { id: 'pending', label: 'Menunggu', count: counts.pending, icon: <CloudUpload /> },
            { id: 'drafts', label: 'Draf', count: counts['local-draft'], icon: <FileEdit /> },
            {
              id: 'failed',
              label: 'Gagal',
              count: counts.failed,
              countTone: counts.failed > 0 ? 'urgent' : 'neutral',
              icon: <XCircle />,
            },
            {
              id: 'conflicts',
              label: 'Konflik',
              count: counts.conflict,
              countTone: counts.conflict > 0 ? 'urgent' : 'neutral',
              icon: <GitCompareArrows />,
            },
            { id: 'synced', label: 'Ter-sync', count: counts.synced, icon: <CheckCircle2 /> },
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
                        {KIND_LABEL[item.kind]} · masuk antrean {formatRelative(item.queuedAt)} ·{' '}
                        {formatBytes(item.sizeBytes)}
                        {item.attempts > 0
                          ? ` · ${pluralise(item.attempts, 'percobaan', 'percobaan')}`
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
                          {SKIP_COPY['draft-incomplete']}. Selesaikan record agar masuk antrean.
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
                          {screening.status === 'draft' ? 'Selesaikan record' : 'Buka record'}
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
                          Coba lagi
                        </Button>
                      ) : null}

                      {item.state === 'local-draft' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={<Trash2 className="size-3.5" />}
                          onClick={() => setDiscarding(item)}
                        >
                          Buang
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

      {/* Discard a draft */}
      <ConfirmDialog
        open={Boolean(discarding)}
        onClose={() => setDiscarding(null)}
        onConfirm={() => void discard()}
        tone="danger"
        title="Buang draf ini?"
        description={
          discarding?.kind === 'screening'
            ? 'Record screening dan X-ray yang tersimpan bersamanya akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.'
            : 'Record dalam antrean akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan.'
        }
        confirmLabel="Buang draf"
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
            {available ? 'Berfungsi' : 'Butuh koneksi'}
          </span>
        </dt>
        <dd className="mt-0.5 text-xs leading-relaxed text-obsidian-600">{detail}</dd>
      </div>
    </div>
  );
}
