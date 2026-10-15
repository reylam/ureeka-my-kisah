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
          title="Report not found"
          description="The screening record behind this report no longer exists."
          action={
            <Button variant="primary" onClick={() => navigate('/reports')}>
              Back to reports
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
          Back to the screening record
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {hasRegions ? (
            <div
              role="group"
              aria-label="Image comparison"
              className="flex items-center rounded-md bg-obsidian-100 p-0.5"
            >
              <ModeButton
                active={mode === 'side-by-side'}
                onClick={() => setMode('side-by-side')}
                icon={<Layers className="size-3.5" />}
                label="Compare"
              />
              <ModeButton
                active={mode === 'original'}
                onClick={() => setMode('original')}
                icon={<SquareDashedMousePointer className="size-3.5" />}
                label="Original"
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
            Print report
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
                TB screening report
              </h1>
              <p className="mt-0.5 text-[13px] text-obsidian-600">
                {facility?.name} · {facility?.region}, {facility?.province}
              </p>
            </div>
          </div>
          <dl className="text-right text-xs text-obsidian-600">
            <div>
              <dt className="inline text-obsidian-400">Report ref </dt>
              <dd className="inline font-mono">{screening.id}</dd>
            </div>
            <div className="mt-0.5">
              <dt className="inline text-obsidian-400">Generated </dt>
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
            Screening aid, not a diagnosis. {SIMULATED_RESULT_NOTICE}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-obsidian-600">
            {SCREENING_DISCLAIMER}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-obsidian-600">
            No machine-learning model was run on this radiograph. The output below was produced by a
            built-in simulator from the symptom data and image-quality rating recorded during
            screening, so that the screening workflow could be demonstrated. It has no clinical
            meaning and must not inform patient care.
          </p>
        </div>

        <div className="space-y-5 px-5 py-5 print:px-0">
          {/* Patient and encounter */}
          <section data-print="avoid-break" className="grid gap-5 sm:grid-cols-2">
            <div>
              <SectionTitle>Patient</SectionTitle>
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Name">{patient.name}</DetailRow>
                <DetailRow label="Record no.">
                  <span className="font-mono text-xs">{patient.mrn}</span>
                </DetailRow>
                <DetailRow label="Age and sex">
                  {ageFromBirthDate(patient.birthDate)} years · {sexLabel[patient.sex]}
                </DetailRow>
                <DetailRow label="Residence">
                  {patient.village}, {patient.district}
                </DetailRow>
              </dl>
            </div>

            <div>
              <SectionTitle>Encounter</SectionTitle>
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Screened">{formatDateTime(screening.performedAt)}</DetailRow>
                <DetailRow label="Recorded by">{operator?.name ?? 'Unknown'}</DetailRow>
                <DetailRow label="Record status">
                  <ScreeningStatusBadge status={screening.status} size="sm" />
                </DetailRow>
                <DetailRow label="Image quality">
                  <ImageQualityBadge quality={screening.imageQuality} size="sm" />
                </DetailRow>
              </dl>
            </div>
          </section>

          {/* Imaging */}
          <section data-print="avoid-break">
            <SectionTitle>Radiograph</SectionTitle>
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
                  label="Original radiograph, as captured"
                />
              ) : null}

              {hasRegions && mode !== 'original' ? (
                <XrayFrame
                  screening={screening}
                  regions={analysis?.regions ?? []}
                  showOverlay
                  label="Illustrative region overlay, numbered below"
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
                          region score {formatPercent(region.score, 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-obsidian-500">
                  <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                  The overlay is illustrative. It shows where the simulator placed boxes, not a
                  measured finding, and a highlighted region is not evidence of disease. Region
                  scores are the simulator&rsquo;s own numbers and are not calibrated.
                </p>
              </>
            ) : (
              <p className="mt-2.5 text-[13px] leading-relaxed text-obsidian-600">
                No region overlay was produced for this record.{' '}
                {analysis?.detectionNote ?? 'Localisation was not attempted.'}
              </p>
            )}
          </section>

          {/* Clinical context */}
          <section data-print="avoid-break">
            <SectionTitle>Reported symptoms and vitals</SectionTitle>
            <dl className="mt-2 divide-y divide-obsidian-100">
              <DetailRow label="Cough">
                {screening.symptoms.coughWeeks > 0
                  ? `${screening.symptoms.coughWeeks} week${screening.symptoms.coughWeeks === 1 ? '' : 's'}`
                  : 'None reported'}
              </DetailRow>
              <DetailRow label="Other symptoms">
                {reportedSymptoms.length === 0
                  ? 'None reported'
                  : reportedSymptoms.map((key) => symptomLabel[key] ?? key).join(', ')}
              </DetailRow>
              <DetailRow label="Vitals">
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
                    .join(' · ') || 'Not recorded'}
                </span>
              </DetailRow>
              <DetailRow label="Risk factors">
                {patient.riskFactors.length === 0
                  ? 'None recorded'
                  : patient.riskFactors.join(', ').replace(/-/g, ' ')}
              </DetailRow>
            </dl>
          </section>

          {/* Simulated output */}
          <section data-print="avoid-break">
            <SectionTitle>Simulated screening output</SectionTitle>
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
                No output has been generated for this record yet.
              </p>
            )}
          </section>

          {/* Model information */}
          <section data-print="avoid-break">
            <SectionTitle>Model information</SectionTitle>
            <dl className="mt-2 divide-y divide-obsidian-100">
              <DetailRow label="Source">
                {analysis?.model.name ?? 'Not applicable'}
                {analysis ? (
                  <span className="ml-1.5 font-mono text-xs text-obsidian-400">
                    {analysis.model.version}
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow label="Label set">
                {analysis?.model.labels.join(', ') ?? 'Not applicable'}
              </DetailRow>
              <DetailRow label="Architecture reference">
                {analysis?.model.backbone ?? 'Not applicable'}
              </DetailRow>
              <DetailRow label="Validation">
                <span className="text-obsidian-500">
                  None. No model was evaluated, so no accuracy, sensitivity or specificity figures
                  are reported.
                </span>
              </DetailRow>
              <DetailRow label="Analysed">
                {analysis ? formatDateTime(analysis.analysedAt) : 'Not analysed'}
              </DetailRow>
            </dl>
          </section>

          {/* Limitations */}
          <section data-print="avoid-break">
            <SectionTitle>Screening limitations</SectionTitle>
            <ul className="mt-2 space-y-1.5">
              {[
                'A screening aid narrows down who needs a confirmatory test. It cannot rule tuberculosis in or out.',
                'A chest radiograph cannot confirm TB on its own. Bacteriological confirmation, by sputum microscopy or a molecular test, is required.',
                'The absence of a screening alert does not mean the patient is free of TB. Symptoms and clinical judgement take priority.',
                'Image quality, positioning and exposure materially affect what can be read from a radiograph.',
                'In this prototype the output is simulated, so it carries no diagnostic weight whatsoever.',
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
            <SectionTitle>Human reviewer</SectionTitle>
            {screening.review ? (
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Reviewed by">
                  {reviewer?.name ?? 'Unknown'}
                  {reviewer ? (
                    <span className="ml-1.5 text-obsidian-400">
                      {reviewer.role === 'physician' ? 'Physician' : 'Nurse'}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Reviewed">{formatDateTime(screening.review.reviewedAt)}</DetailRow>
                <DetailRow label="Assessment">
                  {screening.review.agreement === 'agrees'
                    ? 'Consistent with the simulated output'
                    : screening.review.agreement === 'disagrees'
                      ? 'Not consistent with the simulated output'
                      : 'Could not conclude from this image'}
                </DetailRow>
                <DetailRow label="Decision">
                  {screening.review.decision === 'refer'
                    ? 'Refer for diagnostic testing'
                    : screening.review.decision === 'repeat-image'
                      ? 'Repeat the radiograph'
                      : screening.review.decision === 'observe'
                        ? 'Observe and recheck'
                        : 'No further action'}
                </DetailRow>
                <DetailRow label="Notes">
                  <span className="leading-relaxed">{screening.review.notes}</span>
                </DetailRow>
              </dl>
            ) : (
              <Notice tone="attention" compact className="mt-2">
                This record has not been reviewed by a clinician. Without a human review the
                screening output carries no weight at all.
              </Notice>
            )}
          </section>

          {/* Referral */}
          <section data-print="avoid-break">
            <SectionTitle>Referral status</SectionTitle>
            {referral ? (
              <dl className="mt-2 divide-y divide-obsidian-100">
                <DetailRow label="Referral">
                  <span className="font-mono text-xs">{referral.code}</span>
                </DetailRow>
                <DetailRow label="Destination">{destination?.name ?? 'Unknown facility'}</DetailRow>
                <DetailRow label="Requested">
                  {facilityServiceLabel[referral.requestedService]}
                </DetailRow>
                <DetailRow label="Status">
                  <ReferralStatusBadge status={referral.status} size="sm" />
                </DetailRow>
                <DetailRow label="Appointment">
                  {referral.appointmentDate ? formatDate(referral.appointmentDate) : 'Not booked'}
                </DetailRow>
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-obsidian-600">
                No referral has been raised from this screening record.
              </p>
            )}
          </section>

          {/* Signature block, for the printed sheet */}
          <section
            data-print="avoid-break"
            className="hidden border-t border-obsidian-300 pt-5 print:block"
          >
            <SectionTitle>Clinician sign-off</SectionTitle>
            <div className="mt-6 grid grid-cols-2 gap-8">
              <div>
                <div className="h-10 border-b border-obsidian-400" />
                <p className="mt-1.5 text-xs text-obsidian-500">Name and signature</p>
              </div>
              <div>
                <div className="h-10 border-b border-obsidian-400" />
                <p className="mt-1.5 text-xs text-obsidian-500">Date</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer repeated on the printed sheet */}
        <footer className="border-t border-obsidian-200 px-5 py-3 print:px-0">
          <p className="text-[11px] leading-relaxed text-obsidian-500">
            Generated by PULMO-TRACE, a demonstration prototype. Every record, including this patient
            and this radiograph, is synthetic. Not a medical device, not validated, and not for
            clinical use. {SIMULATED_RESULT_NOTICE}
          </p>
        </footer>
      </article>

      {/* Screen-only reminder about what printing does */}
      <Card data-print="hide" className="print:hidden">
        <CardHeader icon={<Printer />} title="Printing this report" />
        <CardBody>
          <p className="text-[13px] leading-relaxed text-obsidian-600">
            Printing uses the browser&rsquo;s own dialogue, which can also save the sheet as a PDF.
            The navigation, buttons and view switcher are removed from the printed page, and the
            comparison collapses to the original image alongside the overlay so both appear on the
            sheet.
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
