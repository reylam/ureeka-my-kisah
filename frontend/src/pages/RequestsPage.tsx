import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, FileText, Plus, RefreshCw, ScanLine, Trash2, UserCheck } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { Skeleton } from '@/components/ui/Skeleton';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/Inputs';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { ScreeningStatusBadge } from '@/components/ui/StatusBadge';
import { AccessCodeCard } from '@/components/screening/AccessCodeCard';
import { PatientChooser, usePatientChooser } from '@/components/patients/PatientChooser';
import { draftFromApplicant } from '@/components/patients/patientDraft';
import { useStaffNames } from '@/hooks/useStaffNames';
import type { Screening } from '@/types/domain';
import { cancelRequest, createRequest, listScreenings, setRequestPatient } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { formatAccessCode } from '@/lib/queue';
import { useCurrentAccount } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { formatDate, formatTime, isToday } from '@/utils/date';
import { sexLabel } from '@/utils/labels';

const REFRESH_MS = 20_000;

/**
 * Pendaftaran: everyone who has asked for an X-ray and not yet been submitted
 * to the queue, oldest first.
 *
 *   Admin        saves the person behind a request from the public form (as a
 *                new patient, or as one already on file), registers walk-ins
 *                at the desk, and cancels duplicates or no-shows.
 *   Radiologist  saves the patient too when needed, and opens a request to
 *                examine it.
 *
 * Requests arrive from the public form at any time, so the list refreshes
 * itself while it is open.
 */
export function RequestsPage() {
  const account = useCurrentAccount();
  const navigate = useNavigate();
  const staffName = useStaffNames();
  const isAdmin = account?.role === 'admin';

  const [items, setItems] = useState<Screening[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<Screening | null>(null);
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState<Screening | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = (latest.current += 1);
    setRefreshing(true);
    try {
      const page = await listScreenings({ status: ['waiting', 'examining'], pageSize: 200 });
      if (ticket !== latest.current) return;
      setItems([...page.items].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)));
      setError(null);
    } catch (cause) {
      if (ticket === latest.current) setError(errorMessage(cause, 'Daftar pendaftaran gagal dimuat.'));
    } finally {
      if (ticket === latest.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(() => {
    const list = items ?? [];
    return {
      waiting: list.filter((item) => item.status === 'waiting').length,
      examining: list.filter((item) => item.status === 'examining').length,
      unsaved: list.filter((item) => !item.patient).length,
    };
  }, [items]);

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await cancelRequest(cancelling.id);
      toast.success('Pendaftaran dibatalkan.');
      setCancelling(null);
      void load();
    } catch (cause) {
      toast.error('Pendaftaran belum dibatalkan.', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Screening>[] = [
    {
      id: 'time',
      header: 'Daftar',
      width: 'w-24',
      cell: (item) => (
        <StackedCell
          primary={<span className="tabular">{formatTime(item.requestedAt)}</span>}
          secondary={isToday(item.requestDate) ? 'Hari ini' : formatDate(item.requestDate)}
        />
      ),
    },
    {
      id: 'person',
      header: 'Pasien',
      cell: (item) => <PersonCell item={item} />,
    },
    {
      id: 'complaint',
      header: 'Keluhan',
      hideBelow: 'lg',
      cell: (item) => <span className="line-clamp-2 text-[13px] text-obsidian-600">{item.complaint || '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => (
        <div className="space-y-1">
          <ScreeningStatusBadge status={item.status} size="sm" />
          {item.status === 'examining' ? <p className="text-xs text-obsidian-500">{staffName(item.operatorId)}</p> : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'Kode akses',
      hideBelow: 'md',
      cell: (item) => <MonoCell>{formatAccessCode(item.accessCode)}</MonoCell>,
    },
    {
      id: 'actions',
      header: '',
      srHeader: 'Tindakan',
      align: 'right',
      cell: (item) => renderActions(item),
    },
  ];

  function renderActions(item: Screening) {
    const mine = item.status === 'examining' && item.operatorId === account?.id;
    const takenByOther = item.status === 'examining' && !mine;
    return (
      <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
        {!item.patient ? (
          <Button size="sm" variant={isAdmin ? 'primary' : 'outline'} leadingIcon={<UserCheck className="mr-1.5 size-4" />} onClick={() => setSaving(item)}>
            Simpan data pasien
          </Button>
        ) : null}
        {account?.role === 'radiologist' && item.patient && !takenByOther ? (
          <Button
            size="sm"
            variant="primary"
            leadingIcon={<ScanLine className="mr-1.5 size-4" />}
            onClick={() => navigate(`/screenings/${item.id}/examine`)}
          >
            {mine ? 'Lanjutkan' : 'Periksa'}
          </Button>
        ) : null}
        {isAdmin && item.status === 'waiting' ? (
          <Button size="sm" variant="ghost" aria-label="Batalkan pendaftaran" onClick={() => setCancelling(item)}>
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pendaftaran"
        description={
          isAdmin
            ? 'Permintaan rontgen yang belum masuk antrean. Simpan data pasien dari formulir publik, atau daftarkan pasien yang datang langsung.'
            : 'Permintaan rontgen yang belum masuk antrean. Buka satu untuk memeriksa rontgen dan mengisi data pasiennya.'
        }
        meta={
          <>
            <HeaderMeta label="Menunggu" value={counts.waiting} />
            <HeaderMeta label="Sedang diperiksa" value={counts.examining} />
            <HeaderMeta label="Data belum disimpan" value={counts.unsaved} />
          </>
        }
        actions={
          <>
            <Button
              leadingIcon={<RefreshCw className={`mr-1.5 size-4 ${refreshing ? 'animate-spin' : ''}`} />}
              onClick={() => void load()}
              disabled={refreshing}
            >
              Segarkan
            </Button>
            <Button variant="primary" leadingIcon={<Plus className="mr-1.5 size-4" />} onClick={() => setRegistering(true)}>
              Daftarkan pasien
            </Button>
          </>
        }
      />

      <Card>
        {error && !items ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !items ? (
          <div className="space-y-2 p-4" role="status" aria-label="Memuat pendaftaran">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Belum ada pendaftaran"
            description="Pendaftaran dari formulir publik dan dari meja pendaftaran muncul di sini."
          />
        ) : (
          <DataTable
            caption="Pendaftaran yang belum masuk antrean"
            rows={items}
            columns={columns}
            rowKey={(item) => item.id}
            rowAccent={(item) => (!item.patient ? 'attention' : null)}
            renderMobileCard={(item) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <PersonCell item={item} />
                  <ScreeningStatusBadge status={item.status} size="sm" />
                </div>
                <p className="text-xs text-obsidian-500">
                  Daftar {formatTime(item.requestedAt)} · kode {formatAccessCode(item.accessCode)}
                </p>
                {item.complaint ? <p className="text-[13px] text-obsidian-600">{item.complaint}</p> : null}
                {renderActions(item)}
              </div>
            )}
          />
        )}
      </Card>

      {saving ? (
        <SavePatientDialog
          request={saving}
          onClose={() => setSaving(null)}
          onSaved={() => {
            setSaving(null);
            void load();
          }}
        />
      ) : null}

      {registering ? (
        <RegisterDialog
          onClose={() => {
            setRegistering(false);
            void load();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={() => void cancel()}
        loading={busy}
        tone="danger"
        title="Batalkan pendaftaran ini?"
        confirmLabel="Batalkan pendaftaran"
        cancelLabel="Kembali"
        description={
          cancelling
            ? `${cancelling.patient?.name ?? cancelling.applicant?.name ?? 'Pasien'} · kode ${formatAccessCode(cancelling.accessCode)}. Kodenya tidak bisa dipakai lagi.`
            : undefined
        }
      />
    </div>
  );
}

function PersonCell({ item }: { item: Screening }) {
  if (item.patient) {
    return <StackedCell primary={item.patient.name} secondary={<MonoCell>{item.patient.mrn}</MonoCell>} />;
  }
  return (
    <StackedCell
      primary={item.applicant?.name ?? 'Tanpa nama'}
      secondary={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge tone="attention" size="sm" icon={<FileText />}>
            Dari formulir
          </Badge>
          {item.applicant?.sex ? sexLabel[item.applicant.sex] : null}
          {item.applicant?.birthDate ? ` · lahir ${formatDate(item.applicant.birthDate)}` : null}
        </span>
      }
    />
  );
}

/** Save the person behind a request: someone already on file, or a new patient. */
function SavePatientDialog({ request, onClose, onSaved }: { request: Screening; onClose: () => void; onSaved: () => void }) {
  const chooser = usePatientChooser({
    draft: request.applicant ? draftFromApplicant(request.applicant) : undefined,
    query: request.applicant?.name ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const patient = await chooser.resolve();
      if (!patient) {
        if (chooser.mode === 'existing') setFailure('Pilih pasiennya, atau simpan sebagai pasien baru.');
        return;
      }
      await setRequestPatient(request.id, patient.id);
      toast.success('Data pasien tersimpan.', `${patient.name} · ${patient.mrn}`);
      onSaved();
    } catch (cause) {
      setFailure(errorMessage(cause, 'Data pasien belum tersimpan.'));
    } finally {
      setSaving(false);
    }
  };

  const applicant = request.applicant;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Simpan data pasien"
      description="Cari dulu apakah pasien ini sudah pernah tercatat, supaya riwayat rontgennya tidak terpecah."
      size="lg"
      dismissOnOverlayClick={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {applicant ? (
          <Notice tone="info" title="Yang diisi pasien di formulir">
            {applicant.name}
            {applicant.sex ? ` · ${sexLabel[applicant.sex]}` : ''}
            {applicant.birthDate ? ` · lahir ${formatDate(applicant.birthDate)}` : ''}
            {applicant.phone ? ` · ${applicant.phone}` : ''}
            {applicant.address ? ` · ${applicant.address}` : ''}
            {request.complaint ? <span className="mt-1 block">Keluhan: {request.complaint}</span> : null}
          </Notice>
        ) : null}
        {failure ? (
          <Notice tone="urgent" compact>
            {failure}
          </Notice>
        ) : null}
        <PatientChooser state={chooser} disabled={saving} />
      </div>
    </Dialog>
  );
}

/** A walk-in registered at the desk: the patient, the complaint, and the code to hand them. */
function RegisterDialog({ onClose }: { onClose: () => void }) {
  const chooser = usePatientChooser();
  const [complaint, setComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<Screening | null>(null);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const patient = await chooser.resolve();
      if (!patient) {
        if (chooser.mode === 'existing') setFailure('Pilih pasiennya, atau simpan sebagai pasien baru.');
        return;
      }
      setCreated(await createRequest(patient.id, complaint.trim()));
    } catch (cause) {
      setFailure(errorMessage(cause, 'Pendaftaran belum tersimpan.'));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Pasien terdaftar"
        description={`${created.patient?.name ?? ''} sudah masuk daftar tunggu pemeriksaan.`}
        footer={
          <Button variant="primary" onClick={onClose}>
            Selesai
          </Button>
        }
      >
        <AccessCodeCard screening={created} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Daftarkan pasien"
      description="Untuk pasien yang datang langsung tanpa mengisi formulir. Pasien mendapat kode akses yang sama seperti dari formulir."
      size="lg"
      dismissOnOverlayClick={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            Daftarkan
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {failure ? (
          <Notice tone="urgent" compact>
            {failure}
          </Notice>
        ) : null}
        <PatientChooser state={chooser} disabled={saving} />
        <Field label="Keluhan" optional>
          {({ id, describedBy }) => (
            <TextArea
              id={id}
              rows={2}
              maxLength={1000}
              value={complaint}
              disabled={saving}
              describedBy={describedBy}
              onChange={(event) => setComplaint(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
