import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, UserPlus, Users } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SearchInput } from '@/components/forms/Inputs';
import { DataTable, MonoCell, StackedCell, type Column } from '@/components/ui/DataTable';
import { PatientFields } from '@/components/patients/PatientFields';
import {
  EMPTY_PATIENT_DRAFT,
  patientInputFromDraft,
  validatePatientDraft,
  type PatientDraft,
  type PatientDraftErrors,
} from '@/components/patients/patientDraft';
import type { Patient } from '@/types/domain';
import { createPatient, listPatients, type Page } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { toast } from '@/stores/toastStore';
import { ageFromBirthDate, formatDate } from '@/utils/date';
import { sexLabel } from '@/utils/labels';

const PAGE_SIZE = 25;

/**
 * Patients, for the administrator.
 *
 * Two jobs: save a patient's data, and open a patient to check their X-ray
 * history. Everything else a patient list usually carries is deliberately not
 * here.
 */
export function PatientsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<Patient> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(params.get('tambah') === '1');
  const [draft, setDraft] = useState<PatientDraft>(EMPTY_PATIENT_DRAFT);
  const [errors, setErrors] = useState<PatientDraftErrors>({});
  const [saving, setSaving] = useState(false);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await listPatients({ q: debounced || undefined, page, pageSize: PAGE_SIZE }));
    } catch (cause) {
      setError(errorMessage(cause, 'Data pasien gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }, [debounced, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setDraft(EMPTY_PATIENT_DRAFT);
    setErrors({});
    setCreating(true);
  };

  const closeCreate = () => {
    setCreating(false);
    if (params.has('tambah')) {
      params.delete('tambah');
      setParams(params, { replace: true });
    }
  };

  const save = async () => {
    const found = validatePatientDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const patient = await createPatient(patientInputFromDraft(draft));
      toast.success('Data pasien tersimpan.', `${patient.name} · ${patient.mrn}`);
      closeCreate();
      navigate(`/patients/${patient.id}`);
    } catch (cause) {
      toast.error('Data pasien belum tersimpan.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Patient>[] = [
    {
      id: 'name',
      header: 'Pasien',
      cell: (patient) => <StackedCell primary={patient.name} secondary={<MonoCell>{patient.mrn}</MonoCell>} />,
    },
    {
      id: 'person',
      header: 'Usia · jenis kelamin',
      hideBelow: 'sm',
      cell: (patient) => (
        <span className="text-[13px] text-obsidian-700">
          {ageFromBirthDate(patient.birthDate)} th · {sexLabel[patient.sex]}
        </span>
      ),
    },
    {
      id: 'place',
      header: 'Alamat',
      hideBelow: 'lg',
      cell: (patient) => (
        <span className="line-clamp-1 text-[13px] text-obsidian-600">{patient.address || '-'}</span>
      ),
    },
    {
      id: 'registered',
      header: 'Terdaftar',
      hideBelow: 'md',
      cell: (patient) => (
        <span className="text-[13px] text-obsidian-600 tabular">{formatDate(patient.createdAt)}</span>
      ),
    },
    {
      id: 'open',
      header: '',
      srHeader: 'Buka riwayat rontgen',
      align: 'right',
      width: 'w-10',
      cell: () => <ChevronRight aria-hidden className="size-4 text-obsidian-400" />,
    },
  ];

  const total = result?.meta?.total ?? 0;
  const pageCount = result?.meta?.pageCount ?? 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pasien"
        description="Simpan data pasien, lalu buka salah satunya untuk melihat riwayat rontgennya."
        meta={<HeaderMeta label="Terdaftar" value={total} />}
        actions={
          <Button variant="primary" leadingIcon={<UserPlus className="mr-1.5 size-4" />} onClick={openCreate}>
            Tambah pasien
          </Button>
        }
      />

      <SearchInput
        label="Cari pasien"
        placeholder="Cari nama, nomor rekam medis, atau telepon"
        value={query}
        onChange={setQuery}
        className="max-w-md"
      />

      <Card>
        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : loading && !result ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : result && result.items.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={debounced ? 'Tidak ada pasien yang cocok' : 'Belum ada pasien'}
            description={
              debounced
                ? 'Coba nama lain atau nomor rekam medisnya.'
                : 'Tambahkan pasien pertama. Datanya dipakai dokter saat screening.'
            }
            action={
              debounced ? undefined : (
                <Button variant="primary" onClick={openCreate}>
                  Tambah pasien
                </Button>
              )
            }
          />
        ) : (
          <DataTable
            caption="Daftar pasien"
            rows={result?.items ?? []}
            columns={columns}
            rowKey={(patient) => patient.id}
            onRowClick={(patient) => navigate(`/patients/${patient.id}`)}
            renderMobileCard={(patient) => (
              <div className="flex items-center justify-between gap-3">
                <StackedCell
                  primary={patient.name}
                  secondary={
                    <span className="text-xs text-obsidian-500">
                      {patient.mrn} · {sexLabel[patient.sex]}
                    </span>
                  }
                />
                <ChevronRight aria-hidden className="size-4 shrink-0 text-obsidian-400" />
              </div>
            )}
          />
        )}
      </Card>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-[13px] text-obsidian-600">
          <span className="tabular">
            Halaman {page} dari {pageCount}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
              Sebelumnya
            </Button>
            <Button size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={creating}
        onClose={closeCreate}
        title="Tambah pasien"
        description="Data ini disimpan dan dipakai dokter saat screening."
        size="lg"
        dismissOnOverlayClick={!saving}
        footer={
          <>
            <Button variant="ghost" onClick={closeCreate} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              Simpan pasien
            </Button>
          </>
        }
      >
        <PatientFields
          draft={draft}
          errors={errors}
          disabled={saving}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />
      </Dialog>
    </div>
  );
}
