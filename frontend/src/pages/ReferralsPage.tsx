import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Send,
  User,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/forms/Inputs';
import { FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, NoMatchesState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { ReferralPriorityBadge, ReferralStatusBadge, SyncStateBadge } from '@/components/ui/StatusBadge';
import { ReferralFormDialog } from '@/components/referrals/ReferralFormDialog';
import {
  ReferralHistory,
  ReferralStatusControls,
} from '@/components/referrals/ReferralStatusControls';
import { FollowUpFormDialog } from '@/components/followups/FollowUpFormDialog';
import { useDataStore } from '@/stores/dataStore';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { useTableControls } from '@/hooks/useTableControls';
import { mockApi } from '@/services/mockApi';
import { facilities } from '@/data/facilities';
import { users } from '@/data/users';
import {
  facilityServiceLabel,
  referralPriorityLabel,
  referralStatusLabel,
  userRoleLabel,
} from '@/utils/labels';
import { formatDate, formatDueLabel } from '@/utils/date';
import { formatDistance, formatTravelTime } from '@/utils/format';
import type { Referral, ReferralPriority, ReferralStatus } from '@/types/domain';

/**
 * Referral register.
 *
 * A referral is only useful if somebody chases it, so the table leads with the
 * patient and the destination, and the row opens a panel where the status can
 * actually be moved. Urgent and overdue-looking rows are marked with a rule as
 * well as a badge.
 */

type FilterKey = 'status' | 'priority' | 'facility' | 'worker';

const STATUS_FLOW: ReferralStatus[] = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'attended',
  'followup-required',
  'closed',
];

const OPEN_STATUSES: ReferralStatus[] = [
  'draft',
  'pending',
  'referred',
  'appointment-scheduled',
  'followup-required',
];

export function ReferralsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patients = useDataStore((state) => state.patients);
  const { data: referrals, loading, error, refetch } = useStoreQuery<Referral[]>(
    () => mockApi.getReferrals(),
    () => useDataStore.getState().referrals,
  );

  const allReferrals = referrals ?? [];
  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Referral | null>(null);
  const [followUpFor, setFollowUpFor] = useState<Referral | null>(null);
  const focusId = searchParams.get('focus');

  /** Read the focused referral straight from the store so it stays live. */
  const focused = useDataStore((state) =>
    focusId ? (state.referrals.find((item) => item.id === focusId) ?? null) : null,
  );

  // Drop a stale focus param, e.g. after a demo data reset.
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

  const controls = useTableControls<Referral, FilterKey>({
    rows: allReferrals,
    initialSort: { columnId: 'created', direction: 'desc' },
    search: (referral, term) => {
      const patient = patientsById.get(referral.patientId);
      const destination = facilities.find((f) => f.id === referral.toFacilityId);
      return (
        referral.code.toLowerCase().includes(term) ||
        referral.reason.toLowerCase().includes(term) ||
        (patient?.name.toLowerCase().includes(term) ?? false) ||
        (patient?.mrn.toLowerCase().includes(term) ?? false) ||
        (destination?.name.toLowerCase().includes(term) ?? false)
      );
    },
    filters: {
      status: (referral, value) =>
        value === 'open' ? OPEN_STATUSES.includes(referral.status) : referral.status === value,
      priority: (referral, value) => referral.priority === value,
      facility: (referral, value) => referral.toFacilityId === value,
      worker: (referral, value) => referral.assignedWorkerId === value,
    },
    comparators: {
      code: (a, b) => a.code.localeCompare(b.code),
      patient: (a, b) =>
        (patientsById.get(a.patientId)?.name ?? '').localeCompare(
          patientsById.get(b.patientId)?.name ?? '',
        ),
      created: (a, b) => a.createdAt.localeCompare(b.createdAt),
      appointment: (a, b) => (a.appointmentDate ?? '').localeCompare(b.appointmentDate ?? ''),
      status: (a, b) => STATUS_FLOW.indexOf(a.status) - STATUS_FLOW.indexOf(b.status),
    },
  });

  const openCount = allReferrals.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const urgentCount = allReferrals.filter(
    (r) => r.priority === 'urgent' && OPEN_STATUSES.includes(r.status),
  ).length;

  const columns = useMemo<Column<Referral>[]>(
    () => [
      {
        id: 'patient',
        header: 'Patient',
        sortable: true,
        cell: (referral) => {
          const patient = patientsById.get(referral.patientId);
          return (
            <StackedCell
              primary={patient?.name ?? 'Unknown patient'}
              secondary={patient?.mrn}
            />
          );
        },
      },
      {
        id: 'code',
        header: 'Referral',
        sortable: true,
        width: 'w-28',
        hideBelow: 'lg',
        cell: (referral) => <MonoCell>{referral.code}</MonoCell>,
      },
      {
        id: 'destination',
        header: 'Destination',
        cell: (referral) => {
          const destination = facilities.find((f) => f.id === referral.toFacilityId);
          return (
            <StackedCell
              primary={destination?.name ?? 'Unknown facility'}
              secondary={facilityServiceLabel[referral.requestedService]}
            />
          );
        },
      },
      {
        id: 'created',
        header: 'Created',
        sortable: true,
        width: 'w-28',
        hideBelow: 'xl',
        cell: (referral) => <span className="tabular">{formatDate(referral.createdAt)}</span>,
      },
      {
        id: 'appointment',
        header: 'Appointment',
        sortable: true,
        width: 'w-32',
        hideBelow: 'lg',
        cell: (referral) =>
          referral.appointmentDate ? (
            <span className="tabular">{formatDate(referral.appointmentDate)}</span>
          ) : (
            <span className="text-obsidian-400">Not booked</span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: 'w-48',
        cell: (referral) => <ReferralStatusBadge status={referral.status} size="sm" />,
      },
      {
        id: 'priority',
        header: 'Priority',
        width: 'w-28',
        hideBelow: 'xl',
        cell: (referral) => <ReferralPriorityBadge priority={referral.priority} size="sm" />,
      },
      {
        id: 'worker',
        header: 'Assigned',
        width: 'w-36',
        hideBelow: 'xl',
        cell: (referral) => (
          <span className="truncate text-obsidian-600">
            {users.find((u) => u.id === referral.assignedWorkerId)?.name ?? 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        srHeader: 'Open referral',
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
    [patientsById],
  );

  const focusedPatient = focused ? patientsById.get(focused.patientId) : null;
  const focusedDestination = focused
    ? facilities.find((f) => f.id === focused.toFacilityId)
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Referrals"
        description="Patients escalated to a facility that can confirm or exclude TB, and where each one has got to."
        meta={
          <>
            <HeaderMeta label="Total" value={allReferrals.length} />
            <HeaderMeta label="Open" value={openCount} />
            <HeaderMeta label="Urgent and open" value={urgentCount} />
          </>
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setCreateOpen(true)}
          >
            New referral
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar
          activeFilterCount={controls.activeFilterCount}
          onClearFilters={controls.clearAll}
          search={
            <SearchInput
              label="Search referrals by patient, code, destination or reason"
              placeholder="Patient, code or destination"
              value={controls.term}
              onChange={controls.setTerm}
            />
          }
          filters={
            <>
              <FilterSelect
                label="Status"
                allLabel="Any status"
                value={controls.filterValues.status}
                options={[
                  { value: 'open', label: 'Open only', count: openCount },
                  ...STATUS_FLOW.map((status) => ({
                    value: status,
                    label: referralStatusLabel[status],
                    count: allReferrals.filter((r) => r.status === status).length,
                  })),
                ]}
                onChange={(value) => controls.setFilter('status', value)}
              />
              <FilterSelect
                label="Priority"
                allLabel="Any priority"
                value={controls.filterValues.priority as ReferralPriority | 'all'}
                options={(['urgent', 'soon', 'routine'] as ReferralPriority[]).map((priority) => ({
                  value: priority,
                  label: referralPriorityLabel[priority],
                }))}
                onChange={(value) => controls.setFilter('priority', value)}
              />
              <FilterSelect
                label="Destination"
                allLabel="All destinations"
                value={controls.filterValues.facility}
                options={Array.from(new Set(allReferrals.map((r) => r.toFacilityId))).map(
                  (id) => ({
                    value: id,
                    label: facilities.find((f) => f.id === id)?.name ?? id,
                  }),
                )}
                onChange={(value) => controls.setFilter('facility', value)}
              />
              <FilterSelect
                label="Assigned"
                allLabel="Anyone"
                value={controls.filterValues.worker}
                options={Array.from(new Set(allReferrals.map((r) => r.assignedWorkerId))).map(
                  (id) => ({
                    value: id,
                    label: users.find((u) => u.id === id)?.name ?? id,
                  }),
                )}
                onChange={(value) => controls.setFilter('worker', value)}
              />
            </>
          }
          trailing={
            <ResultCount
              shown={controls.filtered.length}
              total={allReferrals.length}
              noun="referrals"
            />
          }
        />

        {error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : allReferrals.length === 0 ? (
          <EmptyState
            icon={<Send />}
            title="No referrals yet"
            description="Referrals are usually raised from a screening result once a clinician has reviewed the image."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create a referral
              </Button>
            }
          />
        ) : controls.filtered.length === 0 ? (
          <NoMatchesState entity="referrals" onClear={controls.clearAll} />
        ) : (
          <>
            <DataTable
              caption="Referral register"
              rows={controls.visible}
              columns={columns}
              rowKey={(referral) => referral.id}
              sort={controls.sort}
              onSortChange={controls.toggleSort}
              onRowClick={(referral) => {
                const next = new URLSearchParams(searchParams);
                next.set('focus', referral.id);
                setSearchParams(next);
              }}
              rowAccent={(referral) =>
                referral.priority === 'urgent' && OPEN_STATUSES.includes(referral.status)
                  ? 'urgent'
                  : referral.status === 'followup-required'
                    ? 'attention'
                    : null
              }
              renderMobileCard={(referral) => {
                const patient = patientsById.get(referral.patientId);
                const destination = facilities.find((f) => f.id === referral.toFacilityId);
                return (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-obsidian-900">
                        {patient?.name ?? 'Unknown patient'}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-obsidian-500">
                        {referral.code} · {patient?.mrn}
                      </p>
                      <p className="mt-1 truncate text-xs text-obsidian-500">
                        {destination?.name} · {facilityServiceLabel[referral.requestedService]}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ReferralStatusBadge status={referral.status} size="sm" />
                        {referral.priority !== 'routine' ? (
                          <ReferralPriorityBadge priority={referral.priority} size="sm" />
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
        title={focused ? `Referral ${focused.code}` : 'Referral'}
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
                Open patient
              </Button>
              <Button
                variant="outline"
                leadingIcon={<Pencil className="size-4" />}
                onClick={() => setEditing(focused)}
              >
                Edit details
              </Button>
              <Button
                variant="outline"
                leadingIcon={<CalendarClock className="size-4" />}
                onClick={() => setFollowUpFor(focused)}
              >
                Schedule follow-up
              </Button>
            </>
          ) : null
        }
      >
        {focused ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ReferralStatusBadge status={focused.status} />
              <ReferralPriorityBadge priority={focused.priority} />
              <SyncStateBadge state={focused.sync} />
            </div>

            <div className="rounded-md border border-obsidian-200 bg-obsidian-50/70 p-3.5">
              <ReferralStatusControls referral={focused} />
            </div>

            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Destination">
                {focusedDestination?.name ?? 'Unknown facility'}
                {focusedDestination ? (
                  <span className="mt-0.5 block text-xs text-obsidian-500 tabular">
                    {formatDistance(focusedDestination.distanceKm)} ·{' '}
                    {formatTravelTime(focusedDestination.travelTimeMinutes)} travel ·{' '}
                    {focusedDestination.phone}
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow label="Requested">
                {facilityServiceLabel[focused.requestedService]}
              </DetailRow>
              <DetailRow label="Reason">
                <span className="leading-relaxed">{focused.reason}</span>
              </DetailRow>
              <DetailRow label="Created">{formatDate(focused.createdAt)}</DetailRow>
              <DetailRow label="Appointment">
                {focused.appointmentDate ? (
                  <>
                    {formatDate(focused.appointmentDate)}
                    <span className="ml-1.5 text-obsidian-400">
                      ({formatDueLabel(focused.appointmentDate).toLowerCase()})
                    </span>
                  </>
                ) : (
                  'Not booked yet'
                )}
              </DetailRow>
              <DetailRow label="Assigned to">
                {(() => {
                  const worker = users.find((u) => u.id === focused.assignedWorkerId);
                  return worker ? `${worker.name} (${userRoleLabel[worker.role]})` : 'Unassigned';
                })()}
              </DetailRow>
              <DetailRow label="From screening">
                {focused.screeningId ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeFocus();
                      navigate(`/screenings/${focused.screeningId}`);
                    }}
                    className="inline-flex items-center gap-1.5 text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                  >
                    Open screening result
                    <ExternalLink aria-hidden className="size-3" />
                  </button>
                ) : (
                  'Raised without a linked screening'
                )}
              </DetailRow>
            </dl>

            <div className="border-t border-obsidian-100 pt-4">
              <ReferralHistory referral={focused} />
            </div>

            <Notice tone="demo" compact>
              Status changes are stored on this device. The destination facility is not contacted.
            </Notice>
          </div>
        ) : null}
      </Dialog>

      {/* Create */}
      <ReferralFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit */}
      {editing ? (
        <ReferralFormDialog
          open
          onClose={() => setEditing(null)}
          patientId={editing.patientId}
          screeningId={editing.screeningId}
          referral={editing}
        />
      ) : null}

      {/* Follow-up from a referral */}
      {followUpFor ? (
        <FollowUpFormDialog
          open
          onClose={() => setFollowUpFor(null)}
          patientId={followUpFor.patientId}
          referralId={followUpFor.id}
          screeningId={followUpFor.screeningId}
          defaultReason="referral-attendance"
        />
      ) : null}
    </div>
  );
}
