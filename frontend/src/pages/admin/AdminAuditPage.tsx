import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { EmptyState, NoMatchesState } from '@/components/ui/EmptyState';
import { DataTable, StackedCell, type Column } from '@/components/ui/DataTable';
import { SearchInput, Select } from '@/components/forms/Inputs';
import { useAccountStore } from '@/stores/accountStore';
import type { AuditAction, AuditEntry } from '@/types/account';
import { formatDateTime } from '@/utils/date';
import { AUDIT_LABEL } from './auditLabels';

/**
 * Audit log.
 *
 * Records the operations that change who can do what, or what the public sees:
 * role changes, suspensions, facility edits and publication. Each entry keeps
 * the actor, the subject and a timestamp, because an audit line without an
 * actor answers nothing.
 *
 * The log is written by the server, append-only, and also records reads of
 * patient records and radiographs. A log the client wrote could be skipped by
 * not running the client; this one cannot.
 */
export function AdminAuditPage() {
  const audit = useAccountStore((state) => state.audit);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<AuditAction | 'all'>('all');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return audit
      .filter((entry) => (action === 'all' ? true : entry.action === action))
      .filter((entry) =>
        needle
          ? entry.subject.toLowerCase().includes(needle) ||
            entry.actorName.toLowerCase().includes(needle)
          : true,
      );
  }, [audit, query, action]);

  const columns: Column<AuditEntry>[] = [
    {
      id: 'at',
      header: 'When',
      cell: (entry) => <span className="text-obsidian-600">{formatDateTime(entry.at)}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      cell: (entry) => (
        <StackedCell primary={AUDIT_LABEL[entry.action]} secondary={entry.detail ?? undefined} />
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (entry) => <span className="text-obsidian-700">{entry.subject}</span>,
    },
    {
      id: 'actor',
      header: 'By',
      hideBelow: 'md',
      cell: (entry) => <span className="text-obsidian-600">{entry.actorName}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Role changes, account status and facility edits, with who made them."
      />

      <Notice tone="info" compact>
        Written by the server and append-only: entries cannot be edited or removed. It covers
        administrative changes and also records when a patient's record or X-ray was opened. This
        view shows the most recent 200 entries.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} of ${audit.length} entries`}
          icon={<ScrollText />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Search the audit log"
                value={query}
                onChange={setQuery}
                placeholder="Subject or actor"
              />
              <Select
                aria-label="Filter by action"
                value={action}
                onChange={(event) => setAction(event.target.value as AuditAction | 'all')}
                className="max-w-56"
              >
                <option value="all">All actions</option>
                {(Object.keys(AUDIT_LABEL) as AuditAction[]).map((value) => (
                  <option key={value} value={value}>
                    {AUDIT_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CardBody padded={false}>
          {audit.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<ScrollText />}
                title="Nothing logged yet"
                description="Changing someone's role, suspending an account or editing a facility will add an entry."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState
                entity="entries"
                onClear={() => {
                  setQuery('');
                  setAction('all');
                }}
              />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(entry) => entry.id}
              caption="Administrative actions recorded on this platform"
              renderMobileCard={(entry) => (
                <div className="space-y-1.5">
                  <StackedCell
                    primary={AUDIT_LABEL[entry.action]}
                    secondary={entry.subject}
                  />
                  <p className="text-[12px] text-obsidian-500">
                    {entry.actorName} · {formatDateTime(entry.at)}
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
