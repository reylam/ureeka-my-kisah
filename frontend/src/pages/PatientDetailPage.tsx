import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Images, Pencil } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PatientFields } from '@/components/patients/PatientFields';
import {
  draftFromPatient,
  patientInputFromDraft,
  validatePatientDraft,
  type PatientDraft,
  type PatientDraftErrors,
} from '@/components/patients/patientDraft';
import { ScreeningHistoryRow } from '@/components/screening/ScreeningHistoryRow';
import type { Patient, Screening } from '@/types/domain';
import { getPatient, listScreenings, updatePatient } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { toast } from '@/stores/toastStore';
import { ageFromBirthDate, formatDate } from '@/utils/date';
import { sexLabel } from '@/utils/labels';

/**
 * One patient, for the administrator: their data, and the history of their
 * X-rays, newest first.
 */
export function PatientDetailPage() {
  const { patientId = '' } = useParams();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<Screening[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatientDraft | null>(null);
  const [errors, setErrors] = useState<PatientDraftErrors>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [record, screenings] = await Promise.all([
        getPatient(patientId),
        listScreenings({ patientId, pageSize: 100 }),
      ]);
      setPatient(record);
      // Newest visit first; one still waiting today is listed too.
      setHistory([...screenings.items].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
    } catch (cause) {
      setError(errorMessage(cause, 'Data pasien gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = () => {
    if (!patient) return;
    setDraft(draftFromPatient(patient));
    setErrors({});
    setEditing(true);
  };

  const save = async () => {
    if (!draft || !patient) return;
    const found = validatePatientDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      setPatient(await updatePatient(patient.id, patientInputFromDraft(draft)));
      toast.success('Data pasien diperbarui.');
      setEditing(false);
    } catch (cause) {
      toast.error('Perubahan belum tersimpan.', errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState description={error} onRetry={() => void load()} />;
  if (loading || !patient) {
    return (
      <div className="space-y-5" role="status" aria-label="Memuat data pasien">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56" />
        <Skeleton className="h-48" />
      </div>
    );
  }


  return (
    <div className="space-y-5">
      <PageHeader
        title={patient.name}
        meta={
          <>
            <HeaderMeta label="No. rekam medis" value={patient.mrn} />
            <HeaderMeta label="Kunjungan" value={history.length} />
          </>
        }
        actions={
          <Button leadingIcon={<Pencil className="mr-1.5 size-4" />} onClick={openEdit}>
            Ubah data
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Data pasien" />
          <CardBody>
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Jenis kelamin">{sexLabel[patient.sex]}</DetailRow>
              <DetailRow label="Usia">{ageFromBirthDate(patient.birthDate)} tahun</DetailRow>
              <DetailRow label="Tanggal lahir">{formatDate(patient.birthDate)}</DetailRow>
              <DetailRow label="Telepon">{patient.phone || '-'}</DetailRow>
              <DetailRow label="Alamat">{patient.address || '-'}</DetailRow>
              <DetailRow label="Terdaftar">{formatDate(patient.createdAt)}</DetailRow>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Riwayat rontgen"
            icon={<Images />}
            description="Setiap kunjungan pasien ini, yang terbaru di atas."
          />
          {history.length === 0 ? (
            <EmptyState
              compact
              icon={<Images />}
              title="Belum ada rontgen"
              description="Kunjungan muncul di sini setelah pasien ini didaftarkan."
            />
          ) : (
            <ul className="divide-y divide-obsidian-100">
              {history.map((screening) => (
                <ScreeningHistoryRow key={screening.id} screening={screening} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Ubah data pasien"
        size="lg"
        dismissOnOverlayClick={!saving}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Batal
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              Simpan perubahan
            </Button>
          </>
        }
      >
        {draft ? (
          <PatientFields
            draft={draft}
            errors={errors}
            disabled={saving}
            onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
