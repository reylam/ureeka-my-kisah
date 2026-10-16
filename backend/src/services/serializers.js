/**
 * Database rows -> the JSON shapes the frontend's domain types describe
 * (frontend/src/types/domain.ts). Keeping the mapping in one file means no
 * handler ever returns a raw row, and with it a column nobody meant to expose
 * (the image's storage path, for one).
 */

const ts = (value) => (value ? new Date(value).toISOString() : null);

/** Embedded to-one relations come back as an object, or an array of one. */
const one = (value) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

const isEmpty = (value) => !value || (typeof value === 'object' && Object.keys(value).length === 0);

export function account(profile) {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
  };
}

export function staff(row) {
  return { id: row.id, name: row.full_name, role: row.role };
}

export function patient(row) {
  return {
    id: row.id,
    mrn: row.mrn,
    name: row.name,
    sex: row.sex,
    birthDate: row.birth_date,
    phone: row.phone ?? null,
    address: row.address ?? '',
    createdAt: ts(row.created_at),
  };
}

function applicant(value) {
  if (!value) return null;
  return {
    name: value.name ?? '',
    sex: value.sex ?? null,
    birthDate: value.birthDate ?? null,
    phone: value.phone ?? null,
    address: value.address ?? '',
  };
}

/** Columns a screening is read with: everything, plus who the patient is. */
export const SCREENING_SELECT = '*, patients(id,mrn,name,sex,birth_date,phone,address,created_at)';

export function screening(row) {
  const person = one(row.patients);
  return {
    id: row.id,
    patientId: row.patient_id ?? null,
    patient: person ? patient(person) : null,
    applicant: applicant(row.applicant),
    complaint: row.complaint ?? '',
    accessCode: row.access_code,
    requestDate: row.request_date,
    requestedAt: ts(row.requested_at),
    createdBy: row.created_by ?? null,

    status: row.status,
    operatorId: row.operator_id ?? null,
    startedAt: ts(row.started_at),
    symptoms: isEmpty(row.symptoms) ? null : row.symptoms,
    vitals: isEmpty(row.vitals) ? null : row.vitals,
    imageQuality: row.image_quality,
    hasImage: Boolean(row.image_path),
    imageMeta: row.image_meta ?? null,
    modelStatus: row.model_status,
    analysis: row.analysis ?? null,

    queuePriority: row.queue_priority ?? null,
    queueNumber: row.queue_number ?? null,
    queueDate: row.queue_date ?? null,
    submittedAt: ts(row.submitted_at),
    servedAt: ts(row.served_at),
  };
}

/**
 * "Fransiskus Jehaut" -> "Fransiskus J." The result page is opened with a code
 * alone, so it names the person only enough for them to recognise the visit.
 */
export function maskName(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const [first, ...rest] = words;
  return [first, ...rest.map((word) => `${word[0].toUpperCase()}.`)].join(' ');
}

/**
 * What a patient sees with their access code. Deliberately small: where the
 * visit is, how many are ahead, and once it is out, the queue number, the
 * priority and the model's first reading in one word. No image, no scores, no
 * symptoms.
 */
export function publicStatus(row, { ahead }) {
  const person = one(row.patients);
  const released = row.status === 'queued' || row.status === 'served';
  return {
    status: row.status,
    name: maskName(person?.name ?? row.applicant?.name),
    requestDate: row.request_date,
    requestedAt: ts(row.requested_at),
    ahead,
    queueNumber: released ? row.queue_number : null,
    priority: released ? row.queue_priority : null,
    outcome: released ? (row.analysis?.outcome ?? null) : null,
    submittedAt: released ? ts(row.submitted_at) : null,
    servedAt: ts(row.served_at),
  };
}
