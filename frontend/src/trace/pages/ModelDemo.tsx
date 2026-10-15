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
import { OutputGlossary } from '@/trace/components/demo/OutputGlossary';
import { SampleRadiograph } from '@/components/screening/SampleRadiograph';
import { MAX_BYTES, MIN_EDGE_PX, useImageUpload } from '@/trace/hooks/useImageUpload';
import { SCENARIO_COUNT, useSimulatedInference } from '@/trace/hooks/useSimulatedInference';
import { useSyntheticSample } from '@/trace/hooks/useSyntheticSample';

/**
 * Model Demo.
 *
 * The page is arranged so that the disclosures arrive before the upload box,
 * not after the result. A reader who stops halfway down has still been told
 * that nothing here diagnoses anything and that no image leaves the device.
 *
 * All state lives in two hooks — selection and run — and the page wires them
 * together. Selecting a new image resets the run, so a stale report can never
 * sit under a different picture.
 */
export function TraceModelDemo() {
  const upload = useImageUpload();
  const inference = useSimulatedInference();

  useEffect(() => {
    document.title = 'Model Demo · PULMO-TRACE';
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
          <Eyebrow>Interactive research prototype</Eyebrow>
          <h1 className="mt-5 max-w-2xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">
            Test the TB screening workflow
          </h1>
          <p className="mt-5 max-w-2xl text-[15.5px] leading-7 text-trace-muted">
            Upload a chest X-ray to explore the screening interface, review the model output format,
            and understand what the result can and cannot establish.
          </p>

          <div className="mt-8 grid gap-3 lg:max-w-4xl lg:grid-cols-2">
            <DisclaimerBanner tone="caution" title="Research use only">
              This prototype is not intended to diagnose tuberculosis or replace professional
              medical evaluation. No trained model is connected to this build, and the output below
              is a labelled placeholder.
            </DisclaimerBanner>
            <DisclaimerBanner tone="privacy" title="Image privacy">
              Images are processed locally in this frontend demonstration — the file is read into
              browser memory to draw a preview and is never transmitted. Even so, do not upload
              identifiable patient information.
            </DisclaimerBanner>
          </div>
        </Container>
      </section>

      {/* ── B · input requirements ───────────────────────────────────── */}
      <SectionBand tone="raised" bordered={false} className="py-12 sm:py-14">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <SectionHeading
              eyebrow="Input"
              title="One chest X-ray image"
              level={3}
              standfirst="A single frontal radiograph. This prototype does not ask for a lateral view, because requiring a second projection would only make sense if a model needed one — and none is connected."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <RequirementCard
                icon={FileImage}
                label="Accepted"
                lines={[
                  'JPG, JPEG or PNG',
                  `Up to ${MAX_BYTES / 1_000_000} MB`,
                  `Shorter edge ≥ ${MIN_EDGE_PX} px`,
                ]}
              />
              <RequirementCard
                icon={Microscope}
                label="Recommended"
                lines={[
                  'Clear frontal (PA) projection',
                  'Whole thorax in frame',
                  'Original file, not a photo of a screen',
                ]}
              />
              <div className="rounded-md border border-trace-line bg-trace-card p-4 sm:col-span-2">
                <p className="trace-label text-trace-dim">No image to hand?</p>
                <p className="mt-2 text-[13px] leading-6 text-trace-muted">
                  Generate a synthetic radiograph. It is drawn from SVG primitives, watermarked, and
                  passes through exactly the same validation as your own file. No real patient image
                  is bundled with this site.
                </p>
                <TraceButton
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={sample.load}
                  disabled={sample.isBuilding}
                >
                  <Sparkles aria-hidden className="size-3.5" />
                  {sample.isBuilding ? 'Preparing…' : 'Use synthetic sample'}
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
                  onClick={() => upload.image && inference.run(upload.image.key)}
                >
                  Analyze Chest X-ray
                  <ArrowRight aria-hidden className="size-4" />
                </TraceButton>

                {inference.state === 'done' || inference.state === 'error' ? (
                  <TraceButton variant="secondary" onClick={inference.reset}>
                    <RotateCcw aria-hidden className="size-4" />
                    Reset run
                  </TraceButton>
                ) : null}

                {upload.image && inference.state !== 'running' ? (
                  <TraceButton
                    variant="ghost"
                    size="sm"
                    onClick={inference.simulateFailure}
                    title="Walks the interface into its error state so it can be reviewed"
                  >
                    Simulate a failed run
                  </TraceButton>
                ) : null}
              </div>

              {!upload.image ? (
                <p className="text-[12.5px] leading-5 text-trace-dim">
                  The analyse button stays disabled until a valid image is loaded. There is nothing
                  to report without one.
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
              />

              <div className="rounded-md border border-trace-line bg-trace-card px-4 py-4">
                <p className="trace-label text-trace-dim">How the placeholder is chosen</p>
                <p className="mt-2 text-[12.5px] leading-6 text-trace-muted">
                  There are {SCENARIO_COUNT} fixed outcomes. One is selected by hashing the file
                  name, size and modification time — never the pixels. The same file always produces
                  the same report, and nothing is random, so a demo can be rehearsed and a reviewer
                  can reproduce what they saw.
                </p>
              </div>
            </div>
          </div>

          {/* Result */}
          {inference.state === 'done' && inference.result && upload.image ? (
            <SimulatedResultPanel
              scenario={inference.result}
              image={upload.image}
              className="mt-6"
            />
          ) : null}
        </Container>
      </SectionBand>

      {/* ── F · understanding the output ─────────────────────────────── */}
      <SectionBand tone="raised" labelledBy="glossary-heading">
        <Container>
          <SectionHeading
            id="glossary-heading"
            eyebrow="Reading the output"
            title="What does this output actually mean?"
            standfirst="Three terms that get used as though they were the same thing."
          />
          <div className="mt-9">
            <OutputGlossary />
          </div>
        </Container>
      </SectionBand>

      {/* ── G · research CTA ─────────────────────────────────────────── */}
      <SectionBand labelledBy="demo-cta-heading">
        <Container width="narrow" className="text-center">
          <Eyebrow className="justify-center">Methodology</Eyebrow>
          <h2
            id="demo-cta-heading"
            className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.025em] sm:text-[32px]"
          >
            Understand the method behind the output
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-trace-muted">
            An output format is only as good as the evaluation behind it. The research page sets out
            the dataset documentation, the training and validation procedure, the metrics, the
            failure modes, and what has not been measured.
          </p>
          <TraceLinkButton to="/research" className="mt-8">
            <BookOpen aria-hidden className="size-4" />
            Read the Research
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
