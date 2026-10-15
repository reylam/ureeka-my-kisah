import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileText, Printer, ScanLine, X } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SearchInput, TextInput } from '@/components/forms/Inputs';
import { FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { DataTable, StackedCell, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, NoMatchesState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { SimulatedResultNotice } from '@/components/ui/Notice';
import {
  ReferralStatusBadge,
  ScreeningOutcomeBadge,
  ScreeningStatusBadge,
} from '@/components/ui/StatusBadge';
import { useDataStore } from '@/stores/dataStore';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { useTableControls } from '@/hooks/useTableControls';
import { mockApi } from '@/services/mockApi';
import { users } from '@/data/users';
import { screeningStatusLabel } from '@/utils/labels';
import { dateOffset, formatDate, toISODate } from '@/utils/date';
import type { Screening, ScreeningOutcome, ScreeningStatus } from '@/types/domain';

/**
 * Screening history and reports.
 *
 * This is the register view: every screening record ever taken at the facility,
 * searchable and filterable, with a direct route to the printable report. The
 * dashboard links into it with a status preset, so arriving here from "awaiting
 * review" lands on exactly those rows.
 */

type FilterKey = 'status' | 'outcome' | 'operator' | 'report';

const STATUSES: ScreeningStatus[] = [
  'draft',
  'queued',
  'awaiting-review',
  'reviewed',
  'referred',
  'closed',
];

const OUTCOMES: ScreeningOutcome[] = ['flagged-for-review', 'no-alert', 'inconclusive'];

const DATE_PRESETS = [
  { value: 'all', label: 'Any date' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;

/** A report can only be produced once there is analysis output to describe. */
function hasReport(screening: Screening): boolean {
  return screening.analysis !== null;
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patients = useDataStore((state) => state.patients);
  const referrals = useDataStore((state) => state.referrals);

  const { data: screenings, loading, error, refetch } = useStoreQuery<Screening[]>(
    () => mockApi.getScreenings(),
    () => useDataStore.getState().screenings,
  );

  const all = screenings ?? [];
  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const referralsById = useMemo(() => new Map(referrals.map((r) => [r.id, r])), [referrals]);

  const [preset, setPreset] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const controls = useTableControls<Screening, FilterKey>({
    rows: all,
    initialSort: { columnId: 'date', direction: 'desc' },
    search: (screening, term) => {
      const patient = patientsById.get(screening.patientId);
      return (
        (patient?.name.toLowerCase().includes(term) ?? false) ||
        (patient?.mrn.toLowerCase().includes(term) ?? false) ||
        (patient?.village.toLowerCase().includes(term) ?? false) ||
        (screening.imageMeta?.fileName.toLowerCase().includes(term) ?? false)
      );
    },
    filters: {
      status: (screening, value) => screening.status === value,
      outcome: (screening, value) => screening.analysis?.outcome === value,
      operator: (screening, value) => screening.operatorId === value,
      report: (screening, value) =>
        value === 'available' ? hasReport(screening) : !hasReport(screening),
    },
    comparators: {
      patient: (a, b) =>
        (patientsById.get(a.patientId)?.name ?? '').localeCompare(
          patientsById.get(b.patientId)?.name ?? '',
        ),
      date: (a, b) => a.performedAt.localeCompare(b.performedAt),
      status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status),
    },
  });

  // The dashboard deep-links with ?status=awaiting-review.
  useEffect(() => {
    const status = searchParams.get('status');
    if (status && STATUSES.includes(status as ScreeningStatus)) {
      controls.setFilter('status', status);
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Date window applied on top of the shared table controls. */
  const dateFiltered = useMemo(() => {
    let rows = controls.filtered;

    if (preset !== 'all') {
      const cutoff = dateOffset(-Number(preset));
      rows = rows.filter((screening) => toISODate(new Date(screening.performedAt)) >= cutoff);
    }
    if (fromDate) {
      rows = rows.filter((screening) => toISODate(new Date(screening.performedAt)) >= fromDate);
    }
    if (toDate) {
      rows = rows.filter((screening) => toISODate(new Date(screening.performedAt)) <= toDate);
    }
    return rows;
  }, [controls.filtered, preset, fromDate, toDate]);

  // Keep pagination honest once the date window has been applied.
  const pageSize = controls.pageSize;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(dateFiltered.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const visible = useMemo(
    () => dateFiltered.slice((page - 1) * pageSize, page * pageSize),
    [dateFiltered, page, pageSize],
  );

  const dateFilterActive = preset !== 'all' || Boolean(fromDate) || Boolean(toDate);
  const clearEverything = () => {
    controls.clearAll();
    setPreset('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const reportsAvailable = all.filter(hasReport).length;

  const columns = useMemo<Column<Screening>[]>(
    () => [
      {
        id: 'patient',
        header: 'Patient',
        sortable: true,
        cell: (screening) => {
          const patient = patientsById.get(screening.patientId);
          return (
            <StackedCell primary={patient?.name ?? 'Unknown patient'} secondary={patient?.mrn} />
          );
        },
      },
      {
        id: 'date',
        header: 'Screened',
        sortable: true,
        width: 'w-32',
        cell: (screening) => (
          <span className="tabular">{formatDate(screening.performedAt)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Review status',
        sortable: true,
        width: 'w-44',
        cell: (screening) => <ScreeningStatusBadge status={screening.status} size="sm" />,
      },
      {
        id: 'outcome',
        header: 'Demo output',
        width: 'w-36',
        hideBelow: 'lg',
        cell: (screening) =>
          screening.analysis ? (
            <ScreeningOutcomeBadge outcome={screening.analysis.outcome} short size="sm" />
          ) : (
            <span className="text-obsidian-400">Not analysed</span>
          ),
      },
      {
        id: 'referral',
        header: 'Referral',
        width: 'w-44',
        hideBelow: 'xl',
        cell: (screening) => {
          const referral = screening.referralId
            ? referralsById.get(screening.referralId)
            : undefined;
          return referral ? (
            <ReferralStatusBadge status={referral.status} size="sm" />
          ) : (
            <span className="text-obsidian-400">None</span>
          );
        },
      },
      {
        id: 'operator',
        header: 'Recorded by',
        width: 'w-36',
        hideBelow: 'xl',
        cell: (screening) => (
          <span className="truncate text-obsidian-600">
            {users.find((u) => u.id === screening.operatorId)?.name ?? 'Unknown'}
          </span>
        ),
      },
      {
        id: 'report',
        header: 'Report',
        width: 'w-28',
        cell: (screening) =>
          hasReport(screening) ? (
            <Badge tone="neutral" size="sm" icon={<FileText />}>
              Available
            </Badge>
          ) : (
            <span className="text-obsidian-400">Pending</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        srHeader: 'Actions',
        align: 'right',
        width: 'w-24',
        cell: (screening) => (
          <div className="flex items-center justify-end gap-1">
            {hasReport(screening) ? (
              <IconButton
                size="sm"
                label="Open the printable report"
                icon={<Printer className="size-3.5" />}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/screenings/${screening.id}/report`);
                }}
              />
            ) : null}
            <ChevronRight
              aria-hidden
              className="size-4 text-obsidian-300 transition-colors group-hover:text-obsidian-500"
            />
          </div>
        ),
      },
    ],
    [patientsById, referralsById, navigate],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Every screening record taken at this facility, with a printable report once analysis output exists."
        meta={
          <>
            <HeaderMeta label="Records" value={all.length} />
            <HeaderMeta label="Reports available" value={reportsAvailable} />
            <HeaderMeta
              label="Awaiting review"
              value={all.filter((s) => s.status === 'awaiting-review').length}
            />
          </>
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<ScanLine className="size-4" />}
            onClick={() => navigate('/screenings/new')}
          >
            New screening
          </Button>
        }
      />

      <SimulatedResultNotice variant="compact" />

      <Card className="overflow-hidden">
        <Toolbar
          activeFilterCount={controls.activeFilterCount + (dateFilterActive ? 1 : 0)}
          onClearFilters={clearEverything}
          search={
            <SearchInput
              label="Search screening records by patient, record number or file name"
              placeholder="Patient, record no. or file"
              value={controls.term}
              onChange={controls.setTerm}
            />
          }
          filters={
            <>
              <FilterSelect
                label="Status"
                allLabel="Any status"
                value={controls.filterValues.status as ScreeningStatus | 'all'}
                options={STATUSES.map((status) => ({
                  value: status,
                  label: screeningStatusLabel[status],
                  count: all.filter((s) => s.status === status).length,
                }))}
                onChange={(value) => controls.setFilter('status', value)}
              />
              <FilterSelect
                label="Output"
                allLabel="Any output"
                value={controls.filterValues.outcome as ScreeningOutcome | 'all'}
                options={OUTCOMES.map((outcome) => ({
                  value: outcome,
                  label:
                    outcome === 'flagged-for-review'
                      ? 'Flagged'
                      : outcome === 'no-alert'
                        ? 'No alert'
                        : 'Inconclusive',
                  count: all.filter((s) => s.analysis?.outcome === outcome).length,
                }))}
                onChange={(value) => controls.setFilter('outcome', value)}
              />
              <FilterSelect
                label="Report"
                allLabel="Any"
                value={controls.filterValues.report}
                options={[
                  { value: 'available', label: 'Available', count: reportsAvailable },
                  { value: 'pending', label: 'Pending', count: all.length - reportsAvailable },
                ]}
                onChange={(value) => controls.setFilter('report', value)}
              />
              <FilterSelect
                label="Recorded by"
                allLabel="Anyone"
                value={controls.filterValues.operator}
                options={Array.from(new Set(all.map((s) => s.operatorId))).map((id) => ({
                  value: id,
                  label: users.find((u) => u.id === id)?.name ?? id,
                }))}
                onChange={(value) => controls.setFilter('operator', value)}
              />
            </>
          }
          trailing={
            <ResultCount shown={dateFiltered.length} total={all.length} noun="records" />
          }
        />

        {/* Date window, given its own row so the main bar stays one line */}
        <div className="flex flex-wrap items-center gap-2 border-b border-obsidian-200 bg-obsidian-50/60 px-3 py-2 sm:px-4">
          <span className="text-xs text-obsidian-500">Screening date</span>
          <div className="flex items-center gap-1 rounded-md bg-white p-0.5 ring-1 ring-obsidian-200">
            {DATE_PRESETS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setPreset(item.value);
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
                aria-pressed={preset === item.value && !fromDate && !toDate}
                className={
                  preset === item.value && !fromDate && !toDate
                    ? 'rounded bg-obsidian-950 px-2 py-1 text-[11px] font-medium text-white'
                    : 'rounded px-2 py-1 text-[11px] font-medium text-obsidian-600 transition-colors hover:bg-obsidian-100'
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor="reports-from">
              From date
            </label>
            <TextInput
              id="reports-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPreset('all');
                setPage(1);
              }}
              className="h-8 w-auto text-[13px]"
            />
            <span aria-hidden className="text-xs text-obsidian-400">
              to
            </span>
            <label className="sr-only" htmlFor="reports-to">
              To date
            </label>
            <TextInput
              id="reports-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value);
                setPreset('all');
                setPage(1);
              }}
              className="h-8 w-auto text-[13px]"
            />
            {dateFilterActive ? (
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<X className="size-3.5" />}
                onClick={() => {
                  setPreset('all');
                  setFromDate('');
                  setToDate('');
                  setPage(1);
                }}
              >
                Reset dates
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : loading ? (
          <TableSkeleton rows={10} columns={6} />
        ) : all.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No screening records yet"
            description="Records appear here as soon as a screening is submitted."
            action={
              <Button variant="primary" onClick={() => navigate('/screenings/new')}>
                Record a screening
              </Button>
            }
          />
        ) : dateFiltered.length === 0 ? (
          <NoMatchesState entity="records" onClear={clearEverything} />
        ) : (
          <>
            <DataTable
              caption="Screening history"
              rows={visible}
              columns={columns}
              rowKey={(screening) => screening.id}
              sort={controls.sort}
              onSortChange={controls.toggleSort}
              onRowClick={(screening) => navigate(`/screenings/${screening.id}`)}
              rowAccent={(screening) =>
                screening.status === 'awaiting-review' ? 'attention' : null
              }
              renderMobileCard={(screening) => {
                const patient = patientsById.get(screening.patientId);
                return (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-obsidian-900">
                        {patient?.name ?? 'Unknown patient'}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-obsidian-500">
                        {patient?.mrn}
                      </p>
                      <p className="mt-1 text-xs text-obsidian-500 tabular">
                        {formatDate(screening.performedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ScreeningStatusBadge status={screening.status} size="sm" />
                        {screening.analysis ? (
                          <ScreeningOutcomeBadge
                            outcome={screening.analysis.outcome}
                            short
                            size="sm"
                          />
                        ) : null}
                      </div>
                    </div>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-obsidian-300" />
                  </div>
                );
              }}
            />
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              totalItems={dateFiltered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                controls.setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
