import { ArrowUpRight, Cpu, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SelectedImage } from '@/trace/hooks/useImageUpload';
import type { ClassLabel, ScreeningAnalysis } from '@/types/domain';
import { SCREENING_DISCLAIMER } from '@/types/inference';
import { RESULT_DISCLOSURES } from '@/trace/data/demoResults';
import { RISK_BANDS, RISK_LABEL, riskOf } from '@/lib/risk';
import { formatBytes } from '@/trace/lib/format';
import { cn } from '@/utils/cn';
import { GroundedRegions } from './GroundedRegions';
import { isSampleFile } from '@/trace/hooks/useSampleImage';

/**
 * The result report for a real model run.
 *
 * It keeps the choices the stand-in panel makes, because they are about
 * reading a screening result and not about whether a model ran:
 *
 *  - the "alat bantu, bukan diagnosis" label sits inside the panel, since
 *    screenshots get cropped;
 *  - amber means "look closer" and grey means "nothing stood out". Neither is
 *    red or green, which would read as sick and healthy;
 *  - the risk point is drawn on a track with its band edges marked, and the
 *    caption says what it is not: a chance of illness;
 *  - "nothing stood out" carries as much caution as the other outcome. The
 *    reassuring result is the easier one to over-read.
 */

const OUTCOME: Record<
  ScreeningAnalysis['outcome'],
  { title: string; flagged: boolean; body: string }
> = {
  'flagged-for-review': {
    title: 'Ditandai untuk dilihat lebih dekat',
    flagged: true,
    body: 'Model menilai gambar ini mirip dengan pola yang ia pelajari sebagai bukan sehat. Artinya sebaiknya ada tenaga kesehatan yang melihatnya. Ini tidak berarti orang tersebut menderita tuberkulosis.',
  },
  'no-alert': {
    title: 'Tidak ada yang menonjol',
    flagged: false,
    body: 'Model tidak menemukan pola yang ia pelajari sebagai bukan sehat. Ini tidak berarti orang tersebut bebas dari tuberkulosis, karena X-ray dada memang bisa melewatkan kasus.',
  },
  inconclusive: {
    title: 'Belum meyakinkan',
    flagged: false,
    body: 'Tidak ada satu kelas pun yang jelas unggul, jadi model tidak memberi jawaban yang bisa dipegang. Foto ulang atau penilaian langsung oleh tenaga kesehatan lebih berguna daripada angka ini.',
  },
};

const LABEL_NAME: Record<ClassLabel, string> = {
  Healthy: 'Sehat',
  'Sick-non-TB': 'Sakit, bukan TB',
  TB: 'TB',
};

const LIMITATIONS = [
  'Model ini bisa melewatkan orang. Tuberkulosis tahap awal, dan TB pada orang dengan HIV, bisa sangat sulit terlihat di X-ray.',
  'Model ini bisa memicu alarm palsu. Pneumonia, bekas luka lama, dan kondisi paru lain bisa tampak mirip.',
  'Kualitas gambar mengubah jawabannya. Pencahayaan, posisi, dan mesin yang dipakai ikut menggeser apa yang dilihat model.',
  'Model ini belum divalidasi secara klinis di sini, dan tidak ada angka akurasi yang diklaim. Risk point bukan persentase peluang sakit.',
];

export function ModelResultPanel({
  analysis,
  image,
  heatmapUrl = null,
  className,
}: {
  analysis: ScreeningAnalysis;
  image: SelectedImage;
  /** Occlusion heat map behind `analysis.regions`. */
  heatmapUrl?: string | null;
  className?: string;
}) {
  const outcome = OUTCOME[analysis.outcome];
  const { point, level } = riskOf(analysis);
  const entries = (Object.entries(analysis.probabilities) as [ClassLabel, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const sampleImage = isSampleFile(image.file.name);

  return (
    <section
      aria-labelledby="result-heading"
      className={cn('overflow-hidden rounded-md border border-trace-accent-edge', className)}
    >
      <h3
        id="result-heading"
        className="flex items-center gap-2 border-b border-trace-accent-edge bg-trace-accent-surface px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-trace-accent-soft"
      >
        <Cpu aria-hidden className="size-3.5" />
        Hasil model · alat bantu screening, bukan diagnosis
      </h3>

      <div className="bg-trace-card">
        {/* 1. Outcome */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Hasilnya</p>
          <p
            className={cn(
              'mt-2.5 text-[23px] leading-tight font-semibold tracking-[-0.02em]',
              outcome.flagged ? 'text-trace-flag' : 'text-trace-neutral',
            )}
          >
            {outcome.title}
          </p>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-trace-muted">{outcome.body}</p>
          <p className="mt-3 text-[13px] leading-6 text-trace-dim">
            Kelas teratas menurut model:{' '}
            <span className="text-trace-muted">{LABEL_NAME[analysis.predictedLabel]}</span>
          </p>
        </div>

        {/* 1b. Where the score came from on the film. Only for a result that
            points at something: a "Healthy" top class has nothing to box. */}
        {analysis.predictedLabel !== 'Healthy' ? (
          <div className="border-b border-trace-line px-4 py-5 sm:px-5">
            <GroundedRegions
              imageUrl={image.url}
              imageName={image.file.name}
              regions={analysis.regions}
              heatmapUrl={heatmapUrl}
              note={analysis.detectionNote}
            />
          </div>
        ) : null}

        {/* 2. Risk point */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="trace-label text-trace-dim">Risk point</p>
            <p
              className={cn(
                'rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]',
                level === 'low'
                  ? 'border-trace-line bg-trace-raised text-trace-dim'
                  : 'border-trace-flag-edge bg-trace-flag-surface text-trace-flag-soft',
              )}
            >
              {RISK_LABEL[level]}
            </p>
          </div>

          <p className="mt-2 font-mono text-[30px] leading-none tabular-nums text-trace-text">
            {point}
            <span className="ml-1.5 text-[14px] text-trace-dim">/ 100</span>
          </p>

          <div
            role="meter"
            aria-label="Risk point"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={point}
            aria-valuetext={`${point} dari 100, ${RISK_LABEL[level].toLowerCase()}`}
            className="relative mt-4 h-7"
          >
            <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-trace-raised" />
            <div
              className={cn(
                'absolute top-3 left-0 h-1 rounded-full',
                level === 'low' ? 'bg-trace-neutral' : 'bg-trace-flag',
              )}
              style={{ width: `${Math.max(point, 1)}%` }}
            />
            {[RISK_BANDS.moderate, RISK_BANDS.high].map((edge) => (
              <span key={edge} aria-hidden>
                <span
                  className="absolute top-2 h-3 w-px bg-trace-accent"
                  style={{ left: `${edge}%` }}
                />
                <span
                  className="absolute top-0 -translate-x-1/2 font-mono text-[9px] whitespace-nowrap text-trace-accent"
                  style={{ left: `${edge}%` }}
                >
                  {edge}
                </span>
              </span>
            ))}
          </div>

          <p className="mt-2 text-[12.5px] leading-5 text-trace-dim">
            Risk point adalah score TB dari model yang ditulis ulang pada skala 0 sampai 100. Ini
            bukan peluang bahwa seseorang menderita tuberkulosis: model belum dikalibrasi terhadap
            populasi mana pun, dan batas {RISK_BANDS.moderate} dan {RISK_BANDS.high} hanya untuk
            tampilan, bukan ambang klinis.
          </p>
        </div>

        {/* 3. Class scores */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Score per kelas</p>
          <ul className="mt-3 space-y-3">
            {entries.map(([label, value], index) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'text-[13px]',
                      index === 0 ? 'font-medium text-trace-text' : 'text-trace-muted',
                    )}
                  >
                    {LABEL_NAME[label]}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-trace-muted">
                    {(value * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-trace-raised">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      index === 0 ? 'bg-trace-accent' : 'bg-trace-dim',
                    )}
                    style={{ width: `${Math.max(value * 100, 1)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Where it came from */}
        <dl className="grid gap-x-6 gap-y-4 border-b border-trace-line px-4 py-5 sm:grid-cols-2 sm:px-5">
          <div className="sm:col-span-2">
            <dt className="trace-label text-trace-dim">Dari mana jawaban ini</dt>
            <dd className="mt-1.5 text-[13.5px] leading-6 text-trace-muted">
              Gambar kamu dibaca oleh model <span className="font-mono text-[12px]">{analysis.model.backbone}</span>{' '}
              (<span className="font-mono text-[12px]">{analysis.model.version}</span>) yang
              berjalan langsung di browser-mu. Gambarnya tidak pernah keluar dari perangkatmu.
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="trace-label text-trace-dim">File kamu</dt>
            <dd
              title={image.file.name}
              className="mt-1.5 truncate font-mono text-[11.5px] text-trace-muted"
            >
              {image.file.name}
            </dd>
          </div>
          <div>
            <dt className="trace-label text-trace-dim">Properti</dt>
            <dd className="mt-1.5 font-mono text-[11.5px] text-trace-muted">
              {image.width} × {image.height} px · {formatBytes(image.file.size)}
            </dd>
          </div>
          {sampleImage ? (
            <div className="sm:col-span-2">
              <p className="rounded-xl border border-trace-accent-edge bg-trace-accent-surface px-3.5 py-2.5 text-[12.5px] leading-5 text-trace-accent-soft">
                Ini salah satu contoh gambar bawaan situs, dipilih acak. Hasilnya tetap keluaran
                model apa adanya, bukan jawaban yang sudah disiapkan untuk gambar ini.
              </p>
            </div>
          ) : null}
        </dl>

        {/* 5. Limitations */}
        <div className="border-b border-trace-line px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Di mana hasil seperti ini kurang</p>
          <ul className="mt-3 space-y-2">
            {LIMITATIONS.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-6 text-trace-muted">
                <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-trace-dim" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 6. Next step */}
        <div className="px-4 py-5 sm:px-5">
          <p className="trace-label text-trace-dim">Langkah berikutnya</p>
          <p className="mt-2.5 flex gap-2.5 text-[13.5px] leading-6 text-trace-text">
            <Stethoscope aria-hidden className="mt-1 size-4 shrink-0 text-trace-accent" />
            <span>{RESULT_DISCLOSURES.nextStep}</span>
          </p>
          <p className="mt-4 border-l-2 border-trace-line pl-3 text-[12px] leading-5 text-trace-dim">
            {SCREENING_DISCLAIMER}
          </p>

          <Link
            to="/how-it-works"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-trace-accent transition-colors hover:text-trace-accent-soft"
          >
            Kenapa score bukan peluang sakit
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
