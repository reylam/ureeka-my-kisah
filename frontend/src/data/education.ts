/**
 * TB learning content.
 *
 * Written for patients, not clinicians: short, plain, and careful never to
 * give individual medical advice. Every article ends by pointing at a health
 * professional rather than at a next article, because the one thing this
 * section must not do is become a substitute for seeing someone.
 *
 * The facts here follow WHO guidance on TB screening and chest radiography.
 * Nothing in this file is tailored to a specific person, and nothing adjusts
 * or comments on prescribed treatment.
 */

export type EducationTopic =
  | 'basics'
  | 'symptoms'
  | 'prevention'
  | 'diagnosis'
  | 'treatment'
  | 'myths'
  | 'support';

export interface EducationArticle {
  id: string;
  topic: EducationTopic;
  title: string;
  /** One line shown in the card. */
  summary: string;
  minutes: number;
  /** Short paragraphs. Rendered as a list, not as HTML. */
  body: string[];
  /** Optional key-point list shown in a callout. */
  keyPoints?: string[];
}

export const TOPIC_LABEL: Record<EducationTopic, string> = {
  basics: 'TB basics',
  symptoms: 'Symptoms',
  prevention: 'Prevention',
  diagnosis: 'Tests and diagnosis',
  treatment: 'Treatment',
  myths: 'Myths and facts',
  support: 'Family and stigma',
};

export const ARTICLES: EducationArticle[] = [
  {
    id: 'what-is-tb',
    topic: 'basics',
    title: 'What tuberculosis actually is',
    summary: 'A bacterial infection, usually in the lungs, and one that can be cured.',
    minutes: 3,
    body: [
      'Tuberculosis is caused by a bacterium called Mycobacterium tuberculosis. It most often settles in the lungs, which is why a chest X-ray is useful, but it can affect other parts of the body too.',
      'It spreads through the air. When someone with TB in their lungs coughs, speaks or sings, tiny droplets carrying the bacteria can be breathed in by people nearby. It does not spread by sharing food, shaking hands or using the same toilet.',
      'Being infected is not the same as being ill. Many people carry the bacteria for years without symptoms and without being contagious. That is called latent TB. It becomes active TB disease in a minority of people, and more often in those whose immune system is weakened.',
      'The important part: active TB is curable. Treatment takes months and has to be finished, but it works.',
    ],
    keyPoints: [
      'Spreads through the air, not through objects or food',
      'Carrying the bacteria is not the same as being ill',
      'Active TB is curable with a full course of treatment',
    ],
  },
  {
    id: 'symptoms',
    topic: 'symptoms',
    title: 'Signs worth getting checked',
    summary: 'A cough lasting more than two weeks is the one that matters most.',
    minutes: 3,
    body: [
      'The symptom that should prompt a visit is a cough that has not gone away after two weeks. On its own it is not proof of anything, as plenty of other things cause a long cough, but it is the usual reason to get tested.',
      'Other things to mention if you have them: coughing up blood, fever, sweating heavily at night, losing weight without trying, chest pain, and unusual tiredness.',
      'Some people with TB have very mild symptoms, or none at all, and a chest X-ray that looks normal. This is more common in people living with HIV. That is why nobody should treat a reassuring screening result as the end of the matter if they feel unwell.',
    ],
    keyPoints: [
      'Cough longer than two weeks: get checked',
      'Mention weight loss, night sweats and fever even if they seem unrelated',
      'Feeling unwell matters more than a normal-looking X-ray',
    ],
  },
  {
    id: 'prevention',
    topic: 'prevention',
    title: 'Reducing the chance of passing it on',
    summary: 'Air, light and covering a cough do most of the work.',
    minutes: 2,
    body: [
      'TB spreads in enclosed, poorly ventilated spaces. Opening windows and letting daylight into a room genuinely reduces the risk, because the bacteria do not survive long in moving air and sunlight.',
      'Covering your mouth and nose when you cough, and turning away from people, cuts the number of droplets released. A mask helps, particularly in the first weeks of treatment.',
      'If someone in your household is diagnosed, the people they live with should be checked as well, even if they feel fine. This is called contact investigation and it is routine.',
      'The BCG vaccine is given to infants in many countries. It reduces severe forms of TB in young children, but it does not reliably prevent lung TB in adults.',
    ],
  },
  {
    id: 'diagnosis',
    topic: 'diagnosis',
    title: 'How TB is confirmed',
    summary: 'A lab test on a sputum sample, not an image.',
    minutes: 3,
    body: [
      'A chest X-ray can show changes in the lungs that suggest TB, and software can help flag images worth a closer look. Neither confirms it. Pneumonia, old scarring and other conditions can look very similar.',
      'Confirmation comes from testing for the bacteria themselves. The usual first test is a rapid molecular test on a sputum sample, which can give an answer within hours and also shows whether the strain resists common medicines. Culture, where the bacteria are grown in a lab, is slower but more thorough. Smear microscopy looks at a sample directly under a microscope.',
      'Producing a sputum sample means coughing something up from deep in the chest, not saliva. Staff will explain how, usually first thing in the morning.',
      'Your clinician reads the test result together with your symptoms and history. That combination is the diagnosis.',
    ],
    keyPoints: [
      'An X-ray raises the question; a lab test answers it',
      'Rapid molecular tests can return a result the same day',
      'Bring symptoms and history to the appointment, not just the image',
    ],
  },
  {
    id: 'treatment',
    topic: 'treatment',
    title: 'Treatment, and why finishing it matters',
    summary: 'Several medicines, several months, and stopping early is the real risk.',
    minutes: 4,
    body: [
      'Standard treatment for drug-sensitive TB is a combination of medicines taken daily for about six months. Taking several at once is deliberate: it stops the bacteria adapting to any single one.',
      'Most people start feeling better within a few weeks. That is the point at which stopping becomes tempting, and it is the most dangerous thing you can do. The bacteria that survive a partial course are the ones that learned to resist the medicine, and drug-resistant TB is far harder and longer to treat.',
      'Side effects are common and usually manageable. Nausea, tiredness and orange-coloured urine are expected. Tell your clinician about anything else, particularly yellowing of the eyes or skin, rashes, or changes in your vision, rather than stopping on your own.',
      'Many programmes offer support to help people finish: reminders, treatment supporters, and in some places help with transport. Ask what is available where you are.',
    ],
    keyPoints: [
      'Roughly six months for drug-sensitive TB',
      'Feeling better is not the same as being cured',
      'Report side effects rather than stopping treatment yourself',
    ],
  },
  {
    id: 'myths',
    topic: 'myths',
    title: 'Six things people believe about TB that are not true',
    summary: 'It is not hereditary, not a punishment, and not untreatable.',
    minutes: 3,
    body: [
      '"TB runs in families." It does not. It spreads through shared air, which is why households are often affected together, and that looks like inheritance from the outside.',
      '"Only poor people get TB." Crowded housing and poor nutrition raise the risk, but anyone who breathes the same air can be infected.',
      '"TB is a death sentence." Drug-sensitive TB is curable in the great majority of people who complete treatment.',
      '"You can tell by looking at someone." You cannot. Many people with early TB look and feel well.',
      '"Once you feel better you are cured." The course has to be finished. See the treatment article.',
      '"Someone with TB should be kept away from everyone." After a few weeks of effective treatment most people are no longer infectious and can return to normal life. Isolation beyond medical advice causes harm.',
    ],
  },
  {
    id: 'support',
    topic: 'support',
    title: 'Supporting someone with TB',
    summary: 'Practical help, and not treating it as something shameful.',
    minutes: 3,
    body: [
      'The hardest part of TB for many people is not the illness, it is being treated as contagious and suspect for months afterwards. Stigma keeps people from getting tested, which is how the disease keeps spreading.',
      'Practical help matters more than reassurance: a lift to the clinic, a reminder when the daily dose is due, someone to sit with during the first difficult weeks.',
      'If you live with someone who has been diagnosed, get yourself checked. It is routine, it is quick, and finding it early in yourself is better for everyone.',
      'Keep the rooms ventilated and let in light. That protects you without treating the person as untouchable.',
    ],
  },
];

/**
 * Suggested reading order by situation.
 *
 * Deliberately coarse. It keys off where someone is in the care pathway, which
 * they can see for themselves, rather than off their symptoms or any screening
 * output. Suggesting reading is helpful; inferring a condition from a profile
 * and acting on it is not something this product should do.
 */
export type PatientStage = 'new' | 'awaiting-result' | 'referred' | 'in-treatment';

export const STAGE_RECOMMENDATION: Record<
  PatientStage,
  { heading: string; reason: string; articleIds: string[] }
> = {
  new: {
    heading: 'Start with the basics',
    reason: 'You have no screening on record yet, so this is the useful place to begin.',
    articleIds: ['what-is-tb', 'symptoms', 'prevention'],
  },
  'awaiting-result': {
    heading: 'While you wait',
    reason: 'You have a screening being reviewed, so what happens next is worth knowing.',
    articleIds: ['diagnosis', 'symptoms', 'what-is-tb'],
  },
  referred: {
    heading: 'Before your appointment',
    reason: 'You have been referred for further testing. These cover what that involves.',
    articleIds: ['diagnosis', 'treatment', 'myths'],
  },
  'in-treatment': {
    heading: 'Getting through treatment',
    reason: 'Finishing the course is the part that decides the outcome.',
    articleIds: ['treatment', 'support', 'myths'],
  },
};

export function articleById(id: string): EducationArticle | undefined {
  return ARTICLES.find((article) => article.id === id);
}
