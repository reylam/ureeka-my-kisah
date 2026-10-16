import { useCallback, useEffect } from 'react';
import { ArrowRight, BookOpen, FileImage, Microscope, RotateCcw, Sparkles } from 'lucide-react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { Eyebrow, SectionHeading } from '@/trace/components/ui/SectionHeading';
import { TraceButton, TraceLinkButton } from '@/trace/components/ui/TraceButton';
import { DisclaimerBanner } from '@/trace/components/ui/DisclaimerBanner';
import { UploadDropzone } from '@/trace/components/demo/UploadDropzone';
import { ImagePreview } from '@/trace/components/demo/ImagePreview';
import { InferenceStatus } from '@/trace/components/demo/InferenceStatus';
import { SimulatedResultPanel } from '@/trace/components/demo/SimulatedResultPanel';
import { ModelResultPanel } from '@/trace/components/demo/ModelResultPanel';
import { OutputGlossary } from '@/trace/components/demo/OutputGlossary';
import { SampleRadiograph } from '@/components/screening/SampleRadiograph';
import { Mascot } from '@/trace/components/visuals/Mascot';
import { MAX_BYTES, MIN_EDGE_PX, useImageUpload } from '@/trace/hooks/useImageUpload';
import { useDemoInference } from '@/trace/hooks/useDemoInference';
import { useSyntheticSample } from '@/trace/hooks/useSyntheticSample';
import { localModelSupported, preloadLocalModel } from '@/services/localModel';

/**
 * Model Demo.
 *
 * The page is arranged so that the disclosures arrive before the upload box,
 * not after the result. A reader who stops halfway down has still been told
 * that nothing here diagnoses anything and what happens to the image.
 *
 * Two modes, decided by whether this browser can run the screening model
 * (WebAssembly). Where it can, the model runs in the tab and the image is read
 * by it right there; where it cannot, the page runs the stand-in. Either way the
 * image stays on the device, and the page says what is doing the reading. The
 * model starts downloading as soon as the page opens, so it is usually ready by
 * the time a file has been picked.
 *
 * All state lives in two hooks, selection and run, and the page wires them
 * together. Selecting a new image resets the run, so a stale report can never
 * sit under a different picture.
 */
export function TraceModelDemo() {
  const upload = useImageUpload();

  const live = localModelSupported();
  const inference = useDemoInference(live);

  useEffect(() => {
    preloadLocalModel();
  }, []);

  useEffect(() => {
    document.title = 'Demo Model · PARUPINTAS';
  }, []);

  const { select, clear } = upload;
  const { reset } = inference;

  // Any change of input invalidates the previous report.
  const selectAndReset = useCallback(
    (file: File | null | undefined) => {
      reset();
      select(file);
    },
    [reset, select],
  );

  const removeAndReset = useCallback(() => {
    reset();
    clear();
  }, [reset, clear]);

  const sample = useSyntheticSample(selectAndReset);

  const canAnalyse = Boolean(upload.image) && inference.state !== 'running';

  return (
    <>
      {/* ── A · introduction ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-trace-line">
        <div aria-hidden className="trace-grid trace-grid-mask absolute inset-0" />
        <Container className="relative py-14 sm:py-16">
          <Eyebrow>Demo screening</Eyebrow>
          <h1 className="mt-5 max-w-2xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">
            Telusuri seluruh alurnya
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-trace-muted">
            Pilih chest X-ray dan lihat seperti apa langkah screening-nya: pengecekan gambar, hasil
            yang dihasilkan, dan kata-kata yang harus menyertainya. Cuma butuh sekitar satu menit.
          </p>

          <div className="mt-8 grid gap-3 lg:max-w-4xl lg:grid-cols-2">
            <DisclaimerBanner tone="caution" title="Ini tidak bisa memberitahumu apakah kamu menderita TB">
              {live
                ? 'Model terlatih membaca gambar dan memberi tiga score serta satu risk point, tetapi belum divalidasi secara klinis di sini dan tidak ada angka akurasi yang diklaim. Ini alat bantu screening, bukan penilaian tentang seseorang. Kalau kamu khawatir soal tuberkulosis, temui tenaga kesehatan.'
                : 'Ini hanya demonstrasi antarmuka. Belum ada model terlatih yang terhubung, jadi hasil di bawah adalah placeholder yang diberi label jelas dan bukan penilaian atas gambar mana pun. Kalau kamu khawatir soal tuberkulosis, temui tenaga kesehatan.'}
            </DisclaimerBanner>
            <DisclaimerBanner tone="privacy" title="File kamu tetap ada di perangkatmu">
              {live
                ? 'Modelnya berjalan langsung di browser-mu. Gambar dibaca di sini, tidak di-upload ke server mana pun, dan tidak ada yang disimpan. Yang diunduh hanya file model (sekitar 6 MB) saat pertama kali dipakai. Tetap saja, jangan pakai file yang memuat nama atau nomor pasien seseorang.'
                : 'Gambar dibaca oleh browser-mu sendiri untuk menampilkan preview. Tidak ada yang di-upload, dan tidak ada yang disimpan. Tetap saja, jangan pakai file yang memuat nama atau nomor pasien seseorang.'}
            </DisclaimerBanner>
          </div>
        </Container>
      </section>

      {/* ── B · input requirements ───────────────────────────────────── */}
      <SectionBand tone="raised" bordered={false} className="py-12 sm:py-14">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <SectionHeading
              eyebrow="Yang kamu butuhkan"
              title="Satu gambar chest X-ray"
              level={3}
              standfirst="Satu chest X-ray tampak depan, yang biasa saja. Cukup satu gambar, tidak perlu tampak samping."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <RequirementCard
                icon={FileImage}
                label="Diterima"
                lines={[
                  'JPG, JPEG, atau PNG',
                  `Hingga ${MAX_BYTES / 1_000_000} MB`,
                  `Sisi terpendek ≥ ${MIN_EDGE_PX} px`,
                ]}
              />
              <RequirementCard
                icon={Microscope}
                label="Disarankan"
                lines={[
                  'Proyeksi frontal (PA) yang jelas',
                  'Seluruh toraks masuk dalam frame',
                  'File asli, bukan foto layar',
                ]}
              />
              <div className="relative rounded-2xl border border-trace-line bg-trace-card p-5 sm:col-span-2">
                <p className="trace-label text-trace-dim">Tidak punya X-ray?</p>
                <p className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">
                  Pakai yang digambar saja. Gambar ini dibuat lewat kode, diberi label sebagai
                  ilustrasi, dan melewati pengecekan yang persis sama dengan file milikmu. Tidak ada
                  X-ray pasien sungguhan di mana pun di situs ini.
                  {live
                    ? ' Model tetap akan memberinya score, tetapi gambar bukan paru-paru, jadi score itu tidak berarti apa-apa.'
                    : ''}
                </p>
                <TraceButton
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={sample.load}
                  disabled={sample.isBuilding}
                >
                  <Sparkles aria-hidden className="size-3.5" />
                  {sample.isBuilding ? 'Menyiapkan…' : 'Pakai contoh gambar'}
                </TraceButton>
                {sample.error ? (
                  <p role="alert" className="mt-2 text-[12.5px] text-trace-flag">
                    {sample.error}
                  </p>
                ) : null}

                {/* Off-screen source for the rasteriser. Not shown to anyone. */}
                <div
                  ref={sample.containerRef}
                  aria-hidden
                  className="pointer-events-none absolute size-px overflow-hidden opacity-0"
                >
                  <SampleRadiograph variant="sample-a" />
                </div>
              </div>
            </div>
          </div>
        </Container>
      </SectionBand>

      {/* ── C + D + E · upload, run state, result ────────────────────── */}
      <SectionBand id="workflow" className="pt-12 sm:pt-14">
        <Container>
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
            {/* Left column: input */}
            <div className="space-y-5">
              {upload.image ? (
                <ImagePreview image={upload.image} onRemove={removeAndReset} />
              ) : null}

              <UploadDropzone
                onSelect={selectAndReset}
                error={upload.error}
                isReading={upload.isReading}
                hasImage={Boolean(upload.image)}
              />

              <div className="flex flex-wrap items-center gap-3">
                <TraceButton
                  disabled={!canAnalyse}
                  onClick={() => upload.image && inference.run(upload.image)}
                >
                  Periksa X-ray ini
                  <ArrowRight aria-hidden className="size-4" />
                </TraceButton>

                {inference.state === 'done' || inference.state === 'error' ? (
                  <TraceButton variant="secondary" onClick={inference.reset}>
                    <RotateCcw aria-hidden className="size-4" />
                    Mulai ulang
                  </TraceButton>
                ) : null}
              </div>

              {!upload.image ? (
                <p className="text-[12.5px] leading-5 text-trace-dim">
                  Tombol ini nonaktif sampai ada gambar yang dimuat, karena tanpa gambar tidak ada
                  yang bisa ditampilkan.
                </p>
              ) : null}
            </div>

            {/* Right column: run state */}
            <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
              <InferenceStatus
                state={inference.state}
                hasImage={Boolean(upload.image)}
                stageIndex={inference.stageIndex}
                progress={inference.progress}
                errorMessage={inference.errorMessage}
                stages={inference.stages}
                live={inference.mode === 'live'}
              />

              {/* Waiting state only. Once there is an image, and certainly once
                  there is a result, a cartoon face is the wrong note. */}
              {!upload.image ? (
                <div className="flex items-center gap-4 rounded-2xl border border-trace-line bg-trace-card p-5">
                  <Mascot size="sm" />
                  <p className="text-[13px] leading-6 text-trace-muted">
                    Belum ada yang dimuat. Pilih X-ray di sebelah kiri, atau pakai contoh gambar
                    kalau kamu tidak punya.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Result */}
          {inference.state === 'done' && upload.image ? (
            inference.analysis ? (
              <ModelResultPanel
                analysis={inference.analysis}
                image={upload.image}
                className="mt-6"
              />
            ) : inference.scenario ? (
              <SimulatedResultPanel
                scenario={inference.scenario}
                image={upload.image}
                className="mt-6"
              />
            ) : null
          ) : null}
        </Container>
      </SectionBand>

      {/* ── F · understanding the output ─────────────────────────────── */}
      <SectionBand tone="raised" labelledBy="glossary-heading">
        <Container>
          <SectionHeading
            id="glossary-heading"
            eyebrow="Membaca output"
            title="Sebenarnya apa arti output ini?"
            standfirst="Tiga istilah yang sering dipakai seolah-olah sama."
          />
          <div className="mt-9">
            <OutputGlossary />
          </div>
        </Container>
      </SectionBand>

      {/* ── G · onward ───────────────────────────────────────────────── */}
      <SectionBand labelledBy="demo-cta-heading">
        <Container width="narrow" className="text-center">
          <Eyebrow className="justify-center">Selanjutnya</Eyebrow>
          <h2
            id="demo-cta-heading"
            className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.025em] sm:text-[32px]"
          >
            Penasaran bagaimana sebenarnya cara kerjanya?
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-trace-muted">
            Halaman penjelasan membahas seluruh idenya dengan bahasa sederhana: bagaimana software
            belajar mengenali pola di X-ray, kenapa score bukan peluang dalam persen, dan di mana
            posisi tools ini dalam alur dari screening sampai pengobatan.
          </p>
          <TraceLinkButton to="/how-it-works" className="mt-8">
            <BookOpen aria-hidden className="size-4" />
            Cara kerja
          </TraceLinkButton>
        </Container>
      </SectionBand>
    </>
  );
}

function RequirementCard({
  icon: Icon,
  label,
  lines,
}: {
  icon: typeof FileImage;
  label: string;
  lines: string[];
}) {
  return (
    <div className="rounded-md border border-trace-line bg-trace-card p-4">
      <p className="flex items-center gap-2 trace-label text-trace-dim">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </p>
      <ul className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <li key={line} className="font-mono text-[11.5px] leading-5 text-trace-muted">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
