import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ListOrdered, RefreshCw } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextInput } from '@/components/forms/Inputs';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { PriorityBadge, ScreeningOutcomeBadge } from '@/components/ui/StatusBadge';
import type { QueueDay, Screening } from '@/types/domain';
import { getQueue, markServed } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { formatAccessCode } from '@/lib/queue';
import { RISK_LABEL, riskOf } from '@/lib/risk';
import { toast } from '@/stores/toastStore';
import { formatDate, formatTime, toISODate } from '@/utils/date';

/** How often the page asks for a fresh queue while it is open. */
const REFRESH_MS = 20_000;

/**
 * The queue: everyone the radiologist has submitted, most urgent first and,
 * within a priority, in the order they were submitted. Whoever calls the next
 * patient marks them here, which moves everyone behind them up, on this page
 * and on each patient's own status page.
 */
export function QueuePage() {
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [data, setData] = useState<QueueDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = (latest.current += 1);
    setRefreshing(true);
    try {
      const next = await getQueue(date || undefined);
      if (ticket !== latest.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (ticket === latest.current) setError(errorMessage(cause, 'Antrean gagal dimuat.'));
    } finally {
      if (ticket === latest.current) setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      high: items.filter((item) => item.queuePriority === 'high').length,
      medium: items.filter((item) => item.queuePriority === 'medium').length,
      low: items.filter((item) => item.queuePriority === 'low').length,
    };
  }, [data]);

  const call = async (item: Screening) => {
    setCalling(item.id);
    try {
      await markServed(item.id);
      toast.success(`${item.queueNumber} dipanggil.`, item.patient?.name);
      await load();
    } catch (cause) {
      toast.error('Belum tercatat dipanggil.', errorMessage(cause));
    } finally {
      setCalling(null);
    }
  };

  const today = toISODate(new Date());
  const isPastDay = Boolean(data && data.date < today);

  const columns: Column<Screening>[] = [
    {
      id: 'order',
      header: 'Urutan',
      width: 'w-16',
      cell: (item) => <span className="font-semibold text-obsidian-950 tabular">{(data?.items.indexOf(item) ?? 0) + 1}</span>,
    },
    {
      id: 'number',
      header: 'No. antrean',
      cell: (item) => <span className="font-mono text-sm font-semibold text-obsidian-950">{item.queueNumber}</span>,
    },
    {
      id: 'patient',
      header: 'Pasien',
      cell: (item) => <StackedCell primary={item.patient?.name ?? '-'} secondary={<MonoCell>{item.patient?.mrn}</MonoCell>} />,
    },
    {
      id: 'priority',
      header: 'Prioritas',
      cell: (item) => (item.queuePriority ? <PriorityBadge priority={item.queuePriority} size="sm" /> : null),
    },
    {
      id: 'model',
      header: 'Hasil model',
      hideBelow: 'lg',
      cell: (item) => {
        if (!item.analysis) return <span className="text-xs text-obsidian-400">Tidak dibaca model</span>;
        const risk = riskOf(item.analysis);
        return (
          <div className="space-y-1">
            <ScreeningOutcomeBadge outcome={item.analysis.outcome} short size="sm" />
            <p className="text-xs text-obsidian-500 tabular">
              Risk point {risk.point} · {RISK_LABEL[risk.level].toLowerCase()}
            </p>
          </div>
        );
      },
    },
    {
      id: 'submitted',
      header: 'Masuk',
      hideBelow: 'md',
      cell: (item) => <span className="text-[13px] text-obsidian-600 tabular">{item.submittedAt ? formatTime(item.submittedAt) : '-'}</span>,
    },
    {
      id: 'call',
      header: '',
      srHeader: 'Panggil',
      align: 'right',
      cell: (item) => (
        <Button
          size="sm"
          variant="primary"
          loading={calling === item.id}
          disabled={calling !== null}
          leadingIcon={<BellRing className="mr-1.5 size-3.5" />}
          onClick={(event) => {
            event.stopPropagation();
            void call(item);
          }}
        >
          Panggil
        </Button>
      ),
    },
  ];

  const servedColumns: Column<Screening>[] = [
    { id: 'number', header: 'No. antrean', cell: (item) => <span className="font-mono text-sm text-obsidian-700">{item.queueNumber}</span> },
    { id: 'patient', header: 'Pasien', cell: (item) => <span className="text-[13px] text-obsidian-700">{item.patient?.name}</span> },
    {
      id: 'priority',
      header: 'Prioritas',
      hideBelow: 'sm',
      cell: (item) => (item.queuePriority ? <PriorityBadge priority={item.queuePriority} size="sm" /> : null),
    },
    {
      id: 'served',
      header: 'Dipanggil',
      align: 'right',
      cell: (item) => <span className="text-[13px] text-obsidian-600 tabular">{item.servedAt ? formatTime(item.servedAt) : '-'}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Antrean"
        description="Pasien yang sudah diperiksa dokter, urut dari yang paling mendesak. Dalam satu prioritas, yang lebih dulu masuk dipanggil lebih dulu."
        meta={
          <>
            {data ? <HeaderMeta label="Tanggal" value={formatDate(data.date)} /> : null}
            <HeaderMeta label="Menunggu" value={data?.items.length ?? 0} />
            <HeaderMeta label="Tinggi" value={counts.high} />
            <HeaderMeta label="Sedang" value={counts.medium} />
            <HeaderMeta label="Rendah" value={counts.low} />
          </>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-[13px] text-obsidian-600">
              <span className="sr-only sm:not-sr-only">Tanggal</span>
              <TextInput
                type="date"
                aria-label="Tanggal antrean"
                value={date || data?.date || ''}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 w-40"
              />
            </label>
            <Button
              leadingIcon={<RefreshCw className={`mr-1.5 size-4 ${refreshing ? 'animate-spin' : ''}`} />}
              onClick={() => void load()}
              disabled={refreshing}
            >
              Segarkan
            </Button>
          </>
        }
      />

      <Card>
        {error && !data ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !data ? (
          <div className="space-y-2 p-4" role="status" aria-label="Memuat antrean">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<ListOrdered />}
            title={isPastDay ? 'Tidak ada yang tersisa di antrean hari itu' : 'Antrean masih kosong'}
            description="Pasien muncul di sini setelah dokter radiologi mengirim hasil pemeriksaannya ke sistem."
          />
        ) : (
          <DataTable
            caption={`Antrean tanggal ${data.date}`}
            rows={data.items}
            columns={columns}
            rowKey={(item) => item.id}
            onRowClick={(item) => navigate(`/screenings/${item.id}`)}
            rowAccent={(item) => (item.queuePriority === 'high' ? 'urgent' : item.queuePriority === 'medium' ? 'attention' : null)}
            renderMobileCard={(item) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-obsidian-950">{item.queueNumber}</span>
                  {item.queuePriority ? <PriorityBadge priority={item.queuePriority} size="sm" /> : null}
                </div>
                <p className="text-sm font-medium text-obsidian-900">{item.patient?.name}</p>
                <p className="text-xs text-obsidian-500">
                  Masuk {item.submittedAt ? formatTime(item.submittedAt) : '-'} · kode {formatAccessCode(item.accessCode)}
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  loading={calling === item.id}
                  disabled={calling !== null}
                  leadingIcon={<BellRing className="mr-1.5 size-3.5" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    void call(item);
                  }}
                >
                  Panggil
                </Button>
              </div>
            )}
          />
        )}
      </Card>

      {data && data.served.length > 0 ? (
        <Card>
          <CardHeader title="Sudah dipanggil" description="Yang terakhir dipanggil di atas." />
          <DataTable
            caption="Pasien yang sudah dipanggil"
            rows={data.served}
            columns={servedColumns}
            rowKey={(item) => item.id}
            onRowClick={(item) => navigate(`/screenings/${item.id}`)}
          />
        </Card>
      ) : null}
    </div>
  );
}
