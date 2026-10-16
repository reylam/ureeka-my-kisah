import type { AuditAction } from '@/types/account';

/** Human wording for audit entries, kept out of the pages that render them. */
export const AUDIT_LABEL: Record<AuditAction, string> = {
  'account.created': 'Akun dibuat',
  'account.role-changed': 'Role diubah',
  'account.suspended': 'Akun ditangguhkan',
  'account.reactivated': 'Akun diaktifkan kembali',
  'onboarding.completed': 'Onboarding selesai',
  'consent.health-info-changed': 'Persetujuan data kesehatan diubah',
  'facility.created': 'Fasilitas ditambahkan',
  'facility.updated': 'Fasilitas diperbarui',
  'facility.published': 'Fasilitas dipublikasikan',
  'facility.unpublished': 'Publikasi fasilitas dibatalkan',
  'facility.deleted': 'Fasilitas dihapus',
  'patient.viewed': 'Rekam pasien dibuka',
  'patient.created': 'Pasien didaftarkan',
  'patient.updated': 'Rekam pasien diubah',
  'patient.facility-changed': 'Fasilitas pasien diubah',
  'screening.created': 'Screening dicatat',
  'screening.deleted': 'Draf screening dihapus',
  'screening.image-attached': 'X-ray dilampirkan',
  'screening.image-viewed': 'X-ray dilihat',
  'screening.analysed': 'Analisis model dijalankan',
  'screening.reviewed': 'Screening ditinjau',
  'referral.created': 'Referral dibuat',
  'referral.status-changed': 'Status referral diubah',
  'followup.created': 'Follow-up dibuat',
};
