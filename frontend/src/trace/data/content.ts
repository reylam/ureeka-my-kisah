/**
 * Site copy.
 *
 * Written for a general reader, not for a reviewer. The deep version of all of
 * this, with the research questions, the dataset record, the evaluation
 * framework and the reference list, lives in `docs/research-notes.txt` and is
 * deliberately not on the site.
 *
 * Two rules still apply to everything here. Facts about tuberculosis carry a
 * source. Facts about this prototype say plainly that no model is connected.
 */

export const PROJECT = {
  name: 'PULMO-TRACE',
  tagline: 'See Beyond the Scan',
  version: '0.1.0',
  updated: 'October 2026',
} as const;

/* ───────────────────────────── why it matters ───────────────────────────── */

export const BURDEN_FACTS: {
  figure: string;
  unit: string;
  body: string;
  sourceId: string;
}[] = [
  {
    figure: '10.7',
    unit: 'million people',
    body: 'fell ill with tuberculosis in 2024. It is one of the world’s deadliest infectious diseases, and it is curable.',
    sourceId: 'whoGtb2025',
  },
  {
    figure: '2.4',
    unit: 'million missed',
    body: 'of them were never diagnosed. Roughly one in five people with TB is never found by a health service at all.',
    sourceId: 'whoGtb2025',
  },
  {
    figure: '1 of the first',
    unit: 'places TB shows',
    body: 'is a chest X-ray. It is cheap, quick and widely available, which is why it is used to decide who needs a lab test.',
    sourceId: 'whoScreening2021',
  },
];

export const WHY_POINTS: { title: string; body: string; sourceId?: string }[] = [
  {
    title: 'Finding people is the hard part',
    body: 'Tuberculosis can be treated. The people who die from it are mostly the people nobody managed to diagnose in time. So the bottleneck is not medicine, it is finding who needs to be tested.',
    sourceId: 'whoGtb2025',
  },
  {
    title: 'An X-ray is a good first filter',
    body: 'Chest X-rays are quick, inexpensive and available in places a laboratory is not. The World Health Organization includes them among the tools for TB screening, and since 2021 has allowed software to read them in place of a human reader for adults, in places where screening is already recommended.',
    sourceId: 'whoScreening2021',
  },
  {
    title: 'But a shadow on a lung is not a diagnosis',
    body: 'Pneumonia, old scarring, cancer and several other conditions can look similar on an X-ray. And some people who definitely have TB have an X-ray that looks completely normal. An image narrows things down. It does not settle them.',
    sourceId: 'whoCxr2016',
  },
];

/* ──────────────────────────── how it works ──────────────────────────── */

export const STEPS: {
  id: string;
  label: string;
  body: string;
  note: string;
}[] = [
  {
    id: 'image',
    label: 'Start with a chest X-ray',
    body: 'One ordinary front-facing chest X-ray, the kind taken at a clinic in a couple of minutes.',
    note: 'In this prototype you choose a file from your own device.',
  },
  {
    id: 'check',
    label: 'Check the picture is usable',
    body: 'A blurry, cropped or badly exposed image gives an unreliable answer, so the picture is checked before anything else happens.',
    note: 'The prototype checks the file type, the size and the dimensions.',
  },
  {
    id: 'look',
    label: 'Look for familiar patterns',
    body: 'Software trained on many labelled X-rays compares what it sees against the patterns it learned, and produces a score for how closely they match.',
    note: 'Not built yet. No model is connected to this prototype.',
  },
  {
    id: 'result',
    label: 'Turn the score into a next step',
    body: 'Above a set cut-off the image is flagged for follow-up. Below it, no flag. The result is a recommendation about testing, never a conclusion about the person.',
    note: 'The prototype shows this step with a clearly labelled placeholder.',
  },
];

/* ───────────────────────── can and cannot ───────────────────────── */

export const CAN_DO: string[] = [
  'Point to an X-ray that deserves a closer look',
  'Work through a lot of images quickly, in order',
  'Help in places where no radiologist is available that day',
  'Give the same answer every time for the same image',
];

export const CANNOT_DO: string[] = [
  'Confirm that someone has tuberculosis',
  'Prove that someone does not have it',
  'Replace a lab test, which is what actually confirms TB',
  'Replace the judgement of a doctor who has met the patient',
];

/* ──────────────────────────── honest limits ──────────────────────────── */

export const LIMITS: { title: string; body: string }[] = [
  {
    title: 'It will miss people',
    body: 'Early tuberculosis, and TB in people living with HIV, can be very hard to see on an X-ray. A tool like this will let some real cases through, which is why a negative result is never an all-clear.',
  },
  {
    title: 'It will raise false alarms',
    body: 'Several other lung conditions look similar. In a general population, where TB is rare, most of the images a tool like this flags will turn out not to be TB. That is a real cost in travel, time and worry for those people.',
  },
  {
    title: 'The picture quality changes the answer',
    body: 'Different machines, different exposure, a patient standing slightly turned. All of it shifts what the software sees, and none of it is visible in the score it reports.',
  },
  {
    title: 'It has not been tested in a real clinic',
    body: 'This is a prototype of the interface. No model has been trained for it and nothing has been measured, so nobody should treat anything here as evidence that the approach works.',
  },
];

/* ──────────────────────────── plain FAQ ──────────────────────────── */

export const FAQ: { question: string; answer: string; sourceId?: string }[] = [
  {
    question: 'Can I use this to find out if I have tuberculosis?',
    answer:
      'No. This is a prototype of an interface, and no model is connected to it. Even a finished and properly tested version would only ever suggest that someone should be tested. If you are worried about TB, see a health professional. A persistent cough lasting more than two weeks, fever, night sweats and losing weight without trying are all reasons to get checked.',
  },
  {
    question: 'What does the score in the demo actually mean?',
    answer:
      'In this prototype, nothing. It is a fixed placeholder chosen from the file’s name and size, so the same file always gives the same answer and the picture itself plays no part. In a real system the score would be a measure of how closely the image matches the patterns the software learned, on a scale from 0 to 1. It would still not be the chance that the person has TB.',
  },
  {
    question: 'Why is a score not the same as a percentage chance?',
    answer:
      'Because the two answer different questions. A score says how confidently the software can tell one group of images from another. The chance that a particular person has TB also depends on how common TB is where they live, their symptoms and their history. The same score means something quite different in a TB clinic and in a routine workplace check-up.',
  },
  {
    question: 'Is my X-ray uploaded anywhere?',
    answer:
      'No. The file you choose is read by your own browser to draw the preview, and it is never sent to a server. Nothing is stored and nothing leaves your device. Even so, please do not use an image that carries someone’s name or patient number.',
  },
  {
    question: 'So how is tuberculosis actually confirmed?',
    answer:
      'By testing for the bacteria, usually with a rapid molecular test on a sputum sample, sometimes by growing a culture or by examining a sample under a microscope. A doctor reads that result together with symptoms and history. An X-ray, read by a person or by software, comes earlier in the chain and only helps decide who should be tested.',
    sourceId: 'whoScreening2021',
  },
  {
    question: 'Why build the interface before the model?',
    answer:
      'Because how a result is shown changes how it gets used. A screening tool that reports a bare number invites people to read it as a verdict. Getting the wording, the warnings and the next step right is work in its own right, and it is easier to do honestly while there is no impressive accuracy figure to show off.',
  },
];

/* ─────────────────────────── what exists today ─────────────────────────── */

export const BUILD_STATUS: { label: string; value: string; done: boolean }[] = [
  { label: 'Screening interface', value: 'Built and working', done: true },
  { label: 'Image checks and preview', value: 'Built and working', done: true },
  { label: 'Result format and warnings', value: 'Built and working', done: true },
  { label: 'Trained model', value: 'Not built', done: false },
  { label: 'Tested on real patients', value: 'Not done', done: false },
  { label: 'Approved for clinical use', value: 'No, and not applied for', done: false },
];
