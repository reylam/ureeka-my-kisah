import type { FieldRow, PipelineStage, ResearchQuestion } from '@/trace/types';

/**
 * Editorial content for the research narrative.
 *
 * Kept in one place so the prose can be reviewed as prose, rather than hunted
 * for across a dozen JSX files. Nothing here asserts a result. Where a claim
 * is external it names a source id from `sources.ts`; where a claim is about
 * this prototype it describes what the prototype actually does.
 */

export const PROJECT = {
  name: 'PULMO-TRACE',
  edition: 'Research edition',
  version: '0.1.0-prototype',
  tagline: 'AI-assisted TB screening research platform',
  stage: 'Frontend demonstration',
  updated: 'October 2026',
} as const;

export const PROJECT_METADATA: FieldRow[] = [
  { field: 'Project', value: 'PULMO-TRACE, research edition', provenance: 'illustrative' },
  {
    field: 'Domain',
    value: 'Chest X-ray based screening for pulmonary tuberculosis',
    provenance: 'illustrative',
  },
  {
    field: 'System type',
    value: 'Image classification research prototype',
    provenance: 'illustrative',
  },
  {
    field: 'Current stage',
    value: 'Frontend demonstration — interface, data contract and evaluation framework',
    provenance: 'illustrative',
  },
  {
    field: 'Inference status',
    value: 'Simulated. No model is connected to this build.',
    provenance: 'illustrative',
    note: 'The demo returns a deterministic placeholder derived from the file you select.',
  },
  {
    field: 'Training data',
    value: 'None. No model has been trained for this build.',
    provenance: 'illustrative',
  },
  {
    field: 'Clinical validation',
    value: 'Not established',
    provenance: 'not-computed',
  },
  {
    field: 'Regulatory status',
    value: 'None. Not a medical device.',
    provenance: 'illustrative',
  },
  {
    field: 'Intended use',
    value: 'Research, teaching and interface review only',
    provenance: 'illustrative',
  },
];

/* ─────────────────────────── clinical context ─────────────────────────── */

export const CONTEXT_POINTS: {
  heading: string;
  body: string;
  sourceId?: string;
}[] = [
  {
    heading: 'The disease is common and the gap is in finding it',
    body: 'WHO estimates 10.7 million people fell ill with TB in 2024, and 1.23 million died. About 8.3 million were diagnosed and notified — roughly 78% of the estimated total, leaving a gap of around 2.4 million people who were never reached by a diagnosis.',
    sourceId: 'whoGtb2025',
  },
  {
    heading: 'Chest radiography is a screening tool, not a verdict',
    body: 'WHO includes chest radiography among the tools for systematic TB screening and triage, and since 2021 has allowed computer-aided detection software to read digital chest X-rays in place of a human reader for people aged 15 and over, in populations where screening is recommended. Screening identifies who should be tested further. It does not conclude the matter.',
    sourceId: 'whoScreening2021',
  },
  {
    heading: 'Radiographic appearance varies between people',
    body: 'Pulmonary TB does not present one way. Upper-zone infiltrates, cavitation, nodular shadowing, pleural effusion and miliary patterns all occur, and some people with bacteriologically confirmed TB have a chest X-ray read as normal — particularly people living with HIV.',
    sourceId: 'whoCxr2016',
  },
  {
    heading: 'The findings are not specific to TB',
    body: 'The same shadows can be produced by pneumonia, lung cancer, fungal infection, old healed scarring or other chronic lung disease. A radiograph narrows the differential. It cannot distinguish TB from everything that resembles it.',
    sourceId: 'whoCxr2016',
  },
  {
    heading: 'Confirmation is bacteriological',
    body: 'A TB diagnosis rests on tests for the organism — WHO-recommended rapid molecular tests, culture, or smear microscopy — interpreted alongside the clinical picture. An image-based model sits upstream of all of that, and its output is a reason to test, never a substitute for testing.',
    sourceId: 'whoScreening2021',
  },
];

/* ────────────────────────── research questions ────────────────────────── */

export const RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    id: 'RQ1',
    shortLabel: 'Detection',
    title: 'Can a model separate the labelled classes at all?',
    question:
      'Within a single selected dataset, can an image classifier distinguish radiographs labelled TB-related from those labelled non-TB, at a level that would be useful for triage rather than merely better than chance?',
    hypothesis:
      'A convolutional backbone pretrained on natural images and fine-tuned on frontal chest radiographs reaches a sensitivity and specificity worth measuring on a held-out split of the same dataset.',
    criteria: [
      'Sensitivity and specificity reported together at a stated decision threshold, never accuracy alone.',
      'Patient-level train / validation / test splits, so no person appears on both sides.',
      'A test split that was never used for model selection or threshold tuning.',
      'Confidence intervals on every reported rate, given how few TB-positive cases most datasets contain.',
    ],
    state:
      'Open. No model has been trained or evaluated for this build, so there is no result to report either way.',
  },
  {
    id: 'RQ2',
    shortLabel: 'Generalization',
    title: 'Does any of it survive a change of hospital?',
    question:
      'How does performance change when the model is applied to images from a different source — different equipment, exposure habits, patient population and disease prevalence — than the one it was trained on?',
    hypothesis:
      'Performance drops on an external source, and the drop is larger than the usual split-to-split variation. Whether the drop is small enough to tolerate is the actual question.',
    criteria: [
      'At least one external dataset evaluated with the threshold fixed in advance.',
      'The in-domain and external results reported side by side, not separately.',
      'Calibration assessed on the external set, not just discrimination.',
      'Positive predictive value recomputed at the prevalence of the deployment setting.',
    ],
    state:
      'Open, and untouched. External validation is the part most easily skipped and the part that decides whether a model means anything outside its own dataset.',
  },
  {
    id: 'RQ3',
    shortLabel: 'Interpretability',
    title: 'Can we see what the model responded to?',
    question:
      'Can gradient-based saliency methods help a researcher inspect which image regions drove a prediction, and can that inspection catch a model that is right for the wrong reason?',
    hypothesis:
      'Saliency maps are useful for finding gross failures — a model keying on a laterality marker, a text burn-in or the image border — but they do not establish that the model uses clinically meaningful features.',
    criteria: [
      'Saliency computed from the deployed weights, not drawn by hand.',
      'Maps reviewed against lesion annotations where those exist.',
      'Sanity checks applied, for example randomised-weight comparisons.',
      'Agreement, or disagreement, with a radiologist’s reading recorded for a sample of cases.',
    ],
    state:
      'Open. The comparison layout exists on this site as a schematic placeholder; no saliency map has been computed.',
  },
];

/* ───────────────────────────── home pipeline ───────────────────────────── */

export const SCREENING_PIPELINE: PipelineStage[] = [
  {
    id: 'input',
    label: 'Chest X-ray input',
    description:
      'A single frontal radiograph as JPG or PNG, selected in the browser. Nothing is uploaded.',
    status: 'in-prototype',
  },
  {
    id: 'quality',
    label: 'Image quality check',
    description:
      'The prototype checks file type, size and pixel dimensions. Projection, rotation and exposure checks are not implemented.',
    status: 'in-prototype',
  },
  {
    id: 'preprocess',
    label: 'Preprocessing',
    description:
      'Planned: resize to the model input size, normalise intensity, optionally crop to the lung fields.',
    status: 'planned',
  },
  {
    id: 'inference',
    label: 'Model inference',
    description:
      'Planned: a classifier returns a score per class. This build substitutes a deterministic placeholder.',
    status: 'planned',
  },
  {
    id: 'output',
    label: 'Screening output',
    description:
      'A category and a score, with the operating threshold stated. Rendered here from the placeholder.',
    status: 'in-prototype',
  },
  {
    id: 'interpretation',
    label: 'Research interpretation',
    description:
      'The output read against the evaluation evidence, the limitations, and what the next clinical step would be.',
    status: 'in-prototype',
  },
];

/* ───────────────────────────── methodology ───────────────────────────── */

export const METHOD_STAGES: {
  id: string;
  label: string;
  description: string;
  outputs: string;
}[] = [
  {
    id: 'acquisition',
    label: 'Dataset acquisition',
    description:
      'Obtain a dataset with a documented reference standard and licence terms that permit research use. Record the version and the download date.',
    outputs: 'Dataset snapshot, licence record, citation',
  },
  {
    id: 'verification',
    label: 'Data verification',
    description:
      'Check for duplicates, corrupt files, lateral or paediatric images that do not belong, burned-in text and laterality markers that a model could exploit.',
    outputs: 'Exclusion log with a count and a reason per excluded image',
  },
  {
    id: 'splitting',
    label: 'Patient-level splitting',
    description:
      'Split by person, never by image. Two radiographs of the same patient on opposite sides of a split inflate every number downstream and are the single most common error in this literature.',
    outputs: 'Train / validation / test manifests, with class counts per split',
  },
  {
    id: 'preprocessing',
    label: 'Image preprocessing',
    description:
      'Fix a resize, an intensity normalisation and an augmentation policy, then apply them identically everywhere. Augmentation touches the training split only.',
    outputs: 'A versioned preprocessing specification',
  },
  {
    id: 'training',
    label: 'Model training',
    description:
      'Train from a pretrained backbone with a class-imbalance strategy, a fixed seed and a logged configuration. Record the full hyperparameter set, not a summary of it.',
    outputs: 'Checkpoint, training log, configuration file',
  },
  {
    id: 'validation',
    label: 'Validation',
    description:
      'Use the validation split for model selection and for choosing the operating threshold. Both decisions consume this split, which is why it cannot also serve as the test set.',
    outputs: 'Selected checkpoint, chosen threshold and the sweep behind it',
  },
  {
    id: 'testing',
    label: 'Independent testing',
    description:
      'Score the frozen model, at the frozen threshold, exactly once on data untouched until that moment. Preferably from a different source than the training data.',
    outputs: 'Test metrics with confidence intervals',
  },
  {
    id: 'analysis',
    label: 'Performance analysis',
    description:
      'Report discrimination, calibration, the confusion matrix, subgroup behaviour where labels permit, and a review of the cases the model got wrong.',
    outputs: 'Evaluation report and error analysis',
  },
];

/* ──────────────────────────── metric glossary ──────────────────────────── */

export const METRIC_DEFINITIONS: {
  name: string;
  formula: string;
  plain: string;
  caution: string;
}[] = [
  {
    name: 'Sensitivity (recall)',
    formula: 'TP / (TP + FN)',
    plain:
      'Of the people the reference standard calls TB-positive, the share the model flags. A screening tool is judged here first: a missed case leaves someone untreated and infectious.',
    caution:
      'Rises as the threshold is lowered, at the cost of specificity. Quoting it without the threshold is meaningless.',
  },
  {
    name: 'Specificity',
    formula: 'TN / (TN + FP)',
    plain:
      'Of the people the reference standard calls TB-negative, the share the model leaves unflagged. It governs how much unnecessary confirmatory testing the tool creates.',
    caution:
      'In a low-prevalence population even 95% specificity can produce more false positives than true positives.',
  },
  {
    name: 'Precision (PPV)',
    formula: 'TP / (TP + FP)',
    plain:
      'Of the people the model flags, the share the reference standard confirms. This is the number a clinician implicitly asks about: if it flags, how often is it right?',
    caution:
      'Depends on prevalence. The same model has a very different PPV in a TB clinic and in a general screening queue.',
  },
  {
    name: 'F1-score',
    formula: '2 · (precision · recall) / (precision + recall)',
    plain:
      'The harmonic mean of precision and recall, as a single summary number for ranking configurations.',
    caution:
      'Hides the trade-off it averages, and ignores true negatives entirely. Useful for model selection, not for clinical reasoning.',
  },
  {
    name: 'ROC-AUC',
    formula: '∫ TPR d(FPR)',
    plain:
      'How well the score separates the two labelled classes across every threshold at once. 0.5 is chance; 1.0 is perfect separation on that data.',
    caution:
      'Threshold-free, so it says nothing about behaviour at the threshold you would actually deploy, and nothing about calibration.',
  },
  {
    name: 'Confusion matrix',
    formula: '[[TN, FP], [FN, TP]]',
    plain:
      'The four raw counts at one threshold. Every rate above is a ratio of these numbers, which is why the counts should be published alongside the rates.',
    caution:
      'Only interpretable with the class support stated. Four cells computed over 40 cases are not evidence.',
  },
  {
    name: 'Calibration',
    formula: 'P(y = 1 | score = s) ≈ s',
    plain:
      'Whether a score of 0.8 corresponds to an 80% observed positive rate. Required before any score is described as a probability.',
    caution:
      'A model can discriminate well and be badly calibrated. Uncalibrated scores must not be presented as risk.',
  },
];

/* ───────────────────────────── error analysis ───────────────────────────── */

export const FAILURE_MODES: {
  title: string;
  cost: string;
  body: string;
}[] = [
  {
    title: 'False negatives',
    cost: 'A person with TB is told nothing was found',
    body: 'Early or minimal disease, miliary patterns, and TB in people living with HIV are all under-represented in public datasets and all harder to see. A model that never sees them in training will not flag them in deployment.',
  },
  {
    title: 'False positives',
    cost: 'Confirmatory testing, travel and anxiety for someone without TB',
    body: 'Pneumonia, healed scarring, malignancy and chronic lung disease produce overlapping appearances. At realistic screening prevalence, false positives will outnumber true positives for most plausible operating points.',
  },
  {
    title: 'Image quality',
    cost: 'Unreliable output presented with the same confidence as a reliable one',
    body: 'Underexposure, rotation, poor inspiration, portable films and photographs of printed films all shift the input distribution. Without a quality gate, the model scores them anyway.',
  },
  {
    title: 'Acquisition shift',
    cost: 'Performance that silently decays after deployment',
    body: 'Detector hardware, post-processing pipelines and local protocols differ between facilities. A model can learn a site signature instead of a disease signature and look excellent until it moves.',
  },
  {
    title: 'Dataset leakage',
    cost: 'Metrics that are confidently wrong',
    body: 'Duplicate images, or two radiographs of one patient split across train and test, produce high scores that do not transfer. Without patient identifiers this cannot be ruled out, only reported as a risk.',
  },
  {
    title: 'Class imbalance',
    cost: 'A majority-class model that still reports high accuracy',
    body: 'Public TB sets are heavily skewed toward non-TB images. Accuracy is the wrong summary; per-class recall and the raw counts are the right ones.',
  },
  {
    title: 'Population shift',
    cost: 'A threshold that is wrong for the people it is used on',
    body: 'Age structure, HIV prevalence, prior TB history and whether screening is symptom-triggered or community-wide all change the right operating point. A threshold tuned on one cohort does not carry over.',
  },
];

/* ────────────────────────── generalization topics ────────────────────────── */

export const GENERALIZATION_TOPICS: {
  title: string;
  body: string;
  sourceId?: string;
}[] = [
  {
    title: 'External validation',
    body: 'An evaluation on data from a source that played no part in development. Until that exists, reported performance describes one dataset, not a capability.',
    sourceId: 'pitfalls',
  },
  {
    title: 'Dataset shift',
    body: 'Changes in equipment, exposure habits, patient mix or disease prevalence between development and deployment. All of them move the operating point, and prevalence moves positive predictive value most.',
  },
  {
    title: 'Demographic representation',
    body: 'Performance should be reported per subgroup — age, sex, HIV status, comorbidity — wherever labels permit. Most public chest X-ray sets ship no demographic fields at all, which makes the analysis impossible rather than unnecessary.',
  },
  {
    title: 'Calibration',
    body: 'Discrimination and calibration are separate properties. A score may rank cases well and still be a poor estimate of risk, and only a calibrated score can be described as a probability.',
    sourceId: 'whoCadToolkit',
  },
  {
    title: 'Threshold recalibration',
    body: 'WHO guidance on computer-aided detection treats the operating threshold as something to set locally against the population being screened, not a constant shipped with the software.',
    sourceId: 'whoCadToolkit',
  },
  {
    title: 'Prospective evaluation',
    body: 'Retrospective accuracy on archived images and prospective usefulness in a live screening programme are different claims. The second requires measuring what happened to the people screened.',
  },
  {
    title: 'Workflow integration',
    body: 'Who reads the output, how a flag is resolved, what happens when confirmatory testing is unavailable, and who is accountable for a missed case. A model that improves a metric can still make a service worse.',
  },
  {
    title: 'Privacy and data governance',
    body: 'Chest radiographs are health data. Consent, retention, de-identification, cross-border transfer and the right to withdraw all need answers before any image leaves a device. This prototype avoids the question by never transmitting one.',
  },
];

/* ──────────────────────────── home limitations ──────────────────────────── */

export const LIMITATION_SUMMARY: { title: string; body: string }[] = [
  {
    title: 'No model, no results',
    body: 'This build contains no trained model and no experimental measurements. Every figure on the research page is mock data placed to show how results would be reported.',
  },
  {
    title: 'Dataset bias',
    body: 'Public TB radiograph collections come from a handful of sites and skew toward the populations those sites serve. A model trained on them inherits that skew.',
  },
  {
    title: 'Class imbalance',
    body: 'TB-positive images are a small minority of every public set. Accuracy flatters a model in that regime; per-class recall and raw counts do not.',
  },
  {
    title: 'Image quality and domain shift',
    body: 'Exposure, positioning, equipment and post-processing all vary. Performance measured on clean archival images is an upper bound, not an expectation.',
  },
  {
    title: 'The errors are not symmetric',
    body: 'A missed case and an unnecessary referral have different costs, and the right balance depends on what confirmatory testing is actually reachable.',
  },
  {
    title: 'Retrospective ≠ deployable',
    body: 'Good numbers on archived images say nothing yet about whether a screening programme using the tool finds more TB.',
  },
];

/* ────────────────────────────── conclusion ────────────────────────────── */

export const CONCLUSION_POINTS: { label: string; body: string }[] = [
  {
    label: 'What this prototype demonstrates',
    body: 'A complete interface and reporting structure for a chest X-ray screening model: the input contract, the output format, the evaluation framework, and the disclosures that have to travel with a result.',
  },
  {
    label: 'What it does not demonstrate',
    body: 'That a model can screen for TB from a chest radiograph. No model is connected, nothing has been trained, and no measurement has been taken.',
  },
  {
    label: 'On RQ1 — detection',
    body: 'Unanswered. Answering it needs a patient-level split, a frozen test set and sensitivity and specificity reported together with intervals.',
  },
  {
    label: 'On RQ2 — generalization',
    body: 'Unanswered, and the hardest of the three. It needs images from a source that took no part in development.',
  },
  {
    label: 'On RQ3 — interpretability',
    body: 'Unanswered. The comparison layout is in place; the saliency maps that belong in it have to come from real model weights.',
  },
  {
    label: 'What would change the conclusion',
    body: 'A trained model, a patient-level split, one external dataset and a calibration curve. In that order. Until then there is an interface and a framework, which is a useful thing to have reviewed, and not a finding.',
  },
];
