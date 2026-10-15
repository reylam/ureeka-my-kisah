import type { Source } from '@/trace/types';

/**
 * External sources.
 *
 * Every clinical or epidemiological statement on the site points at one of
 * these. The list is deliberately short: these are real publications at real
 * URLs, and nothing is cited to make a claim look better supported than it is.
 *
 * Note what is *not* here: no hospital partner, no endorsement, no evaluation
 * of this prototype by anybody. There is nothing to cite for those.
 */
export const SOURCES: Record<string, Source> = {
  whoGtb2025: {
    id: 'whoGtb2025',
    label: 'Global tuberculosis report 2025',
    publisher: 'World Health Organization',
    year: 2025,
    url: 'https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health/tb-reports/global-tuberculosis-report-2025',
    note: 'Source for the global burden figures quoted on this site (2024 estimates).',
  },
  whoScreening2021: {
    id: 'whoScreening2021',
    label: 'WHO consolidated guidelines on tuberculosis, Module 2: Screening',
    publisher: 'World Health Organization',
    year: 2021,
    url: 'https://www.who.int/publications/i/item/9789240022676',
    note: 'Sets out the role of chest radiography and computer-aided detection in TB screening and triage.',
  },
  whoCxr2016: {
    id: 'whoCxr2016',
    label: 'Chest radiography in tuberculosis detection',
    publisher: 'World Health Organization',
    year: 2016,
    url: 'https://www.who.int/publications/i/item/9789241511506',
    note: 'Reference for the sensitivity, and the limited specificity, of chest radiography for TB.',
  },
  whoCadToolkit: {
    id: 'whoCadToolkit',
    label: 'Calibrating computer-aided detection (CAD) for TB',
    publisher: 'WHO / TDR',
    year: 2023,
    url: 'https://tdr.who.int/tuberculosis-research/calibrating-computer-aided-detection-for-TB',
    note: 'On why a CAD threshold has to be recalibrated for the population it is used in.',
  },
  tbx11k: {
    id: 'tbx11k',
    label: 'Rethinking Computer-Aided Tuberculosis Diagnosis (TBX11K)',
    publisher: 'Liu, Wu, Ban, Wang & Cheng — IEEE/CVF CVPR',
    year: 2020,
    url: 'https://mmcheng.net/tb/',
    note: 'A public chest X-ray dataset with TB lesion boxes. Referenced as a candidate, not used here.',
  },
  shenzhenMontgomery: {
    id: 'shenzhenMontgomery',
    label: 'Two public chest X-ray datasets for computer-aided screening of pulmonary diseases',
    publisher: 'Jaeger et al. — Quantitative Imaging in Medicine and Surgery',
    year: 2014,
    url: 'https://pubmed.ncbi.nlm.nih.gov/25525580/',
    note: 'Origin of the Shenzhen and Montgomery County collections.',
  },
  gradcam: {
    id: 'gradcam',
    label: 'Grad-CAM: Visual Explanations from Deep Networks via Gradient-based Localization',
    publisher: 'Selvaraju et al. — ICCV',
    year: 2017,
    url: 'https://arxiv.org/abs/1610.02391',
    note: 'The saliency method described in the explainability section.',
  },
  sanityChecks: {
    id: 'sanityChecks',
    label: 'Sanity Checks for Saliency Maps',
    publisher: 'Adebayo et al. — NeurIPS',
    year: 2018,
    url: 'https://arxiv.org/abs/1810.03292',
    note: 'Evidence that a saliency map can look convincing while carrying no information.',
  },
  pitfalls: {
    id: 'pitfalls',
    label: 'Common pitfalls and recommendations for using machine learning to detect COVID-19',
    publisher: 'Roberts et al. — Nature Machine Intelligence',
    year: 2021,
    url: 'https://www.nature.com/articles/s42256-021-00307-0',
    note: 'A catalogue of methodological failures in chest-imaging ML, including duplicate-patient leakage.',
  },
  tripodAi: {
    id: 'tripodAi',
    label: 'TRIPOD+AI reporting guideline for prediction models',
    publisher: 'Collins et al. — BMJ',
    year: 2024,
    url: 'https://www.bmj.com/content/385/bmj-2023-078378',
    note: 'The reporting checklist this page’s structure is modelled on.',
  },
};

export const SOURCE_LIST: Source[] = Object.values(SOURCES);
