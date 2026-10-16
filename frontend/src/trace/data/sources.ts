import type { Source } from '@/trace/types';

/**
 * External sources.
 *
 * Short on purpose. Only the three documents the site actually leans on when
 * it states something about tuberculosis, all of them WHO, all at real URLs.
 * The full reference list for the paper lives in `docs/research-notes.txt`.
 *
 * Note what is not here: no hospital partner, no endorsement, no evaluation of
 * this prototype by anybody. There is nothing to cite for those.
 */
export const SOURCES: Record<string, Source> = {
  whoGtb2025: {
    id: 'whoGtb2025',
    label: 'Global tuberculosis report 2025',
    publisher: 'World Health Organization',
    year: 2025,
    url: 'https://www.who.int/teams/global-programme-on-tuberculosis-and-lung-health/tb-reports/global-tuberculosis-report-2025',
    note: 'Sumber angka-angka di halaman ini. Estimasi untuk tahun 2024.',
  },
  whoScreening2021: {
    id: 'whoScreening2021',
    label: 'WHO guidelines on tuberculosis screening',
    publisher: 'World Health Organization',
    year: 2021,
    url: 'https://www.who.int/publications/i/item/9789240022676',
    note: 'Peran chest X-ray, dan software yang membacanya, dalam screening TB.',
  },
  whoCxr2016: {
    id: 'whoCxr2016',
    label: 'Chest radiography in tuberculosis detection',
    publisher: 'World Health Organization',
    year: 2016,
    url: 'https://www.who.int/publications/i/item/9789241511506',
    note: 'Apa yang bisa dan tidak bisa ditunjukkan chest X-ray tentang tuberkulosis.',
  },
};

export const SOURCE_LIST: Source[] = Object.values(SOURCES);
