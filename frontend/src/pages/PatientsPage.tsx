import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ScanLine, UserPlus, Users } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/forms/Inputs';
import { FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, NoMatchesState, ErrorState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import {
  FollowUpBucketBadge,
  ReferralStatusBadge,
  ScreeningStatusBadge,
} from '@/components/ui/StatusBadge';
import { useDataStore } from '@/stores/dataStore';
import { buildPatientRows, type PatientRow } from '@/stores/selectors';
import { useStoreQuery } from '@/hooks/useStoreQuery';
import { useTableControls } from '@/hooks/useTableControls';
import { mockApi } from '@/services/mockApi';
import { formatDate } from '@/utils/date';
import { sexLabel, screeningStatusLabel, followUpStatusLabel } from '@/utils/labels';
import type { FollowUpStatus, ScreeningStatus } from '@/types/domain';
import { DISTRICTS } from '@/data/geography';

/**
 * Patient directory.
 *
 * The table joins each patient to their latest screening, referral and
 * follow-up state, so a health worker can see who needs chasing without
 * opening records one at a time.
 */

type FilterKey = 'screening' | 'followup' | 'district';

const SCREENING_OPTIONS: { value: ScreeningStatus; label: string }[] = (
  [
    'draft',
    'queued',
    'awaiting-review',
    'reviewed',
    'referred',
    'closed',
  ] as ScreeningStatus[]
).map((value) => ({ value, label: screeningStatusLabel[value] }));

const FOLLOWUP_OPTIONS: { value: FollowUpStatus; label: string }[] = (
  ['scheduled', 'in-progress', 'completed', 'unresolved'] as FollowUpStatus[]
).map((value) => ({ value, label: followUpStatusLabel[value] }));

export function PatientsPage() {
  const navigate = useNavigate();

  const { data: rows, loading, error, refetch } = useStoreQuery<PatientRow[]>(
    () => mockApi.getPatientRows(),
    () => {
      const state = useDataStore.getState();
      return buildPatientRows(state.patients, state.screenings, state.referrals, state.followUps);
    },
  );

  const allRows = rows ?? [];

  const controls = useTableControls<PatientRow, FilterKey>({
    rows: allRows,
    initialSort: { columnId: 'lastScreening', direction: 'desc' },
    search: (row, term) =>
      row.patient.name.toLowerCase().includes(term) ||
      row.patient.mrn.toLowerCase().includes(term) ||
      row.patient.village.toLowerCase().includes(term),
    filters: {
      screening: (row, value) => row.lastScreeningStatus === value,
      followup: (row, value) => row.followUpStatus === value,
      district: (row, value) => row.patient.district === value,
    },
    comparators: {
      name: (a, b) => a.patient.name.localeCompare(b.patient.name),
      age: (a, b) => a.age - b.age,
      lastScreening: (a, b) =>
        (a.lastScreeningAt ?? '').localeCompare(b.lastScreeningAt ?? ''),
      screenings: (a, b) => a.screeningCount - b.screeningCount,
    },
  });

  const columns = useMemo<Column<PatientRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Patient',
        sortable: true,
        cell: (row) => (
          <StackedCell
            primary={row.patient.name}
            secondary={`${row.patient.village}, ${row.patient.district}`}
          />
        ),
      },
      {
        id: 'mrn',
        header: 'Record no.',
        width: 'w-36',
        hideBelow: 'lg',
        cell: (row) => <MonoCell>{row.patient.mrn}</MonoCell>,
      },
      {
        id: 'age',
        header: 'Age',
        sortable: true,
        align: 'right',
        width: 'w-20',
        cell: (row) => (
          <span className="tabular">
            {row.age}
            <span className="ml-1 text-obsidian-400">{sexLabel[row.patient.sex][0]}</span>
          </span>
        ),
      },
      {
        id: 'lastScreening',
        header: 'Last screening',
        sortable: true,
        width: 'w-32',
        cell: (row) =>
          row.lastScreeningAt ? (
            <span className="tabular">{formatDate(row.lastScreeningAt)}</span>
          ) : (
            <span className="text-obsidian-400">Never</span>
          ),
      },
      {
        id: 'screeningStatus',
        header: 'Screening',
        width: 'w-44',
        cell: (row) =>
          row.lastScreeningStatus ? (
            <ScreeningStatusBadge status={row.lastScreeningStatus} size="sm" />
          ) : (
            <span className="text-obsidian-400">None</span>
          ),
      },
      {
        id: 'referral',
        header: 'Referral',
        width: 'w-44',
        hideBelow: 'xl',
        cell: (row) =>
          row.referralStatus ? (
            <ReferralStatusBadge status={row.referralStatus} size="sm" />
          ) : (
            <span className="text-obsidian-400">None</span>
          ),
      },
      {
        id: 'followup',
        header: 'Follow-up',
        width: 'w-32',
        cell: (row) =>
          row.followUpBucket ? (
            <FollowUpBucketBadge bucket={row.followUpBucket} size="sm" />
          ) : (
            <span className="text-obsidian-400">None</span>
          ),
      },
      {
        id: 'open',
        header: '',
        srHeader: 'Open record',
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
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patients"
        description="Everyone registered at this facility, with their latest screening and follow-up state."
        meta={
          <>
            <HeaderMeta label="Registered" value={allRows.length} />
            <HeaderMeta
              label="With overdue follow-up"
              value={allRows.filter((row) => row.hasOverdueFollowUp).length}
            />
          </>
        }
        actions={
          <Button
            variant="primary"
            leadingIcon={<UserPlus className="size-4" />}
            onClick={() => navigate('/screenings/new')}
          >
            Register &amp; screen
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar
          activeFilterCount={controls.activeFilterCount}
          onClearFilters={controls.clearAll}
          search={
            <SearchInput
              label="Search patients by name, record number or village"
              placeholder="Name, record no. or village"
              value={controls.term}
              onChange={controls.setTerm}
            />
          }
          filters={
            <>
              <FilterSelect
                label="Screening"
                allLabel="Any screening status"
                value={controls.filterValues.screening as ScreeningStatus | 'all'}
                options={SCREENING_OPTIONS}
                onChange={(value) => controls.setFilter('screening', value)}
              />
              <FilterSelect
                label="Follow-up"
                allLabel="Any follow-up"
                value={controls.filterValues.followup as FollowUpStatus | 'all'}
                options={FOLLOWUP_OPTIONS}
                onChange={(value) => controls.setFilter('followup', value)}
              />
              <FilterSelect
                label="District"
                allLabel="All districts"
                value={controls.filterValues.district}
                options={DISTRICTS.map((district) => ({ value: district, label: district }))}
                onChange={(value) => controls.setFilter('district', value)}
              />
            </>
          }
          trailing={
            <ResultCount shown={controls.filtered.length} total={allRows.length} noun="patients" />
          }
        />

        {error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : allRows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No patients registered yet"
            description="Patients are created as part of recording a screening."
            action={
              <Button
                variant="primary"
                leadingIcon={<ScanLine className="size-4" />}
                onClick={() => navigate('/screenings/new')}
              >
                Start a screening
              </Button>
            }
          />
        ) : controls.filtered.length === 0 ? (
          <NoMatchesState entity="patients" onClear={controls.clearAll} />
        ) : (
          <>
            <DataTable
              caption="Patient directory"
              rows={controls.visible}
              columns={columns}
              rowKey={(row) => row.patient.id}
              sort={controls.sort}
              onSortChange={controls.toggleSort}
              onRowClick={(row) => navigate(`/patients/${row.patient.id}`)}
              rowAccent={(row) => (row.hasOverdueFollowUp ? 'urgent' : null)}
              renderMobileCard={(row) => (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-obsidian-900">
                      {row.patient.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-obsidian-500">
                      {row.patient.mrn}
                    </p>
                    <p className="mt-1 text-xs text-obsidian-500">
                      {row.age} yrs · {sexLabel[row.patient.sex]} · {row.patient.village}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.lastScreeningStatus ? (
                        <ScreeningStatusBadge status={row.lastScreeningStatus} size="sm" />
                      ) : null}
                      {row.followUpBucket ? (
                        <FollowUpBucketBadge bucket={row.followUpBucket} size="sm" />
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-obsidian-300" />
                </div>
              )}
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
    </div>
  );
}
