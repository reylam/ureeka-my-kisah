/**
 * Human-readable labels for the domain's values, in one place.
 *
 * Wording matters in this product: nothing here may read as a diagnosis.
 * Outcomes describe what the model flagged, and statuses describe where the
 * visit is, never the patient's disease state.
 */

import type { ImageQuality, ScreeningOutcome, ScreeningStatus, Sex } from '@/types/domain';

export const screeningStatusLabel: Record<ScreeningStatus, string> = {
  waiting: 'Menunggu pemeriksaan',
  examining: 'Sedang diperiksa',
  queued: 'Di antrean',
  served: 'Sudah dipanggil',
};

export const screeningOutcomeLabel: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Ditandai untuk dilihat dokter',
  'no-alert': 'Tidak ada peringatan',
  inconclusive: 'Belum meyakinkan',
};

/** Short form for dense table cells. */
export const screeningOutcomeShort: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Ditandai',
  'no-alert': 'Tanpa peringatan',
  inconclusive: 'Belum meyakinkan',
};

/** One line on what each outcome does and does not mean. */
export const screeningOutcomeMeaning: Record<ScreeningOutcome, string> = {
  'flagged-for-review':
    'Model menilai gambar ini mirip pola yang ia pelajari sebagai bukan sehat. Ini pemicu agar dokter memeriksa lebih dekat, bukan diagnosis.',
  'no-alert':
    'Model tidak memunculkan peringatan. Ini tidak menyingkirkan kemungkinan TB; gejala dan penilaian dokter tetap yang utama.',
  inconclusive:
    'Tidak ada kelas yang jelas unggul, jadi model tidak memberi jawaban yang bisa dipegang. Penilaian langsung oleh dokter lebih berguna.',
};

export const imageQualityLabel: Record<ImageQuality, string> = {
  adequate: 'Memadai',
  borderline: 'Batas',
  inadequate: 'Tidak memadai',
};

export const sexLabel: Record<Sex, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
};

export const symptomLabel: Record<string, string> = {
  coughWeeks: 'Lama batuk',
  hemoptysis: 'Batuk darah',
  nightSweats: 'Keringat malam',
  weightLoss: 'Berat badan turun tanpa sebab',
  fever: 'Demam',
  chestPain: 'Nyeri dada',
  fatigue: 'Mudah lelah',
  appetiteLoss: 'Nafsu makan menurun',
};
