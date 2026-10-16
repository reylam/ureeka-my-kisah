import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  CloudUpload,
  ScanLine,
  Send,
  Stethoscope,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, LineSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { FollowUpBucketBadge, ScreeningOutcomeBadge } from '@/components/ui/StatusBadge';
import { SimulatedResultNotice } from '@/components/ui/Notice';
import { useDataStore } from '@/stores/dataStore';
import { buildDashboardSummary, followUpBucket } from '@/stores/selectors';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { recordsApi } from '@/services/recordsApi';
import { useCurrentUser } from '@/stores/authStore';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';
import { followUpReasonLabel } from '@/utils/labels';
import {
  ageFromBirthDate,
  formatDateShort,
  formatDueLabel,
  formatRelative,
  formatTime,
} from '@/utils/date';
import { pluralise } from '@/utils/format';

/**
 * Dashboard.
 *
 * Structured around three questions, in this order:
 *   1. What screening work needs attention?   → metric row + review queue
 *   2. Which patients need follow-up?         → follow-up queue
 *   3. What is happening at this facility?    → activity chart + sync state
 *
 * Every figure is derived from the local dataset by `buildDashboardSummary`.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const patients = useDataStore((state) => state.patients);
  const screenings = useDataStore((state) => state.screenings);
  const followUps = useDataStore((state) => state.followUps);
  const lastSyncAt = useDataStore((state) => state.lastSyncAt);

  const { data: summary, loading } = useStoreQuery(
    () => recordsApi.getDashboardSummary(),
    () => {
      const state = useDataStore.getState();
      return buildDashboardSummary(
        state.screenings,
        state.referrals,
        state.followUps,
        state.syncQueue,
      );
    },
  );

  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const facility = facilities.find((f) => f.id === OPERATING_FACILITY_ID);

  /** Screenings a reviewer should look at, flagged ones first. */
  const reviewQueue = useMemo(
    () =>
      screenings
        .filter((screening) => screening.status === 'awaiting-review')
        .sort((a, b) => {
          const aFlagged = a.analysis?.outcome === 'flagged-for-review' ? 0 : 1;
          const bFlagged = b.analysis?.outcome === 'flagged-for-review' ? 0 : 1;
          if (aFlagged !== bFlagged) return aFlagged - bFlagged;
          return b.performedAt.localeCompare(a.performedAt);
        })
        .slice(0, 6),
    [screenings],
  );

  /** Open follow-ups, most overdue first. */
  const followUpQueue = useMemo(
    () =>
      followUps
        .filter((item) => item.status === 'scheduled' || item.status === 'in-progress')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [followUps],
  );

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  const firstName = user?.name.replace(/^(dr\.|Ns\.)\s*/i, '').split(' ')[0] ?? '';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${facility?.name} · ${facility?.region}. Ini yang perlu diperhatikan hari ini.`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/reports')}>
              Riwayat screening
            </Button>
            <Button
              variant="primary"
              leadingIcon={<ScanLine className="size-4" />}
              onClick={() => navigate('/screenings/new')}
            >
              Screening baru
            </Button>
          </>
        }
      />

      {/* 1. What needs attention */}
      <section aria-label="Ringkasan beban kerja">
        {loading || !summary ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Record screening"
              value={summary.totalScreenings}
              icon={ClipboardList}
              to="/reports"
              caption={`${summary.screeningsThisWeek} tercatat dalam 7 hari terakhir`}
            />
            <MetricTile
              label="Menunggu review"
              value={summary.awaitingReview}
              icon={Stethoscope}
              to="/reports?status=awaiting-review"
              tone="attention"
              caption={
                summary.flaggedAwaitingReview > 0
                  ? `${summary.flaggedAwaitingReview} ditandai oleh model demo`
                  : 'Tidak ada record yang ditandai di queue'
              }
            />
            <MetricTile
              label="Referral menunggu"
              value={summary.pendingReferrals}
              icon={Send}
              to="/referrals"
              tone="attention"
              caption="Belum dihadiri atau ditutup"
            />
            <MetricTile
              label="Follow-up terlambat"
              value={summary.overdueFollowUps}
              icon={CalendarClock}
              to="/followups?bucket=overdue"
              tone="urgent"
              caption={
                summary.dueTodayFollowUps > 0
                  ? `${summary.dueTodayFollowUps} lagi jatuh tempo hari ini`
                  : 'Tidak ada lagi yang jatuh tempo hari ini'
              }
            />
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Review queue */}
        <Card>
          <CardHeader
            icon={<Stethoscope />}
            title="Menunggu review klinis"
            description="Record screening dengan output analisis yang belum disetujui tenaga medis."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/reports?status=awaiting-review')}>
                Lihat semua
              </Button>
            }
          />
          {loading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : reviewQueue.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 />}
              title="Review queue kosong"
              description="Semua record screening dengan output analisis sudah direview."
            />
          ) : (
            <ul className="divide-y divide-obsidian-100">
              {reviewQueue.map((screening) => {
                const patient = patientsById.get(screening.patientId);
                return (
                  <li key={screening.id}>
                    <Link
                      to={`/screenings/${screening.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ct-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-obsidian-900">
                          {patient?.name ?? 'Pasien tidak dikenal'}
                          <span className="ml-2 font-normal text-obsidian-400">
                            {patient ? `${ageFromBirthDate(patient.birthDate)} thn` : ''}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-obsidian-500">
                          {patient?.mrn} · {formatDateShort(screening.performedAt)}{' '}
                          {formatTime(screening.performedAt)}
                        </p>
                      </div>
                      {screening.analysis ? (
                        <ScreeningOutcomeBadge
                          outcome={screening.analysis.outcome}
                          short
                          size="sm"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-obsidian-200 px-4 py-2.5">
            <SimulatedResultNotice variant="inline" />
          </div>
        </Card>

        {/* 2. Who needs follow-up */}
        <Card>
          <CardHeader
            icon={<CalendarClock />}
            title="Follow-up queue"
            description="Task kontak yang masih terbuka, yang paling terlambat di atas."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/followups')}>
                Lihat semua
              </Button>
            }
          />
          {loading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : followUpQueue.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 />}
              title="Tidak ada follow-up terbuka"
              description="Saat ini tidak ada yang terjadwal atau sedang berjalan."
            />
          ) : (
            <ul className="divide-y divide-obsidian-100">
              {followUpQueue.map((item) => {
                const patient = patientsById.get(item.patientId);
                const bucket = followUpBucket(item);
                return (
                  <li key={item.id}>
                    <Link
                      to={`/followups?focus=${item.id}`}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-ct-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-obsidian-900">
                          {patient?.name ?? 'Pasien tidak dikenal'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-obsidian-500">
                          {followUpReasonLabel[item.reason]} ·{' '}
                          <span
                            className={
                              bucket === 'overdue'
                                ? 'font-medium text-urgent-700'
                                : bucket === 'due-today'
                                  ? 'font-medium text-attention-700'
                                  : ''
                            }
                          >
                            {formatDueLabel(item.dueDate)}
                          </span>
                        </p>
                      </div>
                      <FollowUpBucketBadge bucket={bucket} size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* 3. What is happening at this facility */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={<Activity />}
            title="Aktivitas screening"
            description="Record yang dibuat di fasilitas ini, dihitung dari dataset lokal."
          />
          <CardBody>
            {loading || !summary ? (
              <div className="h-40">
                <LineSkeleton lines={5} />
              </div>
            ) : (
              <ActivityChart data={summary.activity} />
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          {/* Offline sync indicator */}
          <Card>
            <CardHeader icon={<CloudUpload />} title="Record lokal & sync" />
            <CardBody className="space-y-3">
              {loading || !summary ? (
                <LineSkeleton lines={3} />
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <SyncStat
                      label="Draf offline"
                      value={summary.draftRecords}
                      tone={summary.draftRecords > 0 ? 'attention' : 'neutral'}
                    />
                    <SyncStat
                      label="Menunggu sync"
                      value={summary.pendingSyncRecords}
                      tone={summary.pendingSyncRecords > 0 ? 'attention' : 'neutral'}
                    />
                    <SyncStat
                      label="Percobaan gagal"
                      value={summary.failedSyncRecords}
                      tone={summary.failedSyncRecords > 0 ? 'urgent' : 'neutral'}
                    />
                    <SyncStat
                      label="Konflik"
                      value={summary.conflictRecords}
                      tone={summary.conflictRecords > 0 ? 'urgent' : 'neutral'}
                    />
                  </dl>
                  <p className="text-xs text-obsidian-500">
                    Sync demo terakhir{' '}
                    <span className="font-medium text-obsidian-700">
                      {lastSyncAt ? formatRelative(lastSyncAt) : 'belum pernah dijalankan'}
                    </span>
                    .
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    fullWidth
                    leadingIcon={<CloudOff className="size-4" />}
                    onClick={() => navigate('/offline')}
                  >
                    Buka offline queue
                  </Button>
                </>
              )}
            </CardBody>
          </Card>

          {/* Outcome mix, labelled as simulated output */}
          <Card>
            <CardHeader
              icon={<ClipboardList />}
              title="Sebaran outcome"
              description="Cara analisis demo mengklasifikasikan record yang sudah dianalisis."
            />
            <CardBody className="space-y-2.5">
              {loading || !summary ? (
                <LineSkeleton lines={3} />
              ) : (
                <>
                  {summary.outcomeBreakdown.map((entry) => {
                    const analysed = summary.outcomeBreakdown.reduce(
                      (sum, item) => sum + item.count,
                      0,
                    );
                    const share = analysed === 0 ? 0 : (entry.count / analysed) * 100;
                    return (
                      <div key={entry.outcome}>
                        <div className="flex items-center justify-between gap-3">
                          <ScreeningOutcomeBadge outcome={entry.outcome} short size="sm" />
                          <span className="text-[13px] font-medium text-obsidian-800 tabular">
                            {entry.count}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-obsidian-100">
                          <div
                            className={
                              entry.outcome === 'flagged-for-review'
                                ? 'h-full rounded-full bg-attention-500'
                                : entry.outcome === 'inconclusive'
                                  ? 'h-full rounded-full bg-obsidian-300'
                                  : 'h-full rounded-full bg-ct-400'
                            }
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <SimulatedResultNotice variant="inline" className="pt-1" />
                </>
              )}
            </CardBody>
          </Card>

          {/* Register size */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ct-100 text-ct-700"
                >
                  <Users className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-obsidian-900">
                    {pluralise(patients.length, 'pasien', 'pasien')} di register
                  </p>
                  <Link
                    to="/patients"
                    className="text-xs text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                  >
                    Buka direktori pasien
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SyncStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'attention' | 'urgent';
}) {
  return (
    <div className="rounded-md border border-obsidian-200 px-2.5 py-2">
      <dt className="text-[11px] text-obsidian-500">{label}</dt>
      <dd
        className={
          tone === 'urgent'
            ? 'mt-0.5 text-lg leading-none font-semibold text-urgent-800 tabular'
            : tone === 'attention'
              ? 'mt-0.5 text-lg leading-none font-semibold text-attention-800 tabular'
              : 'mt-0.5 text-lg leading-none font-semibold text-obsidian-950 tabular'
        }
      >
        {value}
      </dd>
    </div>
  );
}
