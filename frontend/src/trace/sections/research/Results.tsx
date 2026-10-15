import { useId, useState } from 'react';
import { Container, SectionBand } from '@/trace/components/ui/Container';
import { SectionHeading } from '@/trace/components/ui/SectionHeading';
import { MetricCard } from '@/trace/components/ui/MetricCard';
import { DataTable, type Column } from '@/trace/components/ui/DataTable';
import { EmptyResultsState } from '@/trace/components/ui/EmptyResultsState';
import { ConfusionMatrix } from '@/trace/components/research/ConfusionMatrix';
import { ResearchChart, PALETTE } from '@/trace/components/charts/ResearchChart';
import { CurveChart } from '@/trace/components/charts/CurveChart';
import { LineChart } from '@/trace/components/charts/LineChart';
import { StackedBars } from '@/trace/components/charts/StackedBars';
import { CLASS_DISTRIBUTION } from '@/trace/data/datasets';
import {
  CONFIG_COMPARISON,
  CONFUSION,
  EVAL_SPLIT,
  ILLUSTRATIVE_CAPTION,
  MISSING_ANALYSES,
  PR_CURVE,
  PR_OPERATING_POINT,
  ROC_CURVE,
  ROC_OPERATING_POINT,
  TEST_METRICS,
  TRAINING_CURVE,
} from '@/trace/data/evaluation';
import { cn } from '@/utils/cn';

type ConfigRow = (typeof CONFIG_COMPARISON)[number];

const CONFIG_COLUMNS: Column<ConfigRow>[] = [
  {
    key: 'id',
    header: 'Config',
    render: (row) => (
      <span className="font-mono text-trace-text">
        {row.id}
        {row.selected ? (
          <span className="ml-2 font-sans text-[10.5px] uppercase tracking-[0.08em] text-trace-accent-soft">
            selected
          </span>
        ) : null}
      </span>
    ),
  },
  { key: 'backbone', header: 'Backbone', render: (row) => row.backbone },
  { key: 'input', header: 'Input', numeric: true, render: (row) => row.input },
  { key: 'valAuc', header: 'Val ROC-AUC', numeric: true, render: (row) => row.valAuc },
  { key: 'testAuc', header: 'Test ROC-AUC', numeric: true, render: (row) => row.testAuc },
  {
    key: 'sens',
    header: 'Sens. @ 90% spec.',
    numeric: true,
    render: (row) => row.sensAt90Spec,
  },
];

/**
 * Results dashboard, with two states.
 *
 * State A is the default and the truthful one for this build: no experiment has
 * been run, so there is nothing to show. State B renders the full dashboard
 * from mock data, which is what makes the layout reviewable.
 *
 * The toggle is a real radio group rather than a tab-styled pair of buttons,
 * because the two options are mutually exclusive claims about what exists —
 * and the reader should be able to tell which one they are looking at from the
 * control, not only from the badges.
 */
export function Results() {
  const [mode, setMode] = useState<'none' | 'demo'>('none');
  const groupId = useId();

  const splitRows = ['train', 'validation', 'test'].map((split) => ({
    label: split === 'train' ? 'Training' : split === 'validation' ? 'Validation' : 'Test',
    segments: CLASS_DISTRIBUTION.map((entry) => ({
      label: entry.className,
      value: entry[split as 'train' | 'validation' | 'test'],
    })),
  }));

  return (
    <SectionBand id="results" tone="raised" labelledBy="results-heading">
      <Container>
        <SectionHeading
          id="results-heading"
          index="06"
          eyebrow="Results"
          title="What did the experiments produce?"
          standfirst="Nothing yet. The dashboard below can be switched into a demonstration mode so the reporting layout can be reviewed, with every panel marked as mock data."
        />

        {/* State switch */}
        <fieldset className="mt-8 rounded-md border border-trace-line bg-trace-card p-4">
          <legend className="trace-label px-1 text-trace-dim">Dashboard state</legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-3">
            {(
              [
                {
                  value: 'none' as const,
                  label: 'No verified results',
                  detail: 'The true state of this build',
                },
                {
                  value: 'demo' as const,
                  label: 'Demonstration data',
                  detail: 'Mock figures, for layout review',
                },
              ] satisfies { value: 'none' | 'demo'; label: string; detail: string }[]
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex flex-1 cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors',
                  mode === option.value
                    ? 'border-[#2b445f] bg-trace-accent-surface'
                    : 'border-trace-line hover:border-[#3a414c]',
                )}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="mt-1 size-3.5 shrink-0 accent-[#5b9fe8]"
                />
                <span>
                  <span className="block text-[13.5px] font-medium text-trace-text">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-trace-dim">{option.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'none' ? (
          <div className="mt-6 space-y-4">
            <EmptyResultsState
              title="No verified experiment results available yet."
              requirement="A trained model, a patient-level data split, and one scoring pass over a test set that was not used for model selection or threshold tuning."
            >
              <p className="max-w-2xl text-[13px] leading-6 text-trace-muted">
                This is not an error state. It is what the results section of an honest research
                page looks like before the experiments have been run. Switch the control above to
                demonstration data to inspect the reporting layout.
              </p>
            </EmptyResultsState>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MISSING_ANALYSES.map((item) => (
                <EmptyResultsState
                  key={item.title}
                  title={item.title}
                  requirement={item.requirement}
                  compact
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Metric summary */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TEST_METRICS.map((metric) => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
            </div>

            <p className="font-mono text-[11.5px] text-trace-dim">
              τ = {EVAL_SPLIT.threshold} · n = {EVAL_SPLIT.images} ({EVAL_SPLIT.positives}{' '}
              TB-labelled, {EVAL_SPLIT.negatives} non-TB) · {ILLUSTRATIVE_CAPTION}
            </p>

            {/* Matrix and curves */}
            <div className="grid gap-5 lg:grid-cols-3">
              <ConfusionMatrix
                data={CONFUSION}
                thresholdLabel={`At τ = ${EVAL_SPLIT.threshold}, on the illustrative test split`}
              />

              <ResearchChart
                title="ROC curve"
                subtitle="True-positive rate against false-positive rate"
                provenance="illustrative"
                sampleSize="720 images"
                legend={[
                  { label: 'Model', colour: PALETTE.accent },
                  { label: 'Chance', colour: PALETTE.neutral, dashed: true },
                  { label: `Operating point τ = ${EVAL_SPLIT.threshold}`, colour: PALETTE.flag },
                ]}
                caption="Area under the curve is 0.898. Threshold-free, so it describes the ranking of scores and says nothing about behaviour at the point actually deployed — which is marked."
              >
                <CurveChart
                  points={ROC_CURVE}
                  operatingPoint={ROC_OPERATING_POINT}
                  baseline="diagonal"
                  xLabel="False-positive rate (1 − specificity)"
                  yLabel="True-positive rate (sensitivity)"
                  operatingLabel="τ 0.35"
                  ariaLabel="Illustrative ROC curve. The true-positive rate rises steeply to about 0.74 by a false-positive rate of 0.10, then flattens. Area under the curve is 0.898. The deployed operating point sits at a false-positive rate of 0.31 and a true-positive rate of 0.90."
                />
              </ResearchChart>

              <ResearchChart
                title="Precision-recall curve"
                subtitle="The view that exposes class imbalance"
                provenance="illustrative"
                sampleSize="720 images"
                legend={[
                  { label: 'Model', colour: PALETTE.accent },
                  { label: 'No-skill baseline (0.175)', colour: PALETTE.neutral, dashed: true },
                  { label: 'Operating point', colour: PALETTE.flag },
                ]}
                caption="Average precision 0.656 against a no-skill baseline of 0.175, the positive prevalence of this split. Precision falls away as recall rises — the trade-off a screening threshold has to settle."
              >
                <CurveChart
                  points={PR_CURVE}
                  operatingPoint={PR_OPERATING_POINT}
                  baseline={0.175}
                  xLabel="Recall (sensitivity)"
                  yLabel="Precision"
                  operatingLabel="τ 0.35"
                  ariaLabel="Illustrative precision-recall curve. Precision falls from about 0.82 at recall 0.21 to 0.175 at recall 1.0, where it meets the no-skill baseline. Average precision is 0.656. The deployed operating point sits at recall 0.90 and precision 0.38."
                />
              </ResearchChart>
            </div>

            {/* Training curves and composition */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ResearchChart
                title="Training and validation loss"
                subtitle="20 epochs"
                provenance="illustrative"
                legend={[
                  { label: 'Training loss', colour: PALETTE.accent },
                  { label: 'Validation loss', colour: PALETTE.accentSoft, dashed: true },
                ]}
                caption="Training loss keeps falling while validation loss turns upward after epoch 13. That divergence, not the final training loss, is what decides which checkpoint is kept."
              >
                <LineChart
                  series={[
                    {
                      id: 'train',
                      colour: PALETTE.accent,
                      points: TRAINING_CURVE.map((p) => ({ x: p.epoch, y: p.trainLoss })),
                    },
                    {
                      id: 'val',
                      colour: PALETTE.accentSoft,
                      dashed: true,
                      points: TRAINING_CURVE.map((p) => ({ x: p.epoch, y: p.valLoss })),
                    },
                  ]}
                  xDomain={[1, 20]}
                  yDomain={[0, 0.7]}
                  xTicks={[1, 5, 10, 15, 20]}
                  yTicks={[0, 0.2, 0.4, 0.6]}
                  formatY={(value) => value.toFixed(1)}
                  xLabel="Epoch"
                  yLabel="Loss"
                  marker={{ x: 13, label: 'selected' }}
                  ariaLabel="Illustrative training curves over 20 epochs. Training loss falls steadily from 0.61 to 0.07. Validation loss falls to a minimum of 0.364 at epoch 13, then rises to 0.47 by epoch 20. Epoch 13 is marked as the selected checkpoint."
                />
              </ResearchChart>

              <ResearchChart
                title="Class composition by split"
                subtitle="Images per split, by reference label"
                provenance="illustrative"
                sampleSize="4 800 images"
                caption="Printed as counts rather than proportions. 126 positive cases in the test split is the number that governs how wide the confidence interval on every rate above would be."
              >
                <StackedBars rows={splitRows} />
              </ResearchChart>
            </div>

            {/* Config comparison */}
            <div>
              <h3 className="text-[16px] font-medium text-trace-text">
                Configuration comparison
              </h3>
              <p className="mt-2 max-w-3xl text-[13.5px] leading-6 text-trace-muted">
                Three candidate configurations. The gap between validation and test AUC in every row
                is the cost of having used the validation split to choose, and it is the reason the
                test column is the only one worth quoting.
              </p>
              <DataTable
                className="mt-4"
                columns={CONFIG_COLUMNS}
                rows={[...CONFIG_COMPARISON]}
                rowKey={(row) => row.id}
                highlight={(row) => row.selected}
                caption={`${ILLUSTRATIVE_CAPTION} Sensitivity is quoted at the threshold that yields 90% specificity, so the three rows are compared at a matched operating point.`}
              />
            </div>

            {/* Still missing, even in demo mode */}
            <div className="grid gap-3 sm:grid-cols-2">
              {MISSING_ANALYSES.slice(0, 2).map((item) => (
                <EmptyResultsState
                  key={item.title}
                  title={item.title}
                  requirement={item.requirement}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </SectionBand>
  );
}
