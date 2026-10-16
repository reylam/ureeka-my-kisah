import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  ExternalLink,
  History,
  PhoneCall,
  User,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/forms/Inputs';
import { FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, NoMatchesState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import {
  FollowUpBucketBadge,
  FollowUpStatusBadge,
  ReferralStatusBadge,
} from '@/components/ui/StatusBadge';
import { FollowUpFormDialog } from '@/components/followups/FollowUpFormDialog';
import {
  CompleteFollowUpDialog,
  ContactAttemptDialog,
  UnresolvedFollowUpDialog,
} from '@/components/followups/FollowUpActionDialogs';
import { useDataStore } from '@/stores/dataStore';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { useTableControls } from '@/hooks/useTableControls';
import { followUpBucket } from '@/stores/selectors';
import { recordsApi } from '@/services/recordsApi';
import { users } from '@/data/users';
import {
  contactChannelLabel,
  contactOutcomeLabel,
  followUpReasonLabel,
  userRoleLabel,
} from '@/utils/labels';
import { formatDate, formatDateTime, formatDueLabel, formatRelative } from '@/utils/date';
import { pluralise } from '@/utils/format';
import type { FollowUp, FollowUpBucket, FollowUpReason } from '@/types/domain';

/**
 * Follow-up tracker.
 *
 * Organised by urgency rather than by creation date, because the only question
 * that matters here is "who should I be chasing today". Tabs are derived from
 * the due date against today, so the queues are always genuinely accurate.
 */

type TabId = 'overdue' | 'today' | 'upcoming' | 'completed' | 'unresolved' | 'all';
type FilterKey = 'reason' | 'worker';

const TAB_TO_BUCKETS: Record<TabId, FollowUpBucket[] | null> = {
  overdue: ['overdue'],
  today: ['due-today'],
  upcoming: ['upcoming'],
  completed: ['completed'],
  unresolved: ['unresolved'],
  all: null,
};

const REASONS: FollowUpReason[] = [
  'referral-attendance',
  'sputum-result',
  'repeat-imaging',
  'treatment-adherence',
  'contact-tracing',
  'symptom-recheck',
];

export function FollowUpsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patients = useDataStore((state) => state.patients);
  const referrals = useDataStore((state) => state.referrals);
  const { data: followUps, loading, error, refetch } = useStoreQuery<FollowUp[]>(
    () => recordsApi.getFollowUps(),
    () => useDataStore.getState().followUps,
  );

  const all = followUps ?? [];
  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const referralsById = useMemo(() => new Map(referrals.map((r) => [r.id, r])), [referrals]);

  const initialTab = (searchParams.get('bucket') as TabId | null) ?? 'overdue';
  const [tab, setTab] = useState<TabId>(
    TAB_TO_BUCKETS[initialTab] !== undefined ? initialTab : 'overdue',
  );

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<FollowUp | null>(null);
  const [attemptFor, setAttemptFor] = useState<FollowUp | null>(null);
  const [completingFor, setCompletingFor] = useState<FollowUp | null>(null);
  const [unresolvedFor, setUnresolvedFor] = useState<FollowUp | null>(null);

  const focusId = searchParams.get('focus');
  const focused = useDataStore((state) =>
    focusId ? (state.followUps.find((item) => item.id === focusId) ?? null) : null,
  );

  // If a focused record is gone (reset demo data), drop the param.
  useEffect(() => {
    if (focusId && !loading && !focused) {
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [focusId, focused, loading, searchParams, setSearchParams]);

  const closeFocus = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const result: Record<FollowUpBucket, number> = {
      overdue: 0,
      'due-today': 0,
      upcoming: 0,
      completed: 0,
      unresolved: 0,
    };
    all.forEach((item) => {
      result[followUpBucket(item)] += 1;
    });
    return result;
  }, [all]);

  /** Rows for the active tab, before search and filters. */
  const tabRows = useMemo(() => {
    const buckets = TAB_TO_BUCKETS[tab];
    if (!buckets) return all;
    return all.filter((item) => buckets.includes(followUpBucket(item)));
  }, [all, tab]);

  const controls = useTableControls<FollowUp, FilterKey>({
    rows: tabRows,
    initialSort: { columnId: 'due', direction: 'asc' },
    search: (followUp, term) => {
      const patient = patientsById.get(followUp.patientId);
      return (
        followUp.code.toLowerCase().includes(term) ||
        followUpReasonLabel[followUp.reason].toLowerCase().includes(term) ||
        (patient?.name.toLowerCase().includes(term) ?? false) ||
        (patient?.mrn.toLowerCase().includes(term) ?? false) ||
        (patient?.village.toLowerCase().includes(term) ?? false)
      );
    },
    filters: {
      reason: (followUp, value) => followUp.reason === value,
      worker: (followUp, value) => followUp.assignedWorkerId === value,
    },
    comparators: {
      patient: (a, b) =>
        (patientsById.get(a.patientId)?.name ?? '').localeCompare(
          patientsById.get(b.patientId)?.name ?? '',
        ),
      due: (a, b) => a.dueDate.localeCompare(b.dueDate),
      attempts: (a, b) => a.attempts.length - b.attempts.length,
      code: (a, b) => a.code.localeCompare(b.code),
    },
  });

  const lastAction = (followUp: FollowUp): string => {
    if (followUp.completedAt) return `Selesai ${formatRelative(followUp.completedAt)}`;
    const latest = followUp.attempts[followUp.attempts.length - 1];
    if (!latest) return 'Belum ada percobaan kontak';
    return `${contactOutcomeLabel[latest.outcome] ?? latest.outcome} · ${formatRelative(latest.at)}`;
  };

  const columns = useMemo<Column<FollowUp>[]>(
    () => [
      {
        id: 'patient',
        header: 'Pasien',
        sortable: true,
        cell: (followUp) => {
          const patient = patientsById.get(followUp.patientId);
          return (
            <StackedCell primary={patient?.name ?? 'Pasien tidak dikenal'} secondary={patient?.mrn} />
          );
        },
      },
      {
        id: 'code',
        header: 'Task',
        sortable: true,
        width: 'w-24',
        hideBelow: 'xl',
        cell: (followUp) => <MonoCell>{followUp.code}</MonoCell>,
      },
      {
        id: 'reason',
        header: 'Alasan',
        width: 'w-44',
        cell: (followUp) => (
          <span className="text-obsidian-700">{followUpReasonLabel[followUp.reason]}</span>
        ),
      },
      {
        id: 'due',
        header: 'Jatuh tempo',
        sortable: true,
        width: 'w-40',
        cell: (followUp) => {
          const bucket = followUpBucket(followUp);
          return (
            <div>
              <span className="tabular">{formatDate(followUp.dueDate)}</span>
              {bucket === 'overdue' || bucket === 'due-today' ? (
                <span
                  className={
                    bucket === 'overdue'
                      ? 'mt-0.5 block text-[11px] font-medium text-urgent-700'
                      : 'mt-0.5 block text-[11px] font-medium text-attention-700'
                  }
                >
                  {formatDueLabel(followUp.dueDate)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'referral',
        header: 'Referral',
        width: 'w-28',
        hideBelow: 'xl',
        cell: (followUp) =>
          followUp.referralId ? (
            <MonoCell>{referralsById.get(followUp.referralId)?.code ?? 'Tidak dikenal'}</MonoCell>
          ) : (
            <span className="text-obsidian-400">Tidak ada</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        width: 'w-36',
        cell: (followUp) => <FollowUpStatusBadge status={followUp.status} size="sm" />,
      },
      {
        id: 'lastAction',
        header: 'Aksi terakhir',
        width: 'w-48',
        hideBelow: 'lg',
        cell: (followUp) => (
          <span className="text-xs text-obsidian-500">{lastAction(followUp)}</span>
        ),
      },
      {
        id: 'open',
        header: '',
        srHeader: 'Buka follow-up',
        align: 'right',
        width: 'w-10',
        cell: () => (
          <ChevronRight
            aria-hidden
            className="ml-auto size-4 text-obsidian-300 transition-colors group-hover:text-obsidian-500"
          />
        ),
      },
    ],
    [patientsById, referralsById],
  );

  const focusedPatient = focused ? patientsById.get(focused.patientId) : null;
  const focusedReferral = focused?.referralId ? referralsById.get(focused.referralId) : null;

  const emptyCopy: Record<TabId, { title: string; description: string }> = {
    overdue: {
      title: 'Tidak ada yang terlambat',
      description: 'Semua follow-up yang masih terbuka belum melewati tenggat.',
    },
    today: {
      title: 'Tidak ada yang jatuh tempo hari ini',
      description: 'Cek queue mendatang untuk melihat yang berikutnya.',
    },
    upcoming: {
      title: 'Belum ada jadwal ke depan',
      description: 'Jadwalkan follow-up saat ada pasien yang perlu dihubungi.',
    },
    completed: {
      title: 'Belum ada follow-up selesai',
      description: 'Task yang selesai muncul di sini beserta hasil yang dicatat.',
    },
    unresolved: {
      title: 'Tidak ada yang belum terselesaikan',
      description: 'Task yang memang tidak bisa ditutup akan tampil di sini.',
    },
    all: {
      title: 'Belum ada follow-up',
      description: 'Jadwalkan dari halaman pasien atau referral.',
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Follow-up"
        description="Task kontak agar pasien rujukan tidak hilang di antara screening dan pemeriksaan."
        meta={
          <>
            <HeaderMeta label="Terlambat" value={counts.overdue} />
            <HeaderMeta label="Jatuh tempo hari ini" value={counts['due-today']} />
            <HeaderMeta label="Mendatang" value={counts.upcoming} />
          </>
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<CalendarPlus className="size-4" />}
            onClick={() => setScheduleOpen(true)}
          >
            Jadwalkan follow-up
          </Button>
        }
      />

      {counts.overdue > 0 && tab !== 'overdue' ? (
        <Notice tone="urgent" title={`${pluralise(counts.overdue, 'follow-up', 'follow-up')} terlambat`}>
          <button
            type="button"
            onClick={() => setTab('overdue')}
            className="font-medium text-urgent-800 underline decoration-urgent-300 underline-offset-2"
          >
            Buka queue terlambat
          </button>
        </Notice>
      ) : null}

      <Card className="overflow-hidden">
        <Tabs<TabId>
          value={tab}
          onChange={(next) => {
            setTab(next);
            controls.setPage(1);
          }}
          className="px-2"
          items={[
            {
              id: 'overdue',
              label: 'Terlambat',
              count: counts.overdue,
              countTone: counts.overdue > 0 ? 'urgent' : 'neutral',
              icon: <AlertTriangle />,
            },
            {
              id: 'today',
              label: 'Jatuh tempo hari ini',
              count: counts['due-today'],
              countTone: counts['due-today'] > 0 ? 'attention' : 'neutral',
            },
            { id: 'upcoming', label: 'Mendatang', count: counts.upcoming },
            { id: 'completed', label: 'Selesai', count: counts.completed },
            {
              id: 'unresolved',
              label: 'Belum terselesaikan',
              count: counts.unresolved,
              countTone: counts.unresolved > 0 ? 'urgent' : 'neutral',
            },
            { id: 'all', label: 'Semua', count: all.length },
          ]}
        />

        <Toolbar
          activeFilterCount={controls.activeFilterCount}
          onClearFilters={controls.clearAll}
          search={
            <SearchInput
              label="Cari follow-up berdasarkan pasien, kode task, atau alasan"
              placeholder="Pasien, kode task, atau desa"
              value={controls.term}
              onChange={controls.setTerm}
            />
          }
          filters={
            <>
              <FilterSelect
                label="Alasan"
                allLabel="Semua alasan"
                value={controls.filterValues.reason as FollowUpReason | 'all'}
                options={REASONS.map((reason) => ({
                  value: reason,
                  label: followUpReasonLabel[reason],
                  count: tabRows.filter((item) => item.reason === reason).length,
                }))}
                onChange={(value) => controls.setFilter('reason', value)}
              />
              <FilterSelect
                label="Ditugaskan ke"
                allLabel="Siapa saja"
                value={controls.filterValues.worker}
                options={Array.from(new Set(all.map((item) => item.assignedWorkerId))).map(
                  (id) => ({ value: id, label: users.find((u) => u.id === id)?.name ?? id }),
                )}
                onChange={(value) => controls.setFilter('worker', value)}
              />
            </>
          }
          trailing={
            <ResultCount shown={controls.filtered.length} total={tabRows.length} noun="task" />
          }
        />

        {error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : tabRows.length === 0 ? (
          <EmptyState
            icon={tab === 'overdue' || tab === 'today' ? <CheckCircle2 /> : <CalendarClock />}
            title={emptyCopy[tab].title}
            description={emptyCopy[tab].description}
            action={
              tab === 'upcoming' || tab === 'all' ? (
                <Button variant="primary" size="sm" onClick={() => setScheduleOpen(true)}>
                  Jadwalkan follow-up
                </Button>
              ) : undefined
            }
          />
        ) : controls.filtered.length === 0 ? (
          <NoMatchesState entity="follow-ups" onClear={controls.clearAll} />
        ) : (
          <>
            <DataTable
              caption="Queue follow-up"
              rows={controls.visible}
              columns={columns}
              rowKey={(followUp) => followUp.id}
              sort={controls.sort}
              onSortChange={controls.toggleSort}
              onRowClick={(followUp) => {
                const next = new URLSearchParams(searchParams);
                next.set('focus', followUp.id);
                setSearchParams(next);
              }}
              rowAccent={(followUp) => {
                const bucket = followUpBucket(followUp);
                if (bucket === 'overdue' || bucket === 'unresolved') return 'urgent';
                if (bucket === 'due-today') return 'attention';
                return null;
              }}
              renderMobileCard={(followUp) => {
                const patient = patientsById.get(followUp.patientId);
                const bucket = followUpBucket(followUp);
                return (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-obsidian-900">
                        {patient?.name ?? 'Pasien tidak dikenal'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-obsidian-500">
                        {followUpReasonLabel[followUp.reason]}
                      </p>
                      <p className="mt-1 text-xs text-obsidian-500 tabular">
                        {formatDate(followUp.dueDate)} · {formatDueLabel(followUp.dueDate)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <FollowUpBucketBadge bucket={bucket} size="sm" />
                        {followUp.attempts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-obsidian-100 px-1.5 py-0.5 text-[11px] text-obsidian-600">
                            <PhoneCall aria-hidden className="size-3" />
                            {followUp.attempts.length}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-obsidian-300" />
                  </div>
                );
              }}
            />
            <Pagination
              page={controls.page}
              pageCount={controls.pageCount}
              pageSize={controls.pageSize}
              totalItems={controls.filtered.length}
              onPageChange={controls.setPage}
              onPageSizeChange={controls.setPageSize}
            />
          </>
        )}
      </Card>

      {/* Detail panel */}
      <Dialog
        open={Boolean(focused)}
        onClose={closeFocus}
        size="lg"
        title={focused ? `Follow-up ${focused.code}` : 'Follow-up'}
        description={
          focusedPatient
            ? `${focusedPatient.name} · ${focusedPatient.mrn} · ${focusedPatient.village}, ${focusedPatient.district}`
            : undefined
        }
        footer={
          focused ? (
            <>
              <Button
                variant="ghost"
                leadingIcon={<User className="size-4" />}
                onClick={() => {
                  closeFocus();
                  navigate(`/patients/${focused.patientId}`);
                }}
              >
                Buka data pasien
              </Button>
              {focused.status !== 'completed' ? (
                <>
                  <Button
                    variant="outline"
                    leadingIcon={<CalendarClock className="size-4" />}
                    onClick={() => setRescheduling(focused)}
                  >
                    Jadwalkan ulang
                  </Button>
                  <Button
                    variant="outline"
                    leadingIcon={<PhoneCall className="size-4" />}
                    onClick={() => setAttemptFor(focused)}
                  >
                    Catat percobaan
                  </Button>
                  <Button
                    variant="primary"
                    leadingIcon={<CalendarCheck className="size-4" />}
                    onClick={() => setCompletingFor(focused)}
                  >
                    Selesaikan
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  leadingIcon={<CalendarClock className="size-4" />}
                  onClick={() => setRescheduling(focused)}
                >
                  Buka lagi dengan tanggal baru
                </Button>
              )}
            </>
          ) : null
        }
      >
        {focused ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <FollowUpStatusBadge status={focused.status} />
              <FollowUpBucketBadge bucket={followUpBucket(focused)} />
            </div>

            {focused.unresolvedReason ? (
              <Notice tone="urgent" title="Dicatat sebagai belum terselesaikan">
                {focused.unresolvedReason}
              </Notice>
            ) : null}

            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Alasan">{followUpReasonLabel[focused.reason]}</DetailRow>
              <DetailRow label="Tanggal jatuh tempo">
                {formatDate(focused.dueDate)}
                <span className="ml-1.5 text-obsidian-400">
                  ({formatDueLabel(focused.dueDate).toLowerCase()})
                </span>
              </DetailRow>
              <DetailRow label="Ditugaskan ke">
                {(() => {
                  const worker = users.find((u) => u.id === focused.assignedWorkerId);
                  return worker ? `${worker.name} (${userRoleLabel[worker.role]})` : 'Belum ditugaskan';
                })()}
              </DetailRow>
              <DetailRow label="Telepon pasien">
                {focusedPatient?.phone ?? (
                  <span className="text-attention-800">
                    Belum tercatat, hubungi lewat kader desa
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Referral">
                {focusedReferral ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        closeFocus();
                        navigate(`/referrals?focus=${focusedReferral.id}`);
                      }}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                    >
                      {focusedReferral.code}
                      <ExternalLink aria-hidden className="size-3" />
                    </button>
                    <ReferralStatusBadge status={focusedReferral.status} size="sm" />
                  </span>
                ) : (
                  'Tidak terhubung ke referral'
                )}
              </DetailRow>
              <DetailRow label="Screening">
                {focused.screeningId ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeFocus();
                      navigate(`/screenings/${focused.screeningId}`);
                    }}
                    className="inline-flex items-center gap-1.5 text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                  >
                    Buka hasil screening
                    <ExternalLink aria-hidden className="size-3" />
                  </button>
                ) : (
                  'Tidak terhubung ke screening'
                )}
              </DetailRow>
              {focused.completedAt ? (
                <DetailRow label="Selesai">{formatDateTime(focused.completedAt)}</DetailRow>
              ) : null}
            </dl>

            {/* Contact history */}
            <div className="border-t border-obsidian-100 pt-4">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                <History aria-hidden className="size-3" />
                Percobaan kontak ({focused.attempts.length})
              </h3>
              {focused.attempts.length === 0 ? (
                <p className="mt-2 text-[13px] text-obsidian-500">
                  Belum ada yang mencoba menghubungi pasien ini untuk task ini.
                </p>
              ) : (
                <ol className="mt-2.5 space-y-2.5">
                  {[...focused.attempts].reverse().map((attempt) => (
                    <li key={attempt.id} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className={
                          attempt.outcome === 'reached'
                            ? 'mt-1.5 size-1.5 shrink-0 rounded-full bg-complete-500'
                            : 'mt-1.5 size-1.5 shrink-0 rounded-full bg-attention-500'
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] text-obsidian-900">
                          {contactChannelLabel[attempt.channel]} ·{' '}
                          <span className="text-obsidian-600">
                            {contactOutcomeLabel[attempt.outcome] ?? attempt.outcome}
                          </span>
                        </p>
                        {attempt.note ? (
                          <p className="mt-0.5 text-xs leading-relaxed text-obsidian-600">
                            {attempt.note}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-obsidian-400">
                          {formatDateTime(attempt.at)} ·{' '}
                          {users.find((u) => u.id === attempt.actorId)?.name ?? 'Pengguna tidak dikenal'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {focused.status !== 'completed' && focused.status !== 'unresolved' ? (
              <div className="border-t border-obsidian-100 pt-4">
                <p className="text-[13px] text-obsidian-600">
                  Kalau pasien ini memang tidak bisa di-follow-up, catat alasannya daripada
                  membiarkan task terbuka tanpa batas waktu.
                </p>
                <Button
                  className="mt-2.5"
                  size="sm"
                  variant="outline"
                  leadingIcon={<CircleSlash className="size-3.5" />}
                  onClick={() => setUnresolvedFor(focused)}
                >
                  Tandai belum terselesaikan
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      {/* Schedule a new follow-up */}
      <FollowUpFormDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      {rescheduling ? (
        <FollowUpFormDialog
          open
          onClose={() => setRescheduling(null)}
          patientId={rescheduling.patientId}
          referralId={rescheduling.referralId}
          screeningId={rescheduling.screeningId}
          followUp={rescheduling}
        />
      ) : null}

      {attemptFor ? (
        <ContactAttemptDialog
          open
          onClose={() => setAttemptFor(null)}
          followUp={attemptFor}
        />
      ) : null}

      {completingFor ? (
        <CompleteFollowUpDialog
          open
          onClose={() => setCompletingFor(null)}
          followUp={completingFor}
        />
      ) : null}

      {unresolvedFor ? (
        <UnresolvedFollowUpDialog
          open
          onClose={() => setUnresolvedFor(null)}
          followUp={unresolvedFor}
        />
      ) : null}
    </div>
  );
}
