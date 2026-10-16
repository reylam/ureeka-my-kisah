import type { Applicant, Patient, Sex } from '@/types/domain';
import type { PatientInput } from '@/services/recordsApi';

/**
 * The patient form's working state: strings, as the inputs hold them, turned
 * into a `PatientInput` only once it validates.
 */

export interface PatientDraft {
  name: string;
  sex: Sex | '';
  birthDate: string;
  phone: string;
  address: string;
}

export const EMPTY_PATIENT_DRAFT: PatientDraft = { name: '', sex: '', birthDate: '', phone: '', address: '' };

export function draftFromPatient(patient: Patient): PatientDraft {
  return {
    name: patient.name,
    sex: patient.sex,
    birthDate: patient.birthDate,
    phone: patient.phone ?? '',
    address: patient.address,
  };
}

/** Start the "save as patient" form from what the person typed in the request form. */
export function draftFromApplicant(applicant: Applicant): PatientDraft {
  return {
    name: applicant.name,
    sex: applicant.sex ?? '',
    birthDate: applicant.birthDate ?? '',
    phone: applicant.phone ?? '',
    address: applicant.address,
  };
}

export type PatientDraftErrors = Partial<Record<keyof PatientDraft, string>>;

export function validatePatientDraft(draft: PatientDraft, today = new Date()): PatientDraftErrors {
  const errors: PatientDraftErrors = {};
  if (draft.name.trim().length < 2) errors.name = 'Isi nama lengkap.';
  if (!draft.sex) errors.sex = 'Pilih jenis kelamin.';
  if (!draft.birthDate) errors.birthDate = 'Isi tanggal lahir.';
  else if (Number.isNaN(Date.parse(draft.birthDate)) || new Date(draft.birthDate) > today || draft.birthDate < '1900-01-01') {
    errors.birthDate = 'Tanggal lahir tidak valid.';
  }
  if (draft.phone.trim().length > 40) errors.phone = 'Nomor telepon terlalu panjang.';
  if (draft.address.trim().length > 300) errors.address = 'Alamat terlalu panjang (maks. 300 huruf).';
  return errors;
}

/** Only call after `validatePatientDraft` returned no errors. */
export function patientInputFromDraft(draft: PatientDraft): PatientInput {
  return {
    name: draft.name.trim(),
    sex: draft.sex as Sex,
    birthDate: draft.birthDate,
    phone: draft.phone.trim() || null,
    address: draft.address.trim(),
  };
}
