import type { ConfusionMatrixData, FieldRow, MetricValue, Point } from '@/trace/types';

/**
 * Evaluation mock data.
 *
 * None of this was measured. It is a hand-built example of what a complete
 * evaluation report looks like, and every component that renders it stamps it
 * "illustrative".
 *
 * Two rules were followed while writing these numbers, because a mock dataset
 * that contradicts itself teaches the reader the wrong things:
 *
 *   1. Internal consistency. The confusion matrix, the rates, the threshold
 *      sweep and the plotted curves all describe the same imagined 720-image
 *      test split (594 non-TB, 126 TB-related). Rates are the actual ratios of
 *      the counts, the operating points sit on the plotted ROC curve, and the
 *      quoted AUC is the trapezoidal area under the points that are drawn.
 *   2. Realistic shape. A positive predictive value of 0.38 at 17.5% positive
 *      prevalence, falling further at screening prevalence, is what a credible
 *      chest X-ray screening model looks like. Numbers in the high nineties
 *      would be a nicer demo and a worse education.
 *
 * Nothing changes between renders. There are no random values anywhere here.
 */

export const EVAL_SPLIT = {
  name: 'Imagined held-out test split',
  images: 720,
  negatives: 594,
  positives: 126,
  prevalence: 0.175,
  threshold: 0.35,
  thresholdRationale:
    'Chosen on the validation split to favour sensitivity, as a screening tool should. It is not the default 0.5.',
} as const;

export const ILLUSTRATIVE_CAPTION = 'Illustrative data — not measured model performance.';

/* ───────────────────────── headline metric summary ───────────────────────── */

/** At the operating threshold τ = 0.35. Every value is a ratio of CONFUSION. */
export const TEST_METRICS: MetricValue[] = [
  {
    key: 'sensitivity',
    label: 'Sensitivity',
    value: '0.897',
    raw: 0.8968,
    provenance: 'illustrative',
    caption: '113 of 126 TB-labelled images flagged. 13 missed.',
  },
  {
    key: 'specificity',
    label: 'Specificity',
    value: '0.690',
    raw: 0.6902,
    provenance: 'illustrative',
    caption: '410 of 594 non-TB images left unflagged. 184 flagged anyway.',
  },
  {
    key: 'precision',
    label: 'Precision (PPV)',
    value: '0.381',
    raw: 0.3805,
    provenance: 'illustrative',
    caption: '113 of 297 flagged images carry the TB label, at 17.5% positive prevalence.',
  },
  {
    key: 'f1',
    label: 'F1-score',
    value: '0.534',
    raw: 0.5343,
    provenance: 'illustrative',
    caption: 'Harmonic mean of the sensitivity and precision above.',
  },
  {
    key: 'rocAuc',
    label: 'ROC-AUC',
    value: '0.898',
    raw: 0.898,
    provenance: 'illustrative',
    caption: 'Trapezoidal area under the plotted ROC points. Threshold-independent.',
  },
  {
    key: 'avgPrecision',
    label: 'Average precision',
    value: '0.656',
    raw: 0.656,
    provenance: 'illustrative',
    caption: 'Area under the precision-recall curve. The no-skill baseline is 0.175.',
  },
];

/** The same numbers in a one-line form for the homepage preview. */
export const HOME_METRIC_PREVIEW: MetricValue[] = TEST_METRICS.filter((metric) =>
  ['sensitivity', 'specificity', 'precision', 'rocAuc'].includes(metric.key),
);

/* ───────────────────────────── confusion matrix ───────────────────────────── */

export const CONFUSION: ConfusionMatrixData = {
  classNames: ['Non-TB reference', 'TB-related reference'],
  counts: [
    [410, 184], // reference non-TB: TN, FP
    [13, 113], // reference TB:     FN, TP
  ],
  provenance: 'illustrative',
  support: 720,
};

/* ────────────────────────────── curves ────────────────────────────── */

/**
 * ROC points, false-positive rate against true-positive rate.
 * Monotonic, anchored at (0,0) and (1,1). Trapezoidal area = 0.898.
 */
export const ROC_CURVE: Point[] = [
  { x: 0, y: 0 },
  { x: 0.01, y: 0.21 },
  { x: 0.02, y: 0.33 },
  { x: 0.04, y: 0.55 },
  { x: 0.06, y: 0.63 },
  { x: 0.1, y: 0.74 },
  { x: 0.15, y: 0.82 },
  { x: 0.2, y: 0.865 },
  { x: 0.26, y: 0.875 },
  { x: 0.31, y: 0.9 },
  { x: 0.33, y: 0.91 },
  { x: 0.42, y: 0.94 },
  { x: 0.55, y: 0.965 },
  { x: 0.7, y: 0.982 },
  { x: 0.85, y: 0.993 },
  { x: 1, y: 1 },
];

/** Where τ = 0.35 sits on the curve above: FPR 0.310, TPR 0.900. */
export const ROC_OPERATING_POINT: Point = { x: 0.31, y: 0.9 };

/** Precision against recall, derived from the ROC points and the class counts. */
export const PR_CURVE: Point[] = [
  { x: 0.21, y: 0.817 },
  { x: 0.33, y: 0.778 },
  { x: 0.55, y: 0.745 },
  { x: 0.63, y: 0.69 },
  { x: 0.74, y: 0.611 },
  { x: 0.82, y: 0.537 },
  { x: 0.865, y: 0.478 },
  { x: 0.875, y: 0.417 },
  { x: 0.9, y: 0.381 },
  { x: 0.91, y: 0.369 },
  { x: 0.94, y: 0.322 },
  { x: 0.965, y: 0.271 },
  { x: 0.982, y: 0.229 },
  { x: 0.993, y: 0.199 },
  { x: 1, y: 0.175 },
];

export const PR_OPERATING_POINT: Point = { x: 0.9, y: 0.381 };

/* ──────────────────────────── threshold sweep ──────────────────────────── */

/**
 * The point of this table: these five rows are the same model on the same
 * images. Only the threshold moves. Anyone quoting a single sensitivity figure
 * without its threshold is quoting one row and hiding the other four.
 */
export const THRESHOLD_SWEEP: {
  threshold: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  f1: number;
  flagged: number;
  missed: number;
  note?: string;
}[] = [
  { threshold: 0.2, sensitivity: 0.968, specificity: 0.45, precision: 0.272, f1: 0.424, flagged: 449, missed: 4 },
  {
    threshold: 0.35,
    sensitivity: 0.897,
    specificity: 0.69,
    precision: 0.381,
    f1: 0.534,
    flagged: 297,
    missed: 13,
    note: 'Selected operating point',
  },
  { threshold: 0.5, sensitivity: 0.746, specificity: 0.896, precision: 0.603, f1: 0.667, flagged: 156, missed: 32 },
  { threshold: 0.65, sensitivity: 0.548, specificity: 0.96, precision: 0.742, f1: 0.63, flagged: 93, missed: 57 },
  { threshold: 0.8, sensitivity: 0.333, specificity: 0.98, precision: 0.778, f1: 0.467, flagged: 54, missed: 84 },
];

/* ─────────────────────── prevalence worked example ─────────────────────── */

/**
 * The same sensitivity and specificity, applied at different prevalences.
 * Counts are per 10 000 people screened, rounded to whole people.
 *
 *   TP = 10000 · p · 0.897        FP = 10000 · (1 − p) · 0.310
 */
export const PREVALENCE_EXAMPLE: {
  setting: string;
  prevalence: string;
  truePositives: number;
  falsePositives: number;
  ppv: string;
}[] = [
  {
    setting: 'This test split',
    prevalence: '17.5%',
    truePositives: 1570,
    falsePositives: 2558,
    ppv: '0.38',
  },
  {
    setting: 'Symptomatic clinic attendees',
    prevalence: '5%',
    truePositives: 449,
    falsePositives: 2945,
    ppv: '0.13',
  },
  {
    setting: 'Community-wide screening',
    prevalence: '0.5%',
    truePositives: 45,
    falsePositives: 3085,
    ppv: '0.014',
  },
];

/* ──────────────────────────── training curves ──────────────────────────── */

/**
 * 20 epochs. Training loss falls throughout while validation loss bottoms out
 * at epoch 13 and then climbs: the model is memorising after that point, and
 * epoch 13 is the checkpoint a selection rule would keep.
 */
export const TRAINING_CURVE: {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  valAuc: number;
}[] = [
  { epoch: 1, trainLoss: 0.612, valLoss: 0.588, valAuc: 0.724 },
  { epoch: 2, trainLoss: 0.498, valLoss: 0.512, valAuc: 0.781 },
  { epoch: 3, trainLoss: 0.441, valLoss: 0.47, valAuc: 0.812 },
  { epoch: 4, trainLoss: 0.398, valLoss: 0.441, valAuc: 0.833 },
  { epoch: 5, trainLoss: 0.363, valLoss: 0.419, valAuc: 0.851 },
  { epoch: 6, trainLoss: 0.331, valLoss: 0.402, valAuc: 0.866 },
  { epoch: 7, trainLoss: 0.303, valLoss: 0.39, valAuc: 0.876 },
  { epoch: 8, trainLoss: 0.278, valLoss: 0.381, valAuc: 0.884 },
  { epoch: 9, trainLoss: 0.254, valLoss: 0.374, valAuc: 0.892 },
  { epoch: 10, trainLoss: 0.231, valLoss: 0.369, valAuc: 0.899 },
  { epoch: 11, trainLoss: 0.21, valLoss: 0.366, valAuc: 0.905 },
  { epoch: 12, trainLoss: 0.19, valLoss: 0.364, valAuc: 0.909 },
  { epoch: 13, trainLoss: 0.171, valLoss: 0.364, valAuc: 0.911 },
  { epoch: 14, trainLoss: 0.153, valLoss: 0.372, valAuc: 0.91 },
  { epoch: 15, trainLoss: 0.137, valLoss: 0.381, valAuc: 0.908 },
  { epoch: 16, trainLoss: 0.121, valLoss: 0.393, valAuc: 0.905 },
  { epoch: 17, trainLoss: 0.107, valLoss: 0.408, valAuc: 0.901 },
  { epoch: 18, trainLoss: 0.094, valLoss: 0.425, valAuc: 0.896 },
  { epoch: 19, trainLoss: 0.082, valLoss: 0.444, valAuc: 0.891 },
  { epoch: 20, trainLoss: 0.071, valLoss: 0.466, valAuc: 0.886 },
];

/* ───────────────────────── model configuration ───────────────────────── */

/**
 * The fields a study has to report. "Not yet specified" is used wherever the
 * value is genuinely undecided, rather than filled with a plausible guess.
 */
export const MODEL_CONFIG: FieldRow[] = [
  {
    field: 'Model architecture',
    value: 'DenseNet-121, ImageNet-pretrained, classifier head replaced',
    provenance: 'illustrative',
  },
  { field: 'Input resolution', value: '512 × 512 px, grayscale expanded to 3 channels', provenance: 'illustrative' },
  {
    field: 'Preprocessing',
    value: 'Resize, per-channel normalisation to the pretraining statistics',
    provenance: 'illustrative',
    note: 'No lung-field segmentation and no histogram equalisation in this configuration.',
  },
  {
    field: 'Augmentation',
    value: 'Random resized crop (0.85–1.0), horizontal flip, rotation ±7°',
    provenance: 'illustrative',
    note: 'Training split only. Validation and test see the deterministic resize.',
  },
  { field: 'Optimizer', value: 'AdamW, weight decay 1e-4', provenance: 'illustrative' },
  { field: 'Learning rate', value: '3e-4, cosine annealing', provenance: 'illustrative' },
  { field: 'Batch size', value: '16', provenance: 'illustrative' },
  { field: 'Epochs', value: '20, checkpoint selected at epoch 13', provenance: 'illustrative' },
  {
    field: 'Loss function',
    value: 'Binary cross-entropy with inverse-frequency class weights',
    provenance: 'illustrative',
  },
  {
    field: 'Decision threshold',
    value: 'τ = 0.35, chosen on the validation split',
    provenance: 'illustrative',
    note: 'Deliberately not 0.5. A screening threshold is a clinical choice, not a default.',
  },
  { field: 'Random seed', value: '42', provenance: 'illustrative' },
  { field: 'Calibration method', value: 'Not yet specified', provenance: 'not-computed' },
  { field: 'Hardware and runtime', value: 'Not yet specified', provenance: 'not-computed' },
  { field: 'Inference latency', value: 'Not yet specified', provenance: 'not-computed' },
];

/** Optional comparison panel. Consistent with the curves above for config B. */
export const CONFIG_COMPARISON: {
  id: string;
  backbone: string;
  input: string;
  valAuc: string;
  testAuc: string;
  sensAt90Spec: string;
  selected: boolean;
}[] = [
  {
    id: 'A',
    backbone: 'ResNet-50',
    input: '224²',
    valAuc: '0.874',
    testAuc: '0.861',
    sensAt90Spec: '0.66',
    selected: false,
  },
  {
    id: 'B',
    backbone: 'DenseNet-121',
    input: '512²',
    valAuc: '0.911',
    testAuc: '0.898',
    sensAt90Spec: '0.74',
    selected: true,
  },
  {
    id: 'C',
    backbone: 'EfficientNet-B0',
    input: '384²',
    valAuc: '0.902',
    testAuc: '0.884',
    sensAt90Spec: '0.71',
    selected: false,
  },
];

/* ─────────────────────── things deliberately absent ─────────────────────── */

/**
 * Panels that stay empty on purpose. Each names what is missing and what it
 * would take to fill it, which is more useful than a placeholder chart.
 */
export const MISSING_ANALYSES: { title: string; requirement: string }[] = [
  {
    title: 'Calibration curve',
    requirement:
      'Per-image predicted scores paired with reference labels, binned and plotted against observed positive rate.',
  },
  {
    title: 'Subgroup performance',
    requirement:
      'Age, sex, HIV status and comorbidity labels. No public chest X-ray set used in TB research distributes them.',
  },
  {
    title: 'External validation',
    requirement: 'Images from a source that took no part in development, scored at the frozen threshold.',
  },
  {
    title: 'Reader comparison',
    requirement: 'Independent readings of the same images by qualified radiologists, for an agreement analysis.',
  },
  {
    title: 'Confidence intervals',
    requirement:
      'Bootstrap resampling over the test split. Required for every rate, and especially for the 126 positive cases.',
  },
];
