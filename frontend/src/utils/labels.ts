/**
 * Single source of truth for human-readable enum labels.
 *
 * Wording matters in this product: nothing here may read as a diagnosis.
 * Screening outcomes describe what the *model flagged*, and workflow statuses
 * describe where the *record* is, never the patient's disease state.
 */

import type {
  ContactChannel,
  FacilityService,
  FacilityType,
  FollowUpReason,
  FollowUpStatus,
  ImageQuality,
  ReferralPriority,
  ReferralStatus,
  RiskFactor,
  ScreeningOutcome,
  ScreeningStatus,
  Sex,
  SyncState,
  UserRole,
} from '@/types/domain';

export const screeningStatusLabel: Record<ScreeningStatus, string> = {
  draft: 'Draf',
  queued: 'Antre untuk dianalisis',
  'awaiting-review': 'Menunggu review',
  reviewed: 'Sudah ditinjau',
  referred: 'Sudah dirujuk',
  closed: 'Ditutup',
};

export const screeningOutcomeLabel: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Ditandai untuk review klinis',
  'no-alert': 'Tidak ada peringatan screening',
  inconclusive: 'Belum meyakinkan',
};

/** Short form for dense table cells. */
export const screeningOutcomeShort: Record<ScreeningOutcome, string> = {
  'flagged-for-review': 'Ditandai',
  'no-alert': 'Tanpa peringatan',
  inconclusive: 'Belum meyakinkan',
};

/** One-line explanation of what each outcome does and does not mean. */
export const screeningOutcomeMeaning: Record<ScreeningOutcome, string> = {
  'flagged-for-review':
    'Model demo menyorot fitur yang di data latihnya dikaitkan dengan TB. Ini hanya pemicu agar klinisi memeriksa gambar, bukan diagnosis.',
  'no-alert':
    'Model demo tidak memunculkan peringatan screening. Ini tidak menyingkirkan kemungkinan TB; penilaian klinis dan gejala tetap menjadi prioritas.',
  inconclusive:
    'Model demo tidak bisa menghasilkan hasil yang layak pakai, biasanya karena kualitas gambar atau confidence yang rendah. Radiograf sebaiknya diambil ulang atau ditinjau manual.',
};

export const imageQualityLabel: Record<ImageQuality, string> = {
  adequate: 'Memadai',
  borderline: 'Batas',
  inadequate: 'Tidak memadai',
};

export const referralStatusLabel: Record<ReferralStatus, string> = {
  draft: 'Draf',
  pending: 'Menunggu',
  referred: 'Dirujuk',
  'appointment-scheduled': 'Janji temu dijadwalkan',
  attended: 'Sudah hadir',
  'followup-required': 'Perlu follow-up',
  closed: 'Ditutup',
};

export const referralPriorityLabel: Record<ReferralPriority, string> = {
  routine: 'Rutin',
  soon: 'Segera',
  urgent: 'Mendesak',
};

export const followUpStatusLabel: Record<FollowUpStatus, string> = {
  scheduled: 'Dijadwalkan',
  'in-progress': 'Berjalan',
  completed: 'Selesai',
  unresolved: 'Belum tuntas',
};

export const followUpReasonLabel: Record<FollowUpReason, string> = {
  'referral-attendance': 'Kehadiran referral',
  'sputum-result': 'Hasil dahak',
  'repeat-imaging': 'Ulang pencitraan',
  'treatment-adherence': 'Kepatuhan pengobatan',
  'contact-tracing': 'Pelacakan kontak',
  'symptom-recheck': 'Cek ulang gejala',
};

export const contactChannelLabel: Record<ContactChannel, string> = {
  phone: 'Telepon',
  'home-visit': 'Kunjungan rumah',
  'village-cadre': 'Kader desa',
  sms: 'SMS',
};

export const contactOutcomeLabel: Record<string, string> = {
  reached: 'Berhasil dihubungi',
  'no-answer': 'Tidak diangkat',
  'wrong-number': 'Nomor salah',
  'moved-away': 'Sudah pindah',
  rescheduled: 'Dijadwalkan ulang',
};

export const facilityTypeLabel: Record<FacilityType, string> = {
  posyandu: 'Posyandu',
  puskesmas: 'Puskesmas',
  clinic: 'Klinik',
  'district-hospital': 'RS daerah',
  'referral-hospital': 'RS rujukan',
  lab: 'Laboratorium',
};

export const facilityServiceLabel: Record<FacilityService, string> = {
  cxr: 'Chest X-ray',
  'sputum-microscopy': 'Mikroskopi dahak',
  'tcm-genexpert': 'Tes molekuler (GeneXpert)',
  'tb-treatment': 'Pengobatan TB',
  'mdr-tb-treatment': 'Pengobatan TB MDR',
  'pediatric-tb': 'TB anak',
  'general-outpatient': 'Rawat jalan umum',
  inpatient: 'Rawat inap',
};

export const facilityInfoStatusLabel: Record<string, string> = {
  'verified-sample': 'Sampel terverifikasi',
  'needs-review': 'Perlu review',
  unconfirmed: 'Belum dikonfirmasi',
};

export const riskFactorLabel: Record<RiskFactor, string> = {
  'household-tb-contact': 'Kontak serumah penderita TB',
  diabetes: 'Diabetes',
  hiv: 'HIV',
  smoker: 'Perokok',
  malnutrition: 'Malnutrisi',
  'prior-tb-treatment': 'Pernah berobat TB',
  'crowded-housing': 'Hunian padat',
  elderly: 'Lansia',
  pregnant: 'Hamil',
};

export const userRoleLabel: Record<UserRole, string> = {
  chw: 'Kader kesehatan masyarakat',
  nurse: 'Perawat',
  physician: 'Dokter',
  coordinator: 'Koordinator program TB',
};

export const syncStateLabel: Record<SyncState, string> = {
  'local-draft': 'Draf lokal',
  pending: 'Menunggu sync',
  synced: 'Tersinkron',
  failed: 'Gagal',
  conflict: 'Konflik',
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
