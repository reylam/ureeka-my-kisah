import type { FieldRow, Provenance } from '@/trace/types';

/**
 * Dataset documentation — mock values.
 *
 * This project has not acquired, licensed or evaluated a dataset. The table
 * below is a *template*: it shows the fields a TB screening study has to
 * document, filled with placeholder values so the layout can be reviewed.
 *
 * The placeholder is deliberately labelled "Dataset A" rather than named after
 * a real collection. Writing "TBX11K, 11 200 images" into a mock table is how
 * a mock table quietly becomes a false citation.
 */

export const DATASET_TABLE_CAPTION =
  'Illustrative dataset metadata — replace with verified source information.';

export const DATASET_SUMMARY: FieldRow[] = [
  {
    field: 'Dataset name',
    value: 'Dataset A (placeholder)',
    provenance: 'illustrative',
    note: 'No dataset has been acquired. Candidate public sets are listed below.',
  },
  {
    field: 'Source and version',
    value: 'Not yet specified',
    provenance: 'not-computed',
    note: 'Record the distribution, the version and the download date.',
  },
  { field: 'Images', value: '4 800', provenance: 'illustrative' },
  {
    field: 'Patients',
    value: '3 100',
    provenance: 'illustrative',
    note: 'Needed for patient-level splitting. Several public sets do not publish it.',
  },
  {
    field: 'Images per patient',
    value: '1.5 mean, 1–4 range',
    provenance: 'illustrative',
  },
  {
    field: 'Label definition',
    value: 'TB-related / non-TB, assigned per image',
    provenance: 'illustrative',
    note: 'The label is a dataset annotation, not a clinical diagnosis of the person.',
  },
  {
    field: 'Reference standard',
    value: 'Not yet specified',
    provenance: 'not-computed',
    note: 'The single most important field: was the TB label bacteriologically confirmed, or read off the image?',
  },
  {
    field: 'Class distribution',
    value: '3 960 non-TB · 840 TB-related (17.5% positive)',
    provenance: 'illustrative',
    note: 'Far higher than a community screening prevalence, which is why PPV must be recomputed for deployment.',
  },
  {
    field: 'Modality',
    value: 'Digital chest radiography, frontal (PA) projection, grayscale',
    provenance: 'illustrative',
  },
  {
    field: 'Image size',
    value: '512 × 512 px, 8-bit, PNG',
    provenance: 'illustrative',
  },
  {
    field: 'Acquisition conditions',
    value: 'Not yet specified',
    provenance: 'not-computed',
    note: 'Equipment, exposure settings, site and year. Rarely published per image; records the risk of a site signature.',
  },
  {
    field: 'Inclusion criteria',
    value: 'Frontal chest radiograph, age ≥ 15, label present',
    provenance: 'illustrative',
  },
  {
    field: 'Exclusion criteria',
    value: 'Lateral projection, paediatric, duplicates, corrupt files, burned-in identifiers',
    provenance: 'illustrative',
  },
  {
    field: 'Split strategy',
    value: 'Patient-level stratified split, 70 / 15 / 15, fixed seed',
    provenance: 'illustrative',
    note: 'By person, never by image. Image-level splitting inflates every downstream number.',
  },
  {
    field: 'Split sizes',
    value: '3 360 train · 720 validation · 720 test',
    provenance: 'illustrative',
  },
  {
    field: 'Demographics',
    value: 'Not yet specified',
    provenance: 'not-computed',
    note: 'Age, sex, HIV status and comorbidity. Without these, subgroup analysis cannot be done at all.',
  },
  {
    field: 'Licence and usage',
    value: 'Not yet specified',
    provenance: 'not-computed',
    note: 'Must be resolved before any image is used, and no image is redistributed by this frontend.',
  },
  {
    field: 'Known limitations',
    value: 'Few source sites, unknown demographic spread, no prospective collection',
    provenance: 'illustrative',
  },
];

/** Class counts for the composition chart. Mock values matching the table. */
export const CLASS_DISTRIBUTION: {
  className: string;
  train: number;
  validation: number;
  test: number;
  provenance: Provenance;
}[] = [
  { className: 'Non-TB', train: 2772, validation: 594, test: 594, provenance: 'illustrative' },
  { className: 'TB-related', train: 588, validation: 126, test: 126, provenance: 'illustrative' },
];

/**
 * Public datasets the interface is prepared to document.
 *
 * Listed as candidates. None has been obtained or evaluated by this project,
 * and the status column says so for each one rather than once at the bottom.
 */
export const CANDIDATE_DATASETS: {
  name: string;
  holder: string;
  scale: string;
  status: string;
  sourceId: string;
}[] = [
  {
    name: 'TBX11K',
    holder: 'Liu et al., Nankai University',
    scale: 'Chest radiographs with TB lesion bounding boxes',
    status: 'Candidate. Not obtained, not evaluated. Licence terms to be confirmed with the authors.',
    sourceId: 'tbx11k',
  },
  {
    name: 'Shenzhen chest X-ray set',
    holder: 'Shenzhen No. 3 People’s Hospital / US National Library of Medicine',
    scale: 'Several hundred radiographs with TB / normal labels',
    status: 'Candidate. Not obtained. Overlaps with other collections, so duplication must be checked.',
    sourceId: 'shenzhenMontgomery',
  },
  {
    name: 'Montgomery County chest X-ray set',
    holder: 'Montgomery County Health Department / US National Library of Medicine',
    scale: 'Roughly a hundred radiographs with lung field masks',
    status: 'Candidate. Not obtained. Small, and best used for segmentation or sanity checks.',
    sourceId: 'shenzhenMontgomery',
  },
  {
    name: 'A prospective local screening cohort',
    holder: 'Not established',
    scale: '—',
    status:
      'Does not exist for this project. It is the evaluation that would actually matter for deployment, and the one that cannot be assembled from public downloads.',
    sourceId: 'whoScreening2021',
  },
];
