/**
 * Sample geography for the demo dataset.
 *
 * The province is real (Nusa Tenggara Timur, chosen because it reflects the
 * remote, low-connectivity setting this prototype targets), but every district,
 * village and facility below is INVENTED for demonstration purposes. None of it
 * should be read as a real-world directory.
 */

export const PROVINCE = 'Nusa Tenggara Timur';

/** Fictional districts (kabupaten/kecamatan level) used throughout the demo. */
export const DISTRICTS = [
  'Waerana',
  'Lembor Tengah',
  'Satar Mese Utara',
  'Nanga Baru',
  'Tanjung Kelapa',
] as const;

export type District = (typeof DISTRICTS)[number];

/** Fictional villages, grouped by their district. */
export const VILLAGES: Record<District, string[]> = {
  Waerana: ['Wae Nioka', 'Compang Tolok', 'Rendu Bata', 'Golo Mbu'],
  'Lembor Tengah': ['Nggorang Baru', 'Siru Permai', 'Tenda Wangka'],
  'Satar Mese Utara': ['Lungar', 'Pongkor Lama', 'Iteng Selatan', 'Watu Rambung'],
  'Nanga Baru': ['Nanga Lili', 'Sambi Rampas', 'Lekolembo'],
  'Tanjung Kelapa': ['Kelapa Dua', 'Loha Tengah', 'Warloka Baru'],
};

/** Flat list of every village with its district, for pickers and generators. */
export const VILLAGE_INDEX: { village: string; district: District }[] = DISTRICTS.flatMap(
  (district) => VILLAGES[district].map((village) => ({ village, district })),
);
