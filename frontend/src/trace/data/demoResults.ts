/**
 * Stand-in results for the demo.
 *
 * No model runs in this build, so the demo cannot produce a real answer. What
 * it does instead is pick one of the outcomes below from a hash of the chosen
 * file's name, size and modification time. That makes the demo:
 *
 *   - repeatable: the same file always gives the same outcome, so a demo can
 *     be rehearsed and anyone can reproduce what they saw;
 *   - plainly not a prediction: the outcome depends on file details, which
 *     have nothing to do with the picture, and the result panel says so.
 *
 * The cut-off is 0.35 rather than 0.5, because a screening tool is normally
 * tuned to catch more cases at the cost of more false alarms.
 */

export const DEMO_THRESHOLD = 0.35;

export interface DemoScenario {
  id: string;
  /** Above or below DEMO_THRESHOLD. The category is worked out, never stored. */
  score: number;
  /** The line shown under the explanation for this particular outcome. */
  note: string;
}

/**
 * Note what a scenario does not carry: no boxes, no circles, no heatmap.
 * Drawing any of those on a visitor's own X-ray would read as a real finding
 * no matter what the caption underneath said, so the demo does not draw them.
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'low',
    score: 0.08,
    note: 'A low score would still not mean someone is in the clear. Chest X-rays miss cases, especially early tuberculosis and TB in people living with HIV.',
  },
  {
    id: 'low-mid',
    score: 0.24,
    note: 'Below the cut-off, but not by much. Set the cut-off a little lower and this same picture would have been flagged, which is why the cut-off has to be shown alongside the answer.',
  },
  {
    id: 'borderline',
    score: 0.37,
    note: 'Only just above the cut-off. A result this close to the line carries almost no information on its own, and a score of 0.37 does not mean "37% likely".',
  },
  {
    id: 'mid',
    score: 0.58,
    note: 'Above the cut-off. In a general population, where tuberculosis is uncommon, most pictures flagged like this one would turn out not to be TB at all.',
  },
  {
    id: 'high',
    score: 0.86,
    note: 'A high score. It still would not mean someone has tuberculosis. That is settled by a laboratory test, not by a picture.',
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

/** Pick the outcome for a file. Same file in, same outcome out. */
export function scenarioForKey(key: string): DemoScenario {
  const scenario = DEMO_SCENARIOS[hashString(key) % DEMO_SCENARIOS.length];
  // The modulo cannot exceed the array bounds, but the index signature does
  // not know that and the project compiles with strict checks on.
  return scenario ?? DEMO_SCENARIOS[0]!;
}

/* ─────────────────── fixed copy for the result panel ─────────────────── */

export const RESULT_DISCLOSURES = {
  panelLabel: 'Example result · not a medical finding',
  modelStatus: 'No trained model is connected to this build.',
  scoreLabel: 'Example score',
  scoreCaution:
    'This is a stand-in number on a scale from 0 to 1. It is not the chance that anyone has tuberculosis. Turning a score into a real chance of illness needs a tested model and knowledge of how common TB is in that population, and neither exists here.',
  interpretation:
    'What you are looking at is how a screening result would be presented. It is a stand-in response to the file you chose, and it says nothing about whether tuberculosis is present or absent.',
  limitations: [
    'A real tool would miss people. Early tuberculosis, and TB in people living with HIV, can be very hard to see on an X-ray.',
    'A real tool would raise false alarms. Pneumonia, old scarring and other lung conditions can look similar.',
    'Picture quality changes the answer. Exposure, position and the machine used all shift what the software sees.',
    'A score is not a risk. Without proper testing, it cannot be read as a percentage chance of being ill.',
  ],
  nextStep:
    'If tuberculosis is a real concern for a real person, the next step is a health professional. A diagnosis comes from a clinical assessment together with a laboratory test on a sputum sample, never from a picture on its own.',
} as const;

/* ───────────────────────── output glossary copy ───────────────────────── */

export const OUTPUT_GLOSSARY: { term: string; body: string }[] = [
  {
    term: 'What the software computed',
    body: 'A number worked out from the pixels, and the category that number falls into once a cut-off is applied. It describes the software, not the person. Move the cut-off and the category changes while the picture does not.',
  },
  {
    term: 'How sure it claims to be',
    body: 'A high number is not the same as being right. Software can be confident and wrong, and a number only becomes a trustworthy measure of certainty after it has been checked against cases where the real answer was already known.',
  },
  {
    term: 'What is actually wrong',
    body: 'A conclusion about one person at one moment, reached by a clinician from symptoms, history, imaging and a laboratory test. It carries a treatment decision and someone accountable for it. No piece of software produces one of these.',
  },
];
