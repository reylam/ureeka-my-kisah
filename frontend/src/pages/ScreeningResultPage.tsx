import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  FileSearch,
  FileText,
  Hourglass,
  Play,
  Send,
  Stethoscope,
  User,
} from 'lucide-react';
import { PageHeader, HeaderMeta } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice, SimulatedResultNotice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ImageQualityBadge,
  ReferralStatusBadge,
  ScreeningOutcomeBadge,
  ScreeningStatusBadge,
  SyncStateBadge,
} from '@/components/ui/StatusBadge';
import { XrayViewer } from '@/components/screening/XrayViewer';
import { ProbabilityPanel } from '@/components/screening/ProbabilityPanel';
import { ReviewForm } from '@/components/screening/ReviewForm';
import { ReferralFormDialog } from '@/components/referrals/ReferralFormDialog';
import { FollowUpFormDialog } from '@/components/followups/FollowUpFormDialog';
import { useDataStore } from '@/stores/dataStore';
import { useIsConnected } from '@/stores/connectionStore';
import { toast } from '@/stores/toastStore';
import { ApiError, errorMessage } from '@/lib/apiClient';
import { users } from '@/data/users';
import { facilities } from '@/data/facilities';
import {
  ageFromBirthDate,
  formatDate,
  formatDateTime,
  formatRelative,
} from '@/utils/date';
import {
  followUpReasonLabel,
  imageQualityLabel,
  screeningOutcomeMeaning,
  sexLabel,
  symptomLabel,
} from '@/utils/labels';
import type { SymptomSet } from '@/types/domain';

/**
 * Screening result.
 *
 * Layout intent: the radiograph gets the dark viewer and most of the width,
 * because that is the thing a clinician actually needs to look at. The
 * simulated output sits beside it as supporting information, and the review
 * sign-off is the page's primary action, not the referral button.
 */

const BOOLEAN_SYMPTOMS: (keyof SymptomSet)[] = [
  'hemoptysis',
  'nightSweats',
  'weightLoss',
  'fever',
  'chestPain',
  'fatigue',
  'appetiteLoss',
];

export function ScreeningResultPage() {
  const { screeningId } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();
  const connected = useIsConnected();

  const screening = useDataStore((state) =>
    state.screenings.find((item) => item.id === screeningId),
  );
  const patient = useDataStore((state) =>
    state.patients.find((item) => item.id === screening?.patientId),
  );
  const referral = useDataStore((state) =>
    state.referrals.find((item) => item.id === screening?.referralId),
  );
  // useShallow: the filtered array is new on every call (see PatientDetailPage).
  const followUps = useDataStore(
    useShallow((state) => state.followUps.filter((item) => item.screeningId === screeningId)),
  );
  const analyzeScreening = useDataStore((state) => state.analyzeScreening);

  const [referralOpen, setReferralOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!screening || !patient) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={<FileSearch />}
          title="Catatan screening tidak ditemukan"
          description="Catatan ini mungkin tidak ada, atau milik pasien di luar fasilitas kamu."
          action={
            <Button variant="primary" onClick={() => navigate('/reports')}>
              Kembali ke riwayat screening
            </Button>
          }
        />
      </Card>
    );
  }

  const operator = users.find((user) => user.id === screening.operatorId);
  const facility = facilities.find((item) => item.id === screening.facilityId);
  const analysis = screening.analysis;
  const reportedSymptoms = BOOLEAN_SYMPTOMS.filter((key) => screening.symptoms[key]);

  /** Ask the server to run the screening model for a record that has no output yet. */
  const runAnalysis = async () => {
    if (!connected) {
      toast.attention(
        'Analisis butuh koneksi internet.',
        'Data tetap masuk queue sampai koneksi tersedia.',
      );
      return;
    }
    setRunning(true);
    setProgress(8);
    const ticker = window.setInterval(() => {
      setProgress((value) => Math.min(92, value + 12));
    }, 170);

    try {
      await analyzeScreening(screening.id);
      setProgress(100);
      toast.success('Analisis selesai.', 'Data ini sekarang perlu direview klinisi.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'MODEL_NOT_CONNECTED') {
        toast.info(
          'Model screening belum terhubung.',
          'Data tidak berubah dan tetap bisa direview klinisi.',
        );
      } else {
        toast.error('Analisis tidak bisa diselesaikan.', errorMessage(cause));
      }
    } finally {
      window.clearInterval(ticker);
      setRunning(false);
      setProgress(0);
    }
  };

  /* ── Next step, stated plainly ──────────────────────────────────────────── */
  const nextStep = (() => {
    if (!analysis && !screening.review)
      return {
        title: 'Belum ada output model',
        body:
          screening.modelStatus === 'unavailable'
            ? 'Model screening belum terhubung. Klinisi tetap bisa meninjau gambar dan mencatat keputusan.'
            : 'Jalankan analisis jika model sudah terhubung, atau minta klinisi meninjau gambar secara langsung.',
        tone: 'info' as const,
      };
    if (!screening.review)
      return {
        title: 'Perlu review klinis',
        body: 'Perawat atau dokter harus melihat radiograf dan mencatat keputusan sebelum langkah berikutnya.',
        tone: 'attention' as const,
      };
    if (screening.review.decision === 'refer' && !referral)
      return {
        title: 'Referral belum dibuat',
        body: 'Reviewer memutuskan untuk merujuk pasien ini, tetapi belum ada referral di catatan.',
        tone: 'attention' as const,
      };
    if (screening.review.decision === 'repeat-image')
      return {
        title: 'Radiograf perlu diulang',
        body: 'Reviewer tidak bisa membaca gambar ini. Jadwalkan pasien untuk kembali dan difoto ulang.',
        tone: 'attention' as const,
      };
    if (referral)
      return {
        title: 'Referral sedang berjalan',
        body: `${referral.code} sedang ditangani ${facilities.find((f) => f.id === referral.toFacilityId)?.name ?? 'fasilitas tujuan'}. Pantau dari daftar referral.`,
        tone: 'info' as const,
      };
    return {
      title: 'Tidak perlu tindakan lanjutan',
      body: 'Catatan sudah ditinjau dan ditutup. Pasien disarankan kembali jika gejala berubah.',
      tone: 'info' as const,
    };
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hasil screening"
        description={
          <>
            <Link
              to={`/patients/${patient.id}`}
              className="font-medium text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
            >
              {patient.name}
            </Link>{' '}
            · {ageFromBirthDate(patient.birthDate)} thn · {sexLabel[patient.sex]} ·{' '}
            {patient.village}, {patient.district}
          </>
        }
        meta={
          <>
            <HeaderMeta label="No. rekam medis" value={<span className="font-mono">{patient.mrn}</span>} />
            <HeaderMeta label="Waktu screening" value={formatDateTime(screening.performedAt)} />
            <HeaderMeta label="Oleh" value={operator?.name ?? 'Tidak diketahui'} />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              leadingIcon={<FileText className="size-4" />}
              onClick={() => navigate(`/screenings/${screening.id}/report`)}
            >
              Buka report
            </Button>
            {referral ? (
              <Button
                variant="outline"
                leadingIcon={<Send className="size-4" />}
                onClick={() => navigate(`/referrals?focus=${referral.id}`)}
              >
                Lihat referral
              </Button>
            ) : (
              <Button
                variant="primary"
                leadingIcon={<Send className="size-4" />}
                onClick={() => setReferralOpen(true)}
              >
                Buat referral
              </Button>
            )}
          </>
        }
      />

      {/* Status strip: the record's state at a glance */}
      <div className="flex flex-wrap items-center gap-2">
        <ScreeningStatusBadge status={screening.status} />
        {analysis ? <ScreeningOutcomeBadge outcome={analysis.outcome} /> : null}
        <ImageQualityBadge quality={screening.imageQuality} />
        <SyncStateBadge state={screening.sync} />
        {referral ? <ReferralStatusBadge status={referral.status} /> : null}
      </div>

      <SimulatedResultNotice />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: the image */}
        <div className="space-y-4">
          <XrayViewer screening={screening} regions={analysis?.regions ?? []} />

          <Card>
            <CardHeader icon={<User />} title="Catatan kunjungan" />
            <CardBody>
              <dl className="divide-y divide-obsidian-100">
                <DetailRow label="Fasilitas">{facility?.name ?? 'Tidak dicatat'}</DetailRow>
                <DetailRow label="Batuk">
                  {screening.symptoms.coughWeeks > 0
                    ? `${screening.symptoms.coughWeeks} minggu`
                    : 'Tidak ada laporan'}
                </DetailRow>
                <DetailRow label="Gejala lain">
                  {reportedSymptoms.length === 0
                    ? 'Tidak ada laporan'
                    : reportedSymptoms.map((key) => symptomLabel[key] ?? key).join(', ')}
                </DetailRow>
                <DetailRow label="Tanda vital">
                  <span className="tabular">
                    {[
                      screening.vitals.weightKg ? `${screening.vitals.weightKg} kg` : null,
                      screening.vitals.heightCm ? `${screening.vitals.heightCm} cm` : null,
                      screening.vitals.temperatureC
                        ? `${screening.vitals.temperatureC} °C`
                        : null,
                      screening.vitals.respiratoryRate
                        ? `${screening.vitals.respiratoryRate}/min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Tidak dicatat'}
                  </span>
                </DetailRow>
                <DetailRow label="File gambar">
                  {screening.imageMeta ? (
                    <span className="break-all">
                      {screening.imageMeta.fileName}
                      <span className="ml-1.5 text-obsidian-400 tabular">
                        {screening.imageMeta.width}×{screening.imageMeta.height}px
                      </span>
                    </span>
                  ) : screening.sampleImage ? (
                    'Contoh radiograf sintetis bawaan'
                  ) : (
                    'Tidak ada gambar terlampir'
                  )}
                </DetailRow>
                <DetailRow label="Kualitas gambar">
                  {imageQualityLabel[screening.imageQuality]}
                  {screening.imageQuality === 'inadequate' ? (
                    <span className="mt-1 block text-xs text-urgent-700">
                      Radiograf yang tidak memadai tidak bisa menghasilkan hasil screening yang layak pakai.
                    </span>
                  ) : null}
                </DetailRow>
              </dl>
            </CardBody>
          </Card>
        </div>

        {/* Right: output, next step, review */}
        <div className="space-y-4">
          {/* Demo output */}
          <Card>
            <CardHeader
              icon={<Stethoscope />}
              title="Output model screening"
              description={
                analysis
                  ? analysis.simulated
                    ? `Dihasilkan ${formatRelative(analysis.analysedAt)} oleh simulator bawaan.`
                    : `Dihasilkan ${formatRelative(analysis.analysedAt)} oleh model screening.`
                  : 'Belum ada output yang dihasilkan untuk data ini.'
              }
            />
            <CardBody className="space-y-4">
              {!analysis ? (
                running ? (
                  <div>
                    <ProgressBar value={progress} label="Menjalankan model screening" />
                    <p className="mt-2 text-xs text-obsidian-500">
                      Radiograf sedang dikirim ke model screening.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 rounded-md border border-obsidian-200 bg-obsidian-50 px-3.5 py-3">
                      <Hourglass aria-hidden className="mt-px size-4 shrink-0 text-obsidian-400" />
                      <p className="text-[13px] leading-relaxed text-obsidian-700">
                        {screening.modelStatus === 'unavailable'
                          ? 'Model screening belum terhubung ke server, jadi belum ada output model untuk data ini. Data tetap bisa direview.'
                          : connected
                            ? 'Belum ada output model untuk data ini.'
                            : 'Analisis butuh koneksi internet, jadi akan menunggu sampai koneksi tersedia.'}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={!connected}
                      leadingIcon={<Play className="size-4" />}
                      onClick={() => void runAnalysis()}
                    >
                      Jalankan analisis model
                    </Button>
                  </div>
                )
              ) : (
                <>
                  <div>
                    <ScreeningOutcomeBadge outcome={analysis.outcome} />
                    <p className="mt-2.5 text-[13px] leading-relaxed text-obsidian-600">
                      {screeningOutcomeMeaning[analysis.outcome]}
                    </p>
                  </div>

                  <div className="border-t border-obsidian-100 pt-3.5">
                    <h3 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
                      Score per kelas
                    </h3>
                    <ProbabilityPanel analysis={analysis} className="mt-2.5" />
                  </div>

                  {analysis.detectionNote ? (
                    <Notice tone="info" compact>
                      {analysis.detectionNote}
                    </Notice>
                  ) : null}

                  <dl className="divide-y divide-obsidian-100 border-t border-obsidian-100 pt-1">
                    <DetailRow label="Region yang ditandai">
                      {analysis.regions.length === 0
                        ? 'Tidak ada'
                        : `${analysis.regions.length} (${analysis.regions.map((r) => r.zone).join(', ')})`}
                    </DetailRow>
                    <DetailRow label="Model">
                      {analysis.model.name}
                      <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                        {analysis.model.version}
                      </span>
                    </DetailRow>
                    <DetailRow label="Angka performa">
                      <span className="text-obsidian-500">
                        Tidak dilaporkan, belum ada model yang dievaluasi
                      </span>
                    </DetailRow>
                  </dl>
                </>
              )}
            </CardBody>
          </Card>

          {/* Next step */}
          <Card>
            <CardHeader icon={<ArrowRight />} title="Langkah berikutnya" />
            <CardBody>
              <Notice tone={nextStep.tone} title={nextStep.title}>
                {nextStep.body}
              </Notice>
              <div className="mt-3 flex flex-wrap gap-2">
                {!referral ? (
                  <Button
                    size="sm"
                    variant="outline"
                    leadingIcon={<Send className="size-4" />}
                    onClick={() => setReferralOpen(true)}
                  >
                    Buat referral
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  leadingIcon={<CalendarClock className="size-4" />}
                  onClick={() => setFollowUpOpen(true)}
                >
                  Jadwalkan follow-up
                </Button>
              </div>

              {followUps.length > 0 ? (
                <ul className="mt-3 divide-y divide-obsidian-100 border-t border-obsidian-100">
                  {followUps.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 text-[13px]">
                        <span className="font-medium text-obsidian-900">
                          {followUpReasonLabel[item.reason]}
                        </span>
                        <span className="ml-1.5 text-obsidian-500">
                          jatuh tempo {formatDate(item.dueDate)}
                        </span>
                      </span>
                      <Link
                        to={`/followups?focus=${item.id}`}
                        className="shrink-0 text-xs text-ct-700 underline decoration-ct-300 underline-offset-2 transition-colors hover:text-ct-800"
                      >
                        Buka
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          {/* Human review */}
          <Card>
            <CardHeader
              icon={<Stethoscope />}
              title="Review manusia"
              description="Output screening bukan keputusan akhir. Klinisi mengesahkan hasilnya di sini."
            />
            <CardBody>
              <ReviewForm screening={screening} />
            </CardBody>
          </Card>
        </div>
      </div>

      <ReferralFormDialog
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        patientId={patient.id}
        screeningId={screening.id}
        defaultReason={
          analysis?.outcome === 'flagged-for-review'
            ? `Screening ditandai untuk review klinis pada ${formatDate(screening.performedAt)}. Mohon tes diagnostik.`
            : analysis?.outcome === 'inconclusive'
              ? `Radiograf tidak bisa diinterpretasi di fasilitas ini (${imageQualityLabel[screening.imageQuality].toLowerCase()}). Mohon pengambilan gambar ulang.`
              : ''
        }
      />

      <FollowUpFormDialog
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        patientId={patient.id}
        screeningId={screening.id}
        referralId={referral?.id ?? null}
        defaultReason={
          analysis?.outcome === 'inconclusive' ? 'repeat-imaging' : 'referral-attendance'
        }
      />
    </div>
  );
}
