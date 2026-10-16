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
      header: 'Waktu',
      cell: (entry) => <span className="text-obsidian-600">{formatDateTime(entry.at)}</span>,
    },
    {
      id: 'action',
      header: 'Aksi',
      cell: (entry) => (
        <StackedCell primary={AUDIT_LABEL[entry.action]} secondary={entry.detail ?? undefined} />
      ),
    },
    {
      id: 'subject',
      header: 'Subjek',
      cell: (entry) => <span className="text-obsidian-700">{entry.subject}</span>,
    },
    {
      id: 'actor',
      header: 'Oleh',
      hideBelow: 'md',
      cell: (entry) => <span className="text-obsidian-600">{entry.actorName}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Perubahan role, status akun, dan perubahan fasilitas, lengkap dengan siapa yang melakukannya."
      />

      <Notice tone="info" compact>
        Ditulis oleh server dan bersifat append-only: entri tidak bisa diubah atau dihapus. Log ini
        mencakup perubahan administratif dan juga mencatat saat rekam atau X-ray pasien dibuka.
        Tampilan ini menampilkan 200 entri terbaru.
      </Notice>

      <Card>
        <CardHeader
          title={`${rows.length} dari ${audit.length} entri`}
          icon={<ScrollText />}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Cari di audit log"
                value={query}
                onChange={setQuery}
                placeholder="Subjek atau pelaku"
              />
              <Select
                aria-label="Filter berdasarkan aksi"
                value={action}
                onChange={(event) => setAction(event.target.value as AuditAction | 'all')}
                className="max-w-56"
              >
                <option value="all">Semua aksi</option>
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
                title="Belum ada yang tercatat"
                description="Mengubah role seseorang, menangguhkan akun, atau mengubah fasilitas akan menambah entri baru."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <NoMatchesState
                entity="entri"
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
              caption="Aksi administratif yang tercatat di platform ini"
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
