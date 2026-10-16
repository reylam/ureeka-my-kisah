import { useMemo, useState } from 'react';
import { ClipboardList, Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { NoMatchesState } from '@/components/ui/EmptyState';
import { SearchInput, Select } from '@/components/forms/Inputs';
import { ScreeningStatusBadge, SyncStateBadge } from '@/components/ui/StatusBadge';
import { useDataStore } from '@/stores/dataStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { users } from '@/data/users';
import type { Screening, ScreeningStatus } from '@/types/domain';
import { screeningStatusLabel } from '@/utils/labels';
import { formatDateTime } from '@/utils/date';

/**
 * Screening record metadata.
 *
 * Metadata only, and that is the point of the page. An administrator needs to
 * see that a record exists, which facility it came from, whether it is stuck
 * and whether it synchronised. They do not need the radiograph or the clinical
 * assessment, and having administrative access does not make someone qualified
 * to interpret either.
 *
 * So there is no row click through to the image, no analysis output and no
 * patient name: just the record identifier. The columns are the ones you would
 * want at 2am when something has jammed in the queue.
 */
export function AdminScreeningsPage() {
  const screenings = useDataStore((state) => state.screenings);
  const facilities = useFacilityStore((state) => state.facilities);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ScreeningStatus | 'all'>('all');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return screenings
      .filter((item) => (status === 'all' ? true : item.status === status))
      .filter((item) => (needle ? item.id.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  }, [screenings, query, status]);

  const stuck = screenings.filter(
    (item) => item.sync === 'failed' || item.sync === 'conflict',
  ).length;

  const columns: Column<Screening>[] = [
    {
      id: 'id',
      header: 'Record',
      cell: (screening) => <MonoCell>{screening.id}</MonoCell>,
    },
    {
      id: 'performed',
      header: 'Recorded',
      cell: (screening) => (
        <StackedCell
          primary={formatDateTime(screening.performedAt)}
          secondary={screening.createdOffline ? 'Captured offline' : undefined}
        />
      ),
    },
    {
      id: 'facility',
      header: 'Facility',
      hideBelow: 'md',
      cell: (screening) => {
        const facility = facilities.find((item) => item.id === screening.facilityId);
        const operator = users.find((user) => user.id === screening.operatorId);
        return (
          <StackedCell
            primary={facility?.name ?? 'Unknown facility'}
            secondary={operator?.name ?? undefined}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Workflow',
      cell: (screening) => <ScreeningStatusBadge status={screening.status} />,
    },
    {
      id: 'sync',
      header: 'Sync',
      align: 'right',
      cell: (screening) => <SyncStateBadge state={screening.sync} size="sm" />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Screening records"
        description="Record metadata and processing status across every facility."
      />

      <Notice tone="info" compact>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Lock aria-hidden className="size-3.5" />
          Metadata only
        </span>
        <span className="mt-1 block">
          Radiographs, analysis output and clinical assessments stay with the professionals
          assigned to that patient. Administrative access is not clinical access.
        </span>
      </Notice>

      {stuck > 0 ? (
        <Notice tone="attention" compact>
          {stuck} record{stuck === 1 ? '' : 's'} failed to synchronise or has a conflict.
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title={`${rows.length} of ${screenings.length} records`}
          icon={<ClipboardList />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Search by record id"
                value={query}
                onChange={setQuery}
                placeholder="Record id"
              />
              <Select
                aria-label="Filter by workflow status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ScreeningStatus | 'all')}
                className="max-w-52"
              >
                <option value="all">All statuses</option>
                {(Object.keys(screeningStatusLabel) as ScreeningStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {screeningStatusLabel[value]}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CardBody padded={false}>
          {rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState
                entity="records"
                onClear={() => {
                  setQuery('');
                  setStatus('all');
                }}
              />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(screening) => screening.id}
              caption="Screening record metadata and processing status"
              renderMobileCard={(screening) => (
                <div className="space-y-2">
                  <MonoCell>{screening.id}</MonoCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScreeningStatusBadge status={screening.status} size="sm" />
                    <SyncStateBadge state={screening.sync} size="sm" />
                  </div>
                  <p className="text-[12px] text-obsidian-500">
                    {formatDateTime(screening.performedAt)}
                  </p>
                </div>
              )}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
