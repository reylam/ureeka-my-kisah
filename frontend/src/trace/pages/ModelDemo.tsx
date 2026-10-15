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
import { Mascot } from '@/trace/components/visuals/Mascot';
import { MAX_BYTES, MIN_EDGE_PX, useImageUpload } from '@/trace/hooks/useImageUpload';
import { useSimulatedInference } from '@/trace/hooks/useSimulatedInference';
import { useSyntheticSample } from '@/trace/hooks/useSyntheticSample';

/**
 * Model Demo.
 *
 * The page is arranged so that the disclosures arrive before the upload box,
 * not after the result. A reader who stops halfway down has still been told
 * that nothing here diagnoses anything and that no image leaves the device.
 *
 * All state lives in two hooks, selection and run, and the page wires them
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
          <Eyebrow>Screening demo</Eyebrow>
          <h1 className="mt-5 max-w-2xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[40px]">
            Walk through the whole flow
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-trace-muted">
            Pick a chest X-ray and see what the screening step would look like: the checks on the
            image, the result it produces, and the wording that has to come with it. Takes about a
            minute.
          </p>

          <div className="mt-8 grid gap-3 lg:max-w-4xl lg:grid-cols-2">
            <DisclaimerBanner tone="caution" title="This cannot tell you if you have TB">
              It is a demonstration of an interface. No trained model is connected to it, so the
              result below is a clearly marked stand-in and not a judgement about any image. If you
              are worried about tuberculosis, see a health professional.
            </DisclaimerBanner>
            <DisclaimerBanner tone="privacy" title="Your file stays on your device">
              The image is read by your own browser to draw the preview. Nothing is uploaded, and
              nothing is stored. Even so, please do not use a file that carries someone’s name or
              patient number.
            </DisclaimerBanner>
          </div>
        </Container>
      </section>

      {/* ── B · input requirements ───────────────────────────────────── */}
      <SectionBand tone="raised" bordered={false} className="py-12 sm:py-14">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <SectionHeading
              eyebrow="What you need"
              title="One chest X-ray image"
              level={3}
              standfirst="A single front-facing chest X-ray, the ordinary kind. Only one picture is needed, and you do not need a side view."
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
              <div className="relative rounded-2xl border border-trace-line bg-trace-card p-5 sm:col-span-2">
                <p className="trace-label text-trace-dim">No X-ray to hand?</p>
                <p className="mt-2.5 text-[13.5px] leading-6 text-trace-muted">
                  Use a drawn one instead. It is generated in code, marked as an illustration, and
                  goes through exactly the same checks as your own file. No real patient’s X-ray is
                  included anywhere on this site.
                </p>
                <TraceButton
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={sample.load}
                  disabled={sample.isBuilding}
                >
                  <Sparkles aria-hidden className="size-3.5" />
                  {sample.isBuilding ? 'Preparing…' : 'Use a drawn example'}
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
                  Check this X-ray
                  <ArrowRight aria-hidden className="size-4" />
                </TraceButton>

                {inference.state === 'done' || inference.state === 'error' ? (
                  <TraceButton variant="secondary" onClick={inference.reset}>
                    <RotateCcw aria-hidden className="size-4" />
                    Start over
                  </TraceButton>
                ) : null}
              </div>

              {!upload.image ? (
                <p className="text-[12.5px] leading-5 text-trace-dim">
                  The button stays switched off until an image is loaded, since there is nothing to
                  show without one.
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

              {/* Waiting state only. Once there is an image, and certainly once
                  there is a result, a cartoon face is the wrong note. */}
              {!upload.image ? (
                <div className="flex items-center gap-4 rounded-2xl border border-trace-line bg-trace-card p-5">
                  <Mascot size="sm" />
                  <p className="text-[13px] leading-6 text-trace-muted">
                    Nothing loaded yet. Pick an X-ray on the left, or use the drawn example if you
                    do not have one to hand.
                  </p>
                </div>
              ) : null}
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

      {/* ── G · onward ───────────────────────────────────────────────── */}
      <SectionBand labelledBy="demo-cta-heading">
        <Container width="narrow" className="text-center">
          <Eyebrow className="justify-center">Next</Eyebrow>
          <h2
            id="demo-cta-heading"
            className="mt-5 text-[26px] leading-tight font-semibold tracking-[-0.025em] sm:text-[32px]"
          >
            Curious how it would actually work?
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-trace-muted">
            The explainer goes through the whole idea in plain language: how software learns to
            recognise patterns in an X-ray, why a score is not a percentage chance, and where this
            sits in the path from screening to treatment.
          </p>
          <TraceLinkButton to="/how-it-works" className="mt-8">
            <BookOpen aria-hidden className="size-4" />
            How it works
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
