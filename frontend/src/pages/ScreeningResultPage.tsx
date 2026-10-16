import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, Cpu, FileText, History, ImageOff, ScanLine } from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { Skeleton } from '@/components/ui/Skeleton';
import { ImageQualityBadge, ScreeningOutcomeBadge, ScreeningStatusBadge } from '@/components/ui/StatusBadge';
import { ProbabilityPanel } from '@/components/screening/ProbabilityPanel';
import { AccessCodeCard } from '@/components/screening/AccessCodeCard';
import { GroundedRegions } from '@/trace/components/demo/GroundedRegions';
import { useScreeningImage } from '@/hooks/useScreeningImage';
import { useStaffNames } from '@/hooks/useStaffNames';
import { useCurrentAccount } from '@/stores/authStore';
import type { Screening } from '@/types/domain';
import { getScreening } from '@/services/recordsApi';
import { errorMessage } from '@/lib/apiClient';
import { formatDate, formatDateTime } from '@/utils/date';
import { screeningOutcomeMeaning, symptomLabel } from '@/utils/labels';

/**
 * One visit, read-only: the X-ray with the areas the model leaned on, what the
 * model made of it, the queue number and access code, and what the
 * radiologist recorded. Opened from the queue, and by the administrator from
 * a patient's X-ray history.
 */
export function ScreeningResultPage() {
  const { screeningId = '' } = useParams();
  const account = useCurrentAccount();
  const staffName = useStaffNames();

  const [screening, setScreening] = useState<Screening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const image = useScreeningImage(screening);

  const load = useCallback(async () => {
    setError(null);
    try {
      setScreening(await getScreening(screeningId));
    } catch (cause) {
      setError(errorMessage(cause, 'Data screening gagal dimuat.'));
    }
  }, [screeningId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorState description={error} onRetry={() => void load()} />;
  if (!screening) {
    return (
      <div className="space-y-5" role="status" aria-label="Memuat data screening">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const patient = screening.patient;
  const analysis = screening.analysis;
  const symptoms = screening.symptoms;
  const reported = symptoms
    ? (Object.entries(symptoms) as [string, number | boolean][]).filter(([key, value]) => key !== 'coughWeeks' && value === true)
    : [];
  const submitted = screening.status === 'queued' || screening.status === 'served';

  return (
    <div className="space-y-5">
      <PageHeader
        title={patient?.name ?? screening.applicant?.name ?? 'Pasien'}
        meta={
          <>
            {patient ? <HeaderMeta label="No. rekam medis" value={patient.mrn} /> : null}
            <HeaderMeta label="Tanggal" value={formatDate(screening.requestDate)} />
            {screening.operatorId ? <HeaderMeta label="Diperiksa oleh" value={staffName(screening.operatorId)} /> : null}
          </>
        }
        actions={
          <>
            {account?.role === 'radiologist' && screening.status === 'examining' && screening.operatorId === account.id ? (
              <ButtonLink to={`/screenings/${screening.id}/examine`} variant="primary" leadingIcon={<ScanLine className="mr-1.5 size-4" />}>
                Lanjutkan pemeriksaan
              </ButtonLink>
            ) : null}
            {account?.role === 'admin' && patient ? (
              <ButtonLink to={`/patients/${patient.id}`} leadingIcon={<History className="mr-1.5 size-4" />}>
                Riwayat rontgen pasien
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ScreeningStatusBadge status={screening.status} />
        {screening.hasImage ? <ImageQualityBadge quality={screening.imageQuality} /> : null}
        {analysis ? <ScreeningOutcomeBadge outcome={analysis.outcome} /> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Rontgen" icon={<ScanLine />} />
          <CardBody>
            {!screening.hasImage ? (
              <div className="flex flex-col items-center gap-2 rounded-md bg-obsidian-50 px-6 py-14 text-center">
                <ImageOff aria-hidden className="size-6 text-obsidian-400" />
                <p className="text-[13px] font-medium text-obsidian-700">Belum ada rontgen terlampir</p>
              </div>
            ) : image.loading ? (
              <Skeleton className="aspect-square w-full" />
            ) : image.url ? (
              <GroundedRegions
                imageUrl={image.url}
                imageName={screening.imageMeta?.fileName ?? 'rontgen'}
                regions={analysis?.regions ?? []}
                heatmapUrl={null}
                note={
                  analysis
                    ? (analysis.detectionNote ?? 'Tidak ada area yang ditandai.')
                    : 'Model tidak membaca rontgen ini, jadi tidak ada area yang ditandai.'
                }
              />
            ) : (
              <Notice tone="urgent" compact>
                {image.error ?? 'Gambar gagal dimuat.'}
              </Notice>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          {submitted ? (
            <AccessCodeCard screening={screening} />
          ) : (
            <>
              <Notice tone="attention" title="Belum masuk antrean">
                Nomor antrean dibuat saat dokter radiologi mengirim pemeriksaan ini ke sistem.
              </Notice>
              <AccessCodeCard screening={screening} />
            </>
          )}

          <Card>
            <CardHeader title="Hasil model" icon={<Cpu />} />
            <CardBody className="space-y-4">
              {analysis ? (
                <>
                  <p className="text-[13px] leading-relaxed text-obsidian-700">{screeningOutcomeMeaning[analysis.outcome]}</p>
                  <ProbabilityPanel analysis={analysis} />
                  <p className="border-t border-obsidian-100 pt-3 text-xs leading-relaxed text-obsidian-500">
                    Dibaca oleh {analysis.model.name} ({analysis.model.version}) pada {formatDateTime(analysis.analysedAt)}. Alat bantu
                    screening, bukan diagnosis.
                  </p>
                </>
              ) : (
                <p className="text-[13px] leading-relaxed text-obsidian-600">
                  Model tidak membaca rontgen ini, jadi tidak ada risk point. Prioritas ditentukan dokter tanpa saran model.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Gejala" icon={<ClipboardList />} />
          <CardBody>
            <dl className="divide-y divide-obsidian-100">
              <DetailRow label="Keluhan saat mendaftar">{screening.complaint || '-'}</DetailRow>
              {symptoms ? (
                <>
                  <DetailRow label="Lama batuk">{symptoms.coughWeeks > 0 ? `${symptoms.coughWeeks} minggu` : 'Tidak batuk'}</DetailRow>
                  <DetailRow label="Dilaporkan">
                    {reported.length > 0 ? reported.map(([key]) => symptomLabel[key] ?? key).join(', ') : 'Tidak ada gejala lain'}
                  </DetailRow>
                </>
              ) : (
                <DetailRow label="Gejala">Belum dicatat</DetailRow>
              )}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tanda vital" icon={<FileText />} />
          <CardBody>
            {screening.vitals ? (
              <dl className="divide-y divide-obsidian-100">
                <DetailRow label="Berat badan">{screening.vitals.weightKg !== null ? `${screening.vitals.weightKg} kg` : '-'}</DetailRow>
                <DetailRow label="Tinggi badan">{screening.vitals.heightCm !== null ? `${screening.vitals.heightCm} cm` : '-'}</DetailRow>
                <DetailRow label="Suhu">{screening.vitals.temperatureC !== null ? `${screening.vitals.temperatureC} °C` : '-'}</DetailRow>
                <DetailRow label="Laju napas">
                  {screening.vitals.respiratoryRate !== null ? `${screening.vitals.respiratoryRate} per menit` : '-'}
                </DetailRow>
              </dl>
            ) : (
              <p className="text-[13px] text-obsidian-500">Belum dicatat.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
