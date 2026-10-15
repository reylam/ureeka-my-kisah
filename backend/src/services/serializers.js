/**
 * Database rows -> the JSON shapes the frontend's domain types describe
 * (frontend/src/types). Keeping the mapping in one file means a column rename
 * touches one place, and means no handler ever returns a raw row (and with it
 * a column nobody meant to expose).
 */

const ts = (value) => (value ? new Date(value).toISOString() : null);

export function account(profile, { staff = null, patientId = null, onboarding = null } = {}) {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    createdAt: ts(profile.created_at),
    lastSignInAt: ts(profile.last_sign_in_at),
    // Professionals point at their staff record; its id is the account id.
    staffUserId: staff ? profile.id : null,
    patientId,
    onboarding: onboarding ?? emptyOnboarding(),
  };
}

export function emptyOnboarding() {
  return { completedAt: null, step: 0, personal: null, address: null, health: null, consent: null };
}

export function onboarding(row) {
  if (!row) return emptyOnboarding();
  const consent =
    row.consent_accepted_at != null
      ? {
          acceptedAt: ts(row.consent_accepted_at),
          dataUse: row.consent_data_use === true,
          healthInfo: row.consent_health_info === true,
        }
      : null;
  return {
    completedAt: ts(row.completed_at),
    step: row.step ?? 0,
    personal: row.personal ?? null,
    address: row.address ?? null,
    health: row.health ?? null,
    consent,
  };
}

export function staff(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.clinical_role,
    canReview: row.can_review === true,
    facilityId: row.facility_id,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
}

export function facility(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    region: row.region,
    province: row.province,
    address: row.address,
    phone: row.phone,
    // Null until a real geocoding lookup exists; never a guessed position.
    coordinates:
      row.latitude != null && row.longitude != null
        ? { lat: Number(row.latitude), lng: Number(row.longitude) }
        : null,
    services: row.services ?? [],
    distanceKm: Number(row.distance_km ?? 0),
    travelTimeMinutes: row.travel_time_minutes ?? 0,
    infoStatus: row.info_status,
    infoUpdatedAt: row.info_updated_at,
    operatingHours: row.operating_hours,
    tbProgrammeContact: row.tb_programme_contact ?? null,
    published: row.published === true,
  };
}

export function note(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    authorId: row.author_id,
    createdAt: ts(row.created_at),
    body: row.body,
    context: row.context,
    contextId: row.context_id ?? undefined,
  };
}

export function patient(row, notes = []) {
  return {
    id: row.id,
    mrn: row.mrn,
    name: row.name,
    sex: row.sex,
    birthDate: row.birth_date,
    phone: row.phone ?? null,
    village: row.village,
    district: row.district,
    province: row.province,
    homeFacilityId: row.home_facility_id ?? null,
    riskFactors: row.risk_factors ?? [],
    householdContacts: row.household_contacts ?? 0,
    registeredAt: ts(row.registered_at),
    notes: notes.map(note),
  };
}

/* ── Screenings ─────────────────────────────────────────────────────────── */

function review(row) {
  if (!row) return null;
  return {
    reviewerId: row.reviewer_id,
    reviewedAt: ts(row.reviewed_at),
    agreement: row.agreement,
    notes: row.notes,
    decision: row.decision,
  };
}

/** Embedded one-to-one relations come back as an object, or an array of one. */
const one = (value) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

/**
 * Full screening for a professional assigned to the patient.
 * `report`, `review` and `referrals` are the embedded relations.
 */
export function screening(row) {
  const report = one(row.screening_reports);
  const referral = (row.referrals ?? [])[0] ?? null;
  const hasImage = Boolean(report?.image_path);
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    operatorId: row.operator_id,
    performedAt: ts(row.performed_at),
    status: row.status,
    symptoms: report?.symptoms ?? null,
    vitals: report?.vitals ?? null,
    // The path itself never leaves the server. `imageKey` is just the
    // screening id when an image exists, so the client knows to ask for a
    // signed URL.
    imageKey: hasImage ? row.id : null,
    sampleImage: null,
    imageMeta: report?.image_meta ?? null,
    imageQuality: row.image_quality,
    modelStatus: report?.model_status ?? 'not-run',
    analysis: report?.analysis ?? null,
    review: review(one(row.screening_reviews)),
    referralId: referral?.id ?? null,
    sync: 'synced',
    createdOffline: row.created_offline === true,
  };
}

/**
 * What a patient may see of their own screening: workflow state, image
 * quality and the clinician's review. No symptoms entry, vitals, image or
 * model output.
 */
export function patientScreening(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    operatorId: row.operator_id,
    performedAt: ts(row.performed_at),
    status: row.status,
    imageQuality: row.image_quality,
    review: review(one(row.screening_reviews)),
    referralId: ((row.referrals ?? [])[0] ?? null)?.id ?? null,
  };
}

/** Administrators get record metadata only. */
export function adminScreening(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    operatorId: row.operator_id,
    performedAt: ts(row.performed_at),
    status: row.status,
    imageQuality: row.image_quality,
    createdOffline: row.created_offline === true,
  };
}

/* ── Referrals and follow-ups ───────────────────────────────────────────── */

export function referral(row, events = row.referral_events ?? []) {
  return {
    id: row.id,
    code: row.code,
    patientId: row.patient_id,
    screeningId: row.screening_id ?? null,
    fromFacilityId: row.from_facility_id,
    toFacilityId: row.to_facility_id,
    reason: row.reason,
    requestedService: row.requested_service,
    priority: row.priority,
    status: row.status,
    createdAt: ts(row.created_at),
    appointmentDate: row.appointment_date ?? null,
    assignedWorkerId: row.assigned_worker_id ?? null,
    history: [...events]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((event) => ({
        id: event.id,
        at: ts(event.created_at),
        actorId: event.actor_id ?? null,
        from: event.from_status ?? null,
        to: event.to_status,
        note: event.note ?? null,
      })),
    sync: 'synced',
  };
}

export function followUp(row, attempts = row.follow_up_attempts ?? []) {
  return {
    id: row.id,
    code: row.code,
    patientId: row.patient_id,
    referralId: row.referral_id ?? null,
    screeningId: row.screening_id ?? null,
    reason: row.reason,
    dueDate: row.due_date,
    status: row.status,
    assignedWorkerId: row.assigned_worker_id ?? null,
    createdAt: ts(row.created_at),
    completedAt: ts(row.completed_at),
    unresolvedReason: row.unresolved_reason ?? null,
    attempts: [...attempts]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((attempt) => ({
        id: attempt.id,
        at: ts(attempt.created_at),
        actorId: attempt.actor_id,
        channel: attempt.channel,
        outcome: attempt.outcome,
        note: attempt.note ?? null,
      })),
    sync: 'synced',
  };
}

export function auditEntry(row) {
  return {
    id: row.id,
    at: ts(row.at),
    actorId: row.actor_id ?? null,
    actorName: row.actor_name,
    action: row.action,
    subject: row.subject,
    detail: row.detail ?? null,
  };
}
