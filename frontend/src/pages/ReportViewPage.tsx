import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileSearch,
  Info,
  Layers,
  Printer,
  SquareDashedMousePointer,
} from 'lucide-react';
import { Card, CardBody, CardHeader, DetailRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import {
  ImageQualityBadge,
  ReferralStatusBadge,
  ScreeningOutcomeBadge,
  ScreeningStatusBadge,
} from '@/components/ui/StatusBadge';
import { LogoMark } from '@/components/ui/Logo';
import { XrayFrame } from '@/components/screening/XrayViewer';
import { ProbabilityPanel } from '@/components/screening/ProbabilityPanel';
import { useDataStore } from '@/stores/dataStore';
import { facilities } from '@/data/facilities';
import { users } from '@/data/users';
import { SCREENING_DISCLAIMER } from '@/types/inference';
import { SIMULATED_RESULT_NOTICE } from '@/data/model';
import {
  facilityServiceLabel,
  screeningOutcomeMeaning,
  sexLabel,
  symptomLabel,
} from '@/utils/labels';
import { ageFromBirthDate, formatDate, formatDateTime } from '@/utils/date';
import { formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { SymptomSet } from '@/types/domain';

/**
 * Explainable screening report.
 *
 * Two jobs: let a reviewer compare the original radiograph against the region
 * overlay side by side, and produce a sheet that prints like a clinical
 * document. Printing uses the browser's own print pipeline, so no PDF
 * dependency is needed; the `data-print` attributes in `index.css` strip the
 * application chrome.
 *
 * What this report will not do: quote model metrics, or describe a highlighted
 * region as evidence of disease.
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

type CompareMode = 'side-by-side' | 'original' | 'overlay';

export function ReportViewPage() {
  const { screeningId } = useParams<{ screeningId: string }>();
  const navigate = useNavigate();

  const screening = useDataStore((state) =>
    state.screenings.find((item) => item.id === screeningId),
  );
  const patient = useDataStore((state) =>
    state.patients.find((item) => item.id === screening?.patientId),
  );
  const referral = useDataStore((state) =>
    state.referrals.find((item) => item.id === screening?.referralId),
  );

  const [mode, setMode] = useState<CompareMode>('side-by-side');

  if (!screening || !patient) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={<FileSearch />}
          title="Report tidak ditemukan"
          description="Catatan screening untuk report ini sudah tidak ada."
          action={
            <Button variant="primary" onClick={() => navigate('/reports')}>
              Kembali ke report
            </Button>
          }
        />
      </Card>
    );
  }

  const analysis = screening.analysis;
  const operator = users.find((user) => user.id === screening.operatorId);
  const reviewer = screening.review
    ? users.find((user) => user.id === screening.review!.reviewerId)
    : undefined;
  const facility = facilities.find((item) => item.id === screening.facilityId);
  const destination = referral
    ? facilities.find((item) => item.id === referral.toFacilityId)
    : undefined;
  const reportedSymptoms = BOOLEAN_SYMPTOMS.filter((key) => screening.symptoms[key]);
  const hasRegions = (analysis?.regions.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Screen-only controls */}
      <div data-print="hide" className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          leadingIcon={<ArrowLeft className="size-4" />}
          onClick={() => navigate(`/screenings/${screening.id}`)}
        >
          Kembali ke catatan screening
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {hasRegions ? (
            <div
              role="group"
              aria-label="Perbandingan gambar"
              className="flex items-center rounded-md bg-obsidian-100 p-0.5"
            >
              <ModeButton
                active={mode === 'side-by-side'}
                onClick={() => setMode('side-by-side')}
                icon={<Layers className="size-3.5" />}
                label="Bandingkan"
              />
              <ModeButton
                active={mode === 'original'}
                onClick={() => setMode('original')}
                icon={<SquareDashedMousePointer className="size-3.5" />}
                label="Asli"
              />
              <ModeButton
                active={mode === 'overlay'}
                onClick={() => setMode('overlay')}
                icon={<Layers className="size-3.5" />}
                label="Overlay"
              />
            </div>
          ) : null}

          <Button
            variant="primary"
            leadingIcon={<Printer className="size-4" />}
            onClick={() => window.print()}
          >
            Cetak report
          </Button>
        </div>
      </div>

      {/* The report sheet */}
      <article className="rounded-card border border-obsidian-200 bg-white print:rounded-none print:border-0">
        {/* Letterhead */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-obsidian-300 px-5 py-4 print:px-0">
          <div className="flex items-start gap-3">
            <LogoMark className="size-8 shrink-0" />
            <div>
              <h1 className="text-base font-semibold text-obsidian-950">
                Report screening TB
              </h1>
              <p className="mt-0.5 text-[13px] text-obsidian-600">
                {facility?.name} · {facility?.region}, {facility?.province}
              </p>
            </div>
          </div>
          <dl className="text-right text-xs text-obsidian-600">
            <div>
              <dt className="inline text-obsidian-400">Ref. report </dt>
              <dd className="inline font-mono">{screening.id}</dd>
            </div>
            <div className="mt-0.5">
              <dt className="inline text-obsidian-400">Dibuat </dt>
              <dd className="inline tabular">{formatDateTime(new Date().toISOString())}</dd>
            </div>
          </dl>
        </header>

        {/* Standing disclaimer, first thing on the printed page */}
        <div
          data-print="avoid-break"
          className="border-b border-obsidian-200 bg-obsidian-50 px-5 py-3 print:px-0"
        >
          <p className="text-[13px] font-semibold text-obsidian-950">
            Alat bantu screening, bukan diagnosis. {SIMULATED_RESULT_NOTICE}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-obsidian-600">
            {SCREENING_DISCLAIMER}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-obsidian-600">
            {analysis
              ? `Output di bawah dihasilkan oleh ${analysis.model.name} (${analysis.model.version}). Output ini belum divalidasi secara klinis di sini dan tidak pernah menggantikan penilaian reviewer.`
              : 'Belum ada model yang menganalisis radiograf ini, jadi report ini tidak memuat output model. Reviewer membaca gambarnya secara langsung.'}
          </p>
        </div>

        <div className="space-y-5 px-5 py-5 print:px-0">
          {/* Patient and encounter */}
          <section data-print="avoid-break" className="grid gap-5 sm:grid-cols-2">
            <div>
              <SectionTitle>Pasien</SectionTitle>
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Nama">{patient.name}</DetailRow>
                <DetailRow label="No. rekam medis">
                  <span className="font-mono text-xs">{patient.mrn}</span>
                </DetailRow>
                <DetailRow label="Usia dan jenis kelamin">
                  {ageFromBirthDate(patient.birthDate)} tahun · {sexLabel[patient.sex]}
                </DetailRow>
                <DetailRow label="Tempat tinggal">
                  {patient.village}, {patient.district}
                </DetailRow>
              </dl>
            </div>

            <div>
              <SectionTitle>Kunjungan</SectionTitle>
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Waktu screening">{formatDateTime(screening.performedAt)}</DetailRow>
                <DetailRow label="Dicatat oleh">{operator?.name ?? 'Tidak diketahui'}</DetailRow>
                <DetailRow label="Status catatan">
                  <ScreeningStatusBadge status={screening.status} size="sm" />
                </DetailRow>
                <DetailRow label="Kualitas gambar">
                  <ImageQualityBadge quality={screening.imageQuality} size="sm" />
                </DetailRow>
              </dl>
            </div>
          </section>

          {/* Imaging */}
          <section data-print="avoid-break">
            <SectionTitle>Radiograf</SectionTitle>
            <div
              className={cn(
                'mt-2 grid gap-4',
                hasRegions && mode === 'side-by-side' ? 'sm:grid-cols-2' : 'max-w-md',
              )}
            >
              {/* Original, always shown */}
              {(!hasRegions || mode !== 'overlay') ? (
                <XrayFrame
                  screening={screening}
                  label="Radiograf asli, sesuai hasil pengambilan"
                />
              ) : null}

              {hasRegions && mode !== 'original' ? (
                <XrayFrame
                  screening={screening}
                  regions={analysis?.regions ?? []}
                  showOverlay
                  label="Overlay region sebagai ilustrasi, bernomor di bawah"
                />
              ) : null}
            </div>

            {hasRegions ? (
              <>
                <ol className="mt-3 space-y-1.5">
                  {analysis!.regions.map((region, index) => (
                    <li key={region.id} className="flex items-start gap-2.5 text-[13px]">
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-ct-400 bg-ct-100 text-[10px] font-semibold text-ct-800 tabular"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="font-medium text-obsidian-900 capitalize">
                          {region.zone}
                        </span>
                        <span className="ml-2 text-obsidian-500 tabular">
                          score region {formatPercent(region.score, 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-obsidian-500">
                  <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                  Overlay ini hanya ilustrasi. Overlay menunjukkan di mana simulator menaruh
                  kotak, bukan temuan hasil pengukuran, dan region yang di-highlight bukan bukti
                  penyakit. Score region adalah angka milik simulator sendiri dan belum
                  dikalibrasi.
                </p>
              </>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-obsidian-600">
                Tidak ada overlay region untuk catatan ini.{' '}
                {analysis?.detectionNote ?? 'Lokalisasi tidak dilakukan.'}
              </p>
            )}
          </section>

          {/* Clinical context */}
          <section data-print="avoid-break">
            <SectionTitle>Gejala dan tanda vital yang dilaporkan</SectionTitle>
            <dl className="mt-2 divide-y divide-obsidian-100">
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
                    screening.vitals.temperatureC ? `${screening.vitals.temperatureC} °C` : null,
                    screening.vitals.respiratoryRate
                      ? `${screening.vitals.respiratoryRate}/min`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Tidak dicatat'}
                </span>
              </DetailRow>
              <DetailRow label="Faktor risiko">
                {patient.riskFactors.length === 0
                  ? 'Tidak dicatat'
                  : patient.riskFactors.join(', ').replace(/-/g, ' ')}
              </DetailRow>
            </dl>
          </section>

          {/* Model output */}
          <section data-print="avoid-break">
            <SectionTitle>Output model screening</SectionTitle>
            {analysis ? (
              <div className="mt-2 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ScreeningOutcomeBadge outcome={analysis.outcome} />
                </div>
                <p className="text-[13px] leading-relaxed text-obsidian-600">
                  {screeningOutcomeMeaning[analysis.outcome]}
                </p>
                <div className="max-w-md">
                  <ProbabilityPanel analysis={analysis} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-obsidian-600">
                Tidak ada output model untuk catatan ini.
              </p>
            )}
          </section>

          {/* Model information */}
          <section data-print="avoid-break">
            <SectionTitle>Informasi model</SectionTitle>
            <dl className="mt-2 divide-y divide-obsidian-100">
              <DetailRow label="Sumber">
                {analysis?.model.name ?? 'Tidak berlaku'}
                {analysis ? (
                  <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                    {analysis.model.version}
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow label="Label set">
                {analysis?.model.labels.join(', ') ?? 'Tidak berlaku'}
              </DetailRow>
              <DetailRow label="Referensi arsitektur">
                {analysis?.model.backbone ?? 'Tidak berlaku'}
              </DetailRow>
              <DetailRow label="Validasi">
                <span className="text-obsidian-500">
                  Tidak ada. Tidak ada model yang dievaluasi, jadi angka akurasi, sensitivitas,
                  maupun spesifisitas tidak dilaporkan.
                </span>
              </DetailRow>
              <DetailRow label="Dianalisis">
                {analysis ? formatDateTime(analysis.analysedAt) : 'Belum dianalisis'}
              </DetailRow>
            </dl>
          </section>

          {/* Limitations */}
          <section data-print="avoid-break">
            <SectionTitle>Keterbatasan screening</SectionTitle>
            <ul className="mt-2 space-y-1.5">
              {[
                'Alat bantu screening hanya mempersempit siapa yang perlu tes konfirmasi. Alat ini tidak bisa memastikan atau menyingkirkan tuberkulosis.',
                'Radiograf dada saja tidak bisa memastikan TB. Konfirmasi bakteriologis lewat mikroskopi dahak atau tes molekuler tetap diperlukan.',
                'Tidak adanya alert screening bukan berarti pasien bebas TB. Gejala dan penilaian klinis tetap diutamakan.',
                'Kualitas gambar, posisi, dan eksposur sangat memengaruhi apa yang bisa dibaca dari radiograf.',
                analysis
                  ? 'Output model belum punya angka performa tervalidasi di sini dan tidak punya bobot diagnostik sendiri.'
                  : 'Tidak ada output model untuk catatan ini, jadi penilaian bergantung pada pembacaan gambar oleh reviewer.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-obsidian-400"
                  />
                  <span className="text-obsidian-700">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Reviewer */}
          <section data-print="avoid-break">
            <SectionTitle>Reviewer manusia</SectionTitle>
            {screening.review ? (
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Ditinjau oleh">
                  {reviewer?.name ?? 'Tidak diketahui'}
                  {reviewer ? (
                    <span className="ml-1.5 text-obsidian-400">
                      {reviewer.role === 'physician' ? 'Dokter' : 'Perawat'}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Waktu review">{formatDateTime(screening.review.reviewedAt)}</DetailRow>
                <DetailRow label="Penilaian">
                  {screening.review.agreement === 'agrees'
                    ? analysis
                      ? 'Sesuai dengan output screening'
                      : 'Gambar sudah ditinjau, tidak ada temuan mencurigakan'
                    : screening.review.agreement === 'disagrees'
                      ? analysis
                        ? 'Tidak sesuai dengan output screening'
                        : 'Gambar sudah ditinjau, ada temuan yang perlu diperhatikan'
                      : 'Belum bisa disimpulkan dari gambar ini'}
                </DetailRow>
                <DetailRow label="Keputusan">
                  {screening.review.decision === 'refer'
                    ? 'Rujuk untuk tes diagnostik'
                    : screening.review.decision === 'repeat-image'
                      ? 'Ulangi radiograf'
                      : screening.review.decision === 'observe'
                        ? 'Observasi dan cek ulang'
                        : 'Tidak ada tindakan lanjutan'}
                </DetailRow>
                <DetailRow label="Catatan">
                  <span className="leading-relaxed">{screening.review.notes}</span>
                </DetailRow>
              </dl>
            ) : (
              <Notice tone="attention" compact className="mt-2">
                Catatan ini belum ditinjau oleh klinisi. Tanpa review manusia, output screening
                tidak punya bobot sama sekali.
              </Notice>
            )}
          </section>

          {/* Referral */}
          <section data-print="avoid-break">
            <SectionTitle>Status referral</SectionTitle>
            {referral ? (
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Referral">
                  <span className="font-mono text-xs">{referral.code}</span>
                </DetailRow>
                <DetailRow label="Tujuan">{destination?.name ?? 'Fasilitas tidak dikenal'}</DetailRow>
                <DetailRow label="Layanan diminta">
                  {facilityServiceLabel[referral.requestedService]}
                </DetailRow>
                <DetailRow label="Status">
                  <ReferralStatusBadge status={referral.status} size="sm" />
                </DetailRow>
                <DetailRow label="Jadwal temu">
                  {referral.appointmentDate ? formatDate(referral.appointmentDate) : 'Belum dijadwalkan'}
                </DetailRow>
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-obsidian-600">
                Belum ada referral yang dibuat dari catatan screening ini.
              </p>
            )}
          </section>

          {/* Signature block, for the printed sheet */}
          <section
            data-print="avoid-break"
            className="hidden border-t border-obsidian-300 pt-5 print:block"
          >
            <SectionTitle>Pengesahan klinisi</SectionTitle>
            <div className="mt-6 grid grid-cols-2 gap-8">
              <div>
                <div className="h-10 border-b border-obsidian-400" />
                <p className="mt-1.5 text-xs text-obsidian-500">Nama dan tanda tangan</p>
              </div>
              <div>
                <div className="h-10 border-b border-obsidian-400" />
                <p className="mt-1.5 text-xs text-obsidian-500">Tanggal</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer repeated on the printed sheet */}
        <footer className="border-t border-obsidian-200 px-5 py-3 print:px-0">
          <p className="text-[11px] leading-relaxed text-obsidian-500">
            Dibuat oleh PARUPINTAS, prototipe demonstrasi. Semua data, termasuk pasien dan
            radiograf ini, bersifat sintetis. Bukan alat kesehatan, belum divalidasi, dan tidak
            untuk penggunaan klinis. {SIMULATED_RESULT_NOTICE}
          </p>
        </footer>
      </article>

      {/* Screen-only reminder about what printing does */}
      <Card data-print="hide" className="print:hidden">
        <CardHeader icon={<Printer />} title="Mencetak report ini" />
        <CardBody>
          <p className="text-[13px] leading-relaxed text-obsidian-600">
            Pencetakan memakai dialog bawaan browser, yang juga bisa menyimpan lembar ini sebagai
            PDF. Navigasi, tombol, dan pengalih tampilan dihilangkan dari halaman cetak, dan
            perbandingan diubah jadi gambar asli di samping overlay sehingga keduanya muncul di
            lembar.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-wide text-obsidian-500 uppercase">
      {children}
    </h2>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-white text-obsidian-950 shadow-card'
          : 'text-obsidian-500 hover:text-obsidian-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
