/**
 * Placeholder outputs for the demo.
 *
 * No model runs in this build, so the demo cannot produce a prediction. What it
 * does instead is pick one of the scenarios below from a hash of the selected
 * file's name, size and modification time. That makes the demo:
 *
 *   - deterministic — the same file always yields the same scenario, so a
 *     presenter can rehearse and a reviewer can reproduce what they saw;
 *   - obviously not a prediction — the output depends on file metadata, which
 *     has nothing to do with the pixels, and the UI says so.
 *
 * The threshold is τ = 0.35, matching the mock evaluation data, so the demo and
 * the research page describe one coherent imaginary system.
 */

export const DEMO_THRESHOLD = 0.35;

export interface DemoScenario {
  id: string;
  /** Above or below DEMO_THRESHOLD. The category is derived, never stored. */
  score: number;
  /** Scenario-specific note shown under the interpretation. */
  note: string;
}

/**
 * Note what a scenario does *not* carry: regions, boxes or a heatmap. Drawing
 * any of those on a visitor's own radiograph would read as a detection result
 * regardless of the caption underneath it, so the demo does not draw them at
 * all. The schematic overlay appears only on the synthetic sample figures.
 */

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'low',
    score: 0.08,
    note: 'A score this far below the threshold would, in a real system, still not exclude TB. Chest radiography misses cases, particularly early disease and TB in people living with HIV.',
  },
  {
    id: 'low-mid',
    score: 0.24,
    note: 'Below the threshold, but not by much. The same image at τ = 0.20 would have been flagged — which is the whole reason the threshold has to be published alongside the output.',
  },
  {
    id: 'borderline',
    score: 0.37,
    note: 'Two hundredths above the threshold. A result this close to the boundary carries almost no information on its own, and an uncalibrated score cannot be read as "37% likely".',
  },
  {
    id: 'mid',
    score: 0.58,
    note: 'Above the threshold. At the mock evaluation’s operating point, roughly 6 in 10 flags like this one would not be TB — and that proportion worsens in a lower-prevalence population.',
  },
  {
    id: 'high',
    score: 0.86,
    note: 'A high score. It still does not establish TB: confirmation is bacteriological, and a high score from an uncalibrated model is a ranking, not a probability.',
  },
];

/** Deterministic, order-independent 32-bit hash of a short string. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Pick the scenario for a file. Same file in, same scenario out. */
export function scenarioForKey(key: string): DemoScenario {
  const scenario = DEMO_SCENARIOS[hashString(key) % DEMO_SCENARIOS.length];
  // The modulo above cannot exceed the array bounds, but the index signature
  // does not know that and the project compiles with strict checks on.
  return scenario ?? DEMO_SCENARIOS[0]!;
}

/* ─────────────────── fixed copy for the result report ─────────────────── */

export const RESULT_DISCLOSURES = {
  panelLabel: 'Simulated model output — not a clinical result',
  modelStatus: 'Simulated inference. No model is connected to this build.',
  scoreLabel: 'Simulated model score',
  scoreCaution:
    'This is a placeholder score on a 0–1 scale, not a probability that anyone has tuberculosis. Converting a model score into a probability of disease requires a calibrated model and a known population prevalence; neither exists here.',
  interpretation:
    'The output above shows how a screening model’s response would be presented. It is a hypothetical response to the file you selected, and it establishes neither the presence nor the absence of tuberculosis.',
  limitations: [
    'A real model misses cases. Early, minimal and HIV-associated TB are all harder to see on a radiograph and under-represented in training data.',
    'A real model raises false alarms. Pneumonia, old scarring, malignancy and other chronic lung disease produce overlapping appearances.',
    'Image quality changes the answer. Exposure, rotation, projection and equipment all shift the input away from what a model was trained on.',
    'A score is not a risk. Without calibration against a known population, it cannot be read as a percentage chance of disease.',
  ],
  nextStep:
    'If tuberculosis is a concern for a real person, the next step is assessment by a qualified health professional. A diagnosis rests on clinical evaluation together with bacteriological testing — a WHO-recommended rapid molecular test, culture or smear microscopy — not on an image alone.',
} as const;

/* ───────────────────────── output glossary copy ───────────────────────── */

export const OUTPUT_GLOSSARY: { term: string; body: string }[] = [
  {
    term: 'Model output',
    body: 'A number the model computes from the pixels, and the category that number falls into once a threshold is applied. It is a property of the model, not of the patient. Move the threshold and the category changes while the image does not.',
  },
  {
    term: 'Model confidence',
    body: 'How a model represents its own certainty — if it represents it at all. A softmax score is not a confidence measure, and a model can be sure and wrong. Reporting confidence honestly requires calibration against held-out data, and often an explicit way to abstain.',
  },
  {
    term: 'Clinical diagnosis',
    body: 'A conclusion reached by a clinician from history, examination, imaging and confirmatory testing, about one person at one point in time. It carries accountability and a treatment decision. No model output is one of these.',
  },
];
