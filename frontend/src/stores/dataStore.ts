/**
 * Client-side cache of the signed-in person's records.
 *
 * Every page reads from this store, so an update made on one screen (a
 * referral status change, a completed follow-up, a new screening) is visible
 * everywhere else immediately. The store is a cache, not the record: it is
 * filled from the API after sign-in, every write goes to the API first and
 * the response replaces the local copy, and nothing is persisted to browser
 * storage except the outbox described below.
 *
 * What each role receives is decided by the server. A professional gets the
 * patients assigned to their facility; a patient gets their own record; an
 * administrator gets patients and screening metadata. For a patient or an
 * administrator the clinical fields of a screening are simply absent, and the
 * pages those roles can reach never read them.
 *
 * Outbox: a screening captured without a connection cannot reach the API, so
 * it is held on this device (record and radiograph) and sent when a
 * connection returns. That is the only record type queued; everything else is
 * written straight to the API. Radiographs live in IndexedDB until uploaded
 * (`services/imageStore.ts`), then are removed from the device.
 */

import { create } from 'zustand';
import type {
  ClinicalReview,
  ContactAttempt,
  ContactChannel,
  FacilityService,
  FollowUp,
  FollowUpReason,
  ISODate,
  ImageMeta,
  ImageQuality,
  Patient,
  Referral,
  ReferralPriority,
  ReferralStatus,
  RiskFactor,
  Screening,
  ScreeningVitals,
  Sex,
  SymptomSet,
  SyncQueueItem,
} from '@/types/domain';
import type { Account } from '@/types/account';
import { ApiError, api, fetchAllPages } from '@/lib/apiClient';
import { onSessionReset } from '@/lib/sessionReset';
import { PROVINCE } from '@/data/geography';
import { OPERATING_FACILITY_ID } from '@/data/facilities';
import { deleteImage, getImage } from '@/services/imageStore';
import { classifyImage, localModelSupported } from '@/services/localModel';
import { getScreeningImageUrl } from '@/services/recordsApi';
import { createId } from '@/utils/id';

/* ── Input shapes for create actions ──────────────────────────────────────── */

export interface NewPatientInput {
  name: string;
  sex: Sex;
  birthDate: ISODate;
  phone: string | null;
  village: string;
  district: string;
  riskFactors: RiskFactor[];
  householdContacts: number;
}

export interface NewScreeningInput {
  patientId: string;
  symptoms: SymptomSet;
  vitals: ScreeningVitals;
  /** Key of the radiograph in the device image store, if one was attached. */
  imageKey: string | null;
  imageMeta: ImageMeta | null;
  imageQuality: ImageQuality;
  /** True when the record was captured without a connection. */
  offline: boolean;
  /** Draft records are saved without being submitted. */
  asDraft: boolean;
}

export interface NewReferralInput {
  patientId: string;
  screeningId: string | null;
  toFacilityId: string;
  reason: string;
  requestedService: FacilityService;
  priority: ReferralPriority;
  appointmentDate: ISODate | null;
  assignedWorkerId: string;
  status: Extract<ReferralStatus, 'draft' | 'pending'>;
}

export interface NewFollowUpInput {
  patientId: string;
  referralId: string | null;
  screeningId: string | null;
  reason: FollowUpReason;
  dueDate: ISODate;
  assignedWorkerId: string;
}

export type DraftPatch = Pick<
  Screening,
  'symptoms' | 'vitals' | 'imageKey' | 'imageMeta' | 'imageQuality'
>;

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/* ── Store shape ──────────────────────────────────────────────────────────── */

export interface DataState {
  patients: Patient[];
  screenings: Screening[];
  referrals: Referral[];
  followUps: FollowUp[];
  /** Screenings captured offline, waiting to be sent. */
  syncQueue: SyncQueueItem[];
  lastSyncAt: string | null;
  status: LoadStatus;
  /** Bumped by `reload` so views can re-run loaders. */
  revision: number;

  hydrate: (account: Account) => Promise<void>;
  reload: () => Promise<void>;
  reset: () => void;

  /* Patients */
  createPatient: (input: NewPatientInput) => Promise<Patient>;
  loadPatient: (id: string) => Promise<Patient>;
  /** Administrators place a patient at a facility, which decides who is assigned to them. */
  placePatient: (id: string, homeFacilityId: string | null) => Promise<void>;
  addPatientNote: (
    patientId: string,
    body: string,
    context?: 'general' | 'screening' | 'referral' | 'followup',
    contextId?: string,
  ) => Promise<void>;

  /* Screenings */
  loadScreening: (id: string) => Promise<Screening>;
  createScreening: (input: NewScreeningInput) => Promise<Screening>;
  /** Save changes to a draft without submitting it. */
  saveDraft: (screeningId: string, patch: DraftPatch) => Promise<Screening>;
  /** Submit a saved draft. `offline` keeps it in the outbox instead of sending. */
  finalizeDraft: (screeningId: string, patch: DraftPatch, offline: boolean) => Promise<Screening>;
  /**
   * Run the screening model: on the server when it has one, otherwise in this
   * browser. Rejects with MODEL_NOT_CONNECTED when neither can run it.
   */
  analyzeScreening: (screeningId: string) => Promise<Screening>;
  submitReview: (
    screeningId: string,
    review: Omit<ClinicalReview, 'reviewerId' | 'reviewedAt'>,
  ) => Promise<void>;
  deleteScreening: (id: string) => Promise<void>;

  /* Referrals */
  createReferral: (input: NewReferralInput) => Promise<Referral>;
  updateReferral: (
    id: string,
    patch: Partial<
      Pick<
        Referral,
        'toFacilityId' | 'reason' | 'requestedService' | 'priority' | 'appointmentDate' | 'assignedWorkerId'
      >
    >,
  ) => Promise<void>;
  setReferralStatus: (id: string, status: ReferralStatus, note?: string) => Promise<void>;

  /* Follow-ups */
  createFollowUp: (input: NewFollowUpInput) => Promise<FollowUp>;
  rescheduleFollowUp: (id: string, dueDate: ISODate, note?: string) => Promise<void>;
  logContactAttempt: (
    id: string,
    channel: ContactChannel,
    outcome: ContactAttempt['outcome'],
    note: string | null,
  ) => Promise<void>;
  completeFollowUp: (id: string, note?: string) => Promise<void>;
  markFollowUpUnresolved: (id: string, reason: string) => Promise<void>;
  reassignFollowUp: (id: string, workerId: string) => Promise<void>;

  /* Outbox */
  syncItem: (itemId: string) => Promise<'synced' | 'failed'>;
  removeSyncItem: (itemId: string) => void;
}

/* ── Normalising what the API returns ─────────────────────────────────────── */

type Raw<T> = T & Record<string, unknown>;

const normalisePatient = (patient: Raw<Patient>): Patient => ({
  ...patient,
  homeFacilityId: patient.homeFacilityId ?? '',
  notes: patient.notes ?? [],
});

const normaliseReferral = (referral: Raw<Referral>): Referral => ({
  ...referral,
  assignedWorkerId: referral.assignedWorkerId ?? '',
  history: (referral.history ?? []).map((event) => ({ ...event, actorId: event.actorId ?? '' })),
});

const normaliseFollowUp = (followUp: Raw<FollowUp>): FollowUp => ({
  ...followUp,
  assignedWorkerId: followUp.assignedWorkerId ?? '',
  attempts: followUp.attempts ?? [],
});

// Everything the server returns is, by definition, already synced. Patient and
// administrator views also omit the clinical fields, which those roles never read.
const normaliseScreening = (screening: Raw<Screening>): Screening => ({
  ...screening,
  sync: screening.sync ?? 'synced',
});

/** Replace the record with the same id, or add it at the front. */
function upsert<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => (item.id === next.id ? next : item))
    : [next, ...items];
}

const isLocalId = (id: string) => id.startsWith('local_');

/** Image keys in the device store carry a prefix; server-held images use the screening id. */
const isDeviceImage = (key: string | null | undefined): key is string =>
  Boolean(key && key.startsWith('cxr:'));

/* ── Outbox persistence ───────────────────────────────────────────────────── */

const OUTBOX_KEY = 'parupintas.outbox.v1';

interface OutboxSnapshot {
  queue: SyncQueueItem[];
  screenings: Screening[];
  lastSyncAt: string | null;
}

/** Who the outbox on this device belongs to. Only professionals capture records. */
let outboxOwner: string | null = null;
/** The account the store was last hydrated for. */
let boundAccount: Account | null = null;

function readOutbox(ownerId: string): OutboxSnapshot {
  try {
    const raw = window.localStorage.getItem(`${OUTBOX_KEY}.${ownerId}`);
    if (!raw) return { queue: [], screenings: [], lastSyncAt: null };
    const parsed = JSON.parse(raw) as Partial<OutboxSnapshot>;
    return {
      queue: parsed.queue ?? [],
      screenings: parsed.screenings ?? [],
      lastSyncAt: parsed.lastSyncAt ?? null,
    };
  } catch {
    return { queue: [], screenings: [], lastSyncAt: null };
  }
}

function writeOutbox(state: Pick<DataState, 'syncQueue' | 'screenings' | 'lastSyncAt'>): void {
  if (!outboxOwner) return;
  const local = state.screenings.filter((s) => isLocalId(s.id));
  try {
    if (state.syncQueue.length === 0 && local.length === 0) {
      window.localStorage.removeItem(`${OUTBOX_KEY}.${outboxOwner}`);
      return;
    }
    const snapshot: OutboxSnapshot = {
      queue: state.syncQueue,
      screenings: local,
      lastSyncAt: state.lastSyncAt,
    };
    window.localStorage.setItem(`${OUTBOX_KEY}.${outboxOwner}`, JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked. The record is still in memory for this session.
  }
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

async function ownPatientRecord(): Promise<Patient[]> {
  // null until onboarding is finished: no clinical record yet is not an error.
  const record = await api.get<Raw<Patient> | null>('/me/patient');
  return record ? [normalisePatient(record)] : [];
}

async function loadFor(account: Account) {
  if (account.role === 'patient') {
    const [patients, screenings, followUps, referrals] = await Promise.all([
      ownPatientRecord(),
      api.get<Raw<Screening>[]>('/me/screenings'),
      api.get<Raw<FollowUp>[]>('/me/followups'),
      api.get<Raw<Referral>[]>('/me/referrals'),
    ]);
    return {
      patients,
      screenings: screenings.map(normaliseScreening),
      followUps: followUps.map(normaliseFollowUp),
      referrals: referrals.map(normaliseReferral),
    };
  }

  if (account.role === 'admin') {
    // Administrators manage patients and see screening metadata. They are not
    // sent referrals or follow-ups: those are clinical and not theirs.
    const [patients, screenings] = await Promise.all([
      fetchAllPages<Raw<Patient>>('/patients'),
      fetchAllPages<Raw<Screening>>('/screenings'),
    ]);
    return {
      patients: patients.map(normalisePatient),
      screenings: screenings.map(normaliseScreening),
      followUps: [] as FollowUp[],
      referrals: [] as Referral[],
    };
  }

  const [patients, screenings, referrals, followUps] = await Promise.all([
    fetchAllPages<Raw<Patient>>('/patients'),
    fetchAllPages<Raw<Screening>>('/screenings'),
    fetchAllPages<Raw<Referral>>('/referrals'),
    fetchAllPages<Raw<FollowUp>>('/followups'),
  ]);
  return {
    patients: patients.map(normalisePatient),
    screenings: screenings.map(normaliseScreening),
    referrals: referrals.map(normaliseReferral),
    followUps: followUps.map(normaliseFollowUp),
  };
}

/* ── Store ────────────────────────────────────────────────────────────────── */

const emptyState = {
  patients: [] as Patient[],
  screenings: [] as Screening[],
  referrals: [] as Referral[],
  followUps: [] as FollowUp[],
  syncQueue: [] as SyncQueueItem[],
  lastSyncAt: null as string | null,
  status: 'idle' as LoadStatus,
};

export const useDataStore = create<DataState>()((set, get) => {
  /** Persist the outbox after any change to it. */
  const commit = (patch: Partial<DataState>) => {
    set(patch);
    writeOutbox(get());
  };

  /** Refresh one screening from the server after something else changed it. */
  const refreshScreening = async (id: string) => {
    if (isLocalId(id)) return;
    try {
      const fresh = normaliseScreening(await api.get<Raw<Screening>>(`/screenings/${id}`));
      set((state) => ({ screenings: upsert(state.screenings, fresh) }));
    } catch {
      // The write already succeeded; a stale status badge is not worth an error.
    }
  };

  /** Upload a radiograph held on this device, then drop the device copy. */
  const uploadFromDevice = async (screeningId: string, imageKey: string): Promise<Screening> => {
    const blob = await getImage(imageKey);
    if (!blob) {
      throw new ApiError(0, 'IMAGE_MISSING', 'Radiograf tidak lagi tersimpan di perangkat ini.');
    }
    const form = new FormData();
    form.append('image', blob, 'radiograph');
    const updated = normaliseScreening(
      await api.upload<Raw<Screening>>(`/screenings/${screeningId}/image`, form),
    );
    await deleteImage(imageKey);
    return updated;
  };

  /** Create the captured screening on the server, upload its radiograph, swap the local copy. */
  const sendCaptured = async (
    localId: string,
    payload: NonNullable<SyncQueueItem['payload']>,
  ): Promise<Screening> => {
    let result = normaliseScreening(
      await api.post<Raw<Screening>>('/screenings', {
        patientId: payload.patientId,
        symptoms: payload.symptoms,
        vitals: payload.vitals,
        imageQuality: payload.imageQuality,
        asDraft: payload.asDraft,
        createdOffline: true,
        performedAt: payload.capturedAt,
      }),
    );
    if (isDeviceImage(payload.imageKey)) {
      result = await uploadFromDevice(result.id, payload.imageKey);
    }
    set((state) => ({
      screenings: upsert(
        state.screenings.filter((s) => s.id !== localId),
        result,
      ),
    }));
    return result;
  };

  /** Send one queued item. Returns the server's record, or null if it failed. */
  const runQueued = async (itemId: string): Promise<Screening | null> => {
    const item = get().syncQueue.find((entry) => entry.id === itemId);
    if (!item?.payload) return null;

    const stamp = new Date().toISOString();
    try {
      const sent = await sendCaptured(item.entityId, item.payload);
      commit({
        syncQueue: get().syncQueue.filter((entry) => entry.id !== itemId),
        lastSyncAt: stamp,
      });
      return sent;
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message ? cause.message : 'Rekam tidak bisa dikirim.';
      commit({
        syncQueue: get().syncQueue.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                state: 'failed' as const,
                error: message,
                lastAttemptAt: stamp,
                attempts: entry.attempts + 1,
              }
            : entry,
        ),
        screenings: get().screenings.map((s) =>
          s.id === item.entityId ? { ...s, sync: 'failed' as const } : s,
        ),
      });
      return null;
    }
  };

  return {
    ...emptyState,
    revision: 0,

    hydrate: async (account) => {
      boundAccount = account;
      outboxOwner = account.role === 'professional' ? account.id : null;
      set({ status: 'loading' });
      try {
        const loaded = await loadFor(account);
        const outbox = outboxOwner
          ? readOutbox(outboxOwner)
          : { queue: [], screenings: [], lastSyncAt: null };
        set({
          ...loaded,
          // Records captured offline on this device sit in front of the server's.
          screenings: [...outbox.screenings, ...loaded.screenings],
          syncQueue: outbox.queue,
          lastSyncAt: outbox.lastSyncAt,
          status: 'ready',
        });
      } catch (cause) {
        set({ status: 'error' });
        throw cause;
      }
    },

    reload: async () => {
      if (!boundAccount) return;
      await get().hydrate(boundAccount);
      set((state) => ({ revision: state.revision + 1 }));
    },

    reset: () => {
      boundAccount = null;
      outboxOwner = null;
      set({ ...emptyState });
    },

    /* ── Patients ─────────────────────────────────────────────────────── */

    createPatient: async (input) => {
      const created = normalisePatient(
        await api.post<Raw<Patient>>('/patients', {
          name: input.name.trim(),
          sex: input.sex,
          birthDate: input.birthDate,
          phone: input.phone?.trim() || null,
          village: input.village,
          district: input.district,
          province: PROVINCE,
          riskFactors: input.riskFactors,
          householdContacts: input.householdContacts,
        }),
      );
      set((state) => ({ patients: upsert(state.patients, created) }));
      return created;
    },

    loadPatient: async (id) => {
      const patient = normalisePatient(await api.get<Raw<Patient>>(`/patients/${id}`));
      set((state) => ({ patients: upsert(state.patients, patient) }));
      return patient;
    },

    placePatient: async (id, homeFacilityId) => {
      const updated = normalisePatient(
        await api.patch<Raw<Patient>>(`/patients/${id}/home-facility`, { homeFacilityId }),
      );
      set((state) => ({
        patients: state.patients.map((p) => (p.id === id ? { ...updated, notes: p.notes } : p)),
      }));
    },

    addPatientNote: async (patientId, body, context = 'general', contextId) => {
      const note = await api.post<Patient['notes'][number]>(`/patients/${patientId}/notes`, {
        body: body.trim(),
        context,
        ...(contextId ? { contextId } : {}),
      });
      set((state) => ({
        patients: state.patients.map((p) =>
          p.id === patientId ? { ...p, notes: [note, ...p.notes] } : p,
        ),
      }));
    },

    /* ── Screenings ───────────────────────────────────────────────────── */

    loadScreening: async (id) => {
      const screening = normaliseScreening(await api.get<Raw<Screening>>(`/screenings/${id}`));
      set((state) => ({ screenings: upsert(state.screenings, screening) }));
      return screening;
    },

    createScreening: async (input) => {
      if (input.offline) {
        const capturedAt = new Date().toISOString();
        const localId = `local_${createId('scr')}`;
        const local: Screening = {
          id: localId,
          patientId: input.patientId,
          facilityId: OPERATING_FACILITY_ID,
          operatorId: boundAccount?.staffUserId ?? boundAccount?.id ?? '',
          performedAt: capturedAt,
          status: input.asDraft ? 'draft' : 'queued',
          symptoms: input.symptoms,
          vitals: input.vitals,
          imageKey: input.imageKey,
          sampleImage: null,
          imageMeta: input.imageMeta,
          imageQuality: input.imageQuality,
          modelStatus: 'not-run',
          analysis: null,
          review: null,
          referralId: null,
          sync: input.asDraft ? 'local-draft' : 'pending',
          createdOffline: true,
        };
        const patient = get().patients.find((p) => p.id === input.patientId);
        const item: SyncQueueItem = {
          id: createId('syn'),
          kind: 'screening',
          entityId: localId,
          label: `Screening · ${patient?.mrn ?? input.patientId}`,
          state: local.sync,
          queuedAt: capturedAt,
          lastAttemptAt: null,
          attempts: 0,
          sizeBytes: (input.imageMeta?.sizeBytes ?? 0) + 12 * 1024,
          error: null,
          conflict: null,
          payload: {
            patientId: input.patientId,
            symptoms: input.symptoms,
            vitals: input.vitals,
            imageQuality: input.imageQuality,
            imageKey: input.imageKey,
            asDraft: input.asDraft,
            capturedAt,
          },
        };
        commit({ screenings: [local, ...get().screenings], syncQueue: [item, ...get().syncQueue] });
        return local;
      }

      const created = normaliseScreening(
        await api.post<Raw<Screening>>('/screenings', {
          patientId: input.patientId,
          symptoms: input.symptoms,
          vitals: input.vitals,
          imageQuality: input.imageQuality,
          asDraft: input.asDraft,
          createdOffline: false,
        }),
      );
      set((state) => ({ screenings: upsert(state.screenings, created) }));

      if (isDeviceImage(input.imageKey)) {
        // If this fails the record exists without its image; the error says so
        // to the caller instead of hiding it.
        const withImage = await uploadFromDevice(created.id, input.imageKey);
        set((state) => ({ screenings: upsert(state.screenings, withImage) }));
        return withImage;
      }
      return created;
    },

    saveDraft: async (screeningId, patch) => {
      if (isLocalId(screeningId)) {
        const next = get().screenings.map((s) => (s.id === screeningId ? { ...s, ...patch } : s));
        const queue = get().syncQueue.map((item) =>
          item.entityId === screeningId && item.payload
            ? {
                ...item,
                sizeBytes: (patch.imageMeta?.sizeBytes ?? 0) + 12 * 1024,
                payload: {
                  ...item.payload,
                  symptoms: patch.symptoms,
                  vitals: patch.vitals,
                  imageQuality: patch.imageQuality,
                  imageKey: patch.imageKey,
                },
              }
            : item,
        );
        commit({ screenings: next, syncQueue: queue });
        return next.find((s) => s.id === screeningId)!;
      }

      let updated = normaliseScreening(
        await api.patch<Raw<Screening>>(`/screenings/${screeningId}`, {
          symptoms: patch.symptoms,
          vitals: patch.vitals,
          imageQuality: patch.imageQuality,
          submit: false,
        }),
      );
      if (isDeviceImage(patch.imageKey)) updated = await uploadFromDevice(screeningId, patch.imageKey);
      set((state) => ({ screenings: upsert(state.screenings, updated) }));
      return updated;
    },

    finalizeDraft: async (screeningId, patch, offline) => {
      if (isLocalId(screeningId)) {
        // Mark the queued item ready; it is sent now if there is a connection.
        const screenings = get().screenings.map((s) =>
          s.id === screeningId
            ? { ...s, ...patch, status: 'queued' as const, sync: 'pending' as const }
            : s,
        );
        const queue = get().syncQueue.map((item) =>
          item.entityId === screeningId && item.payload
            ? {
                ...item,
                state: 'pending' as const,
                error: null,
                sizeBytes: (patch.imageMeta?.sizeBytes ?? 0) + 12 * 1024,
                payload: {
                  ...item.payload,
                  symptoms: patch.symptoms,
                  vitals: patch.vitals,
                  imageQuality: patch.imageQuality,
                  imageKey: patch.imageKey,
                  asDraft: false,
                },
              }
            : item,
        );
        commit({ screenings, syncQueue: queue });
        const item = queue.find((entry) => entry.entityId === screeningId);
        if (!offline && item) {
          const sent = await runQueued(item.id);
          if (sent) return sent;
        }
        return get().screenings.find((s) => s.id === screeningId)!;
      }

      let updated = normaliseScreening(
        await api.patch<Raw<Screening>>(`/screenings/${screeningId}`, {
          symptoms: patch.symptoms,
          vitals: patch.vitals,
          imageQuality: patch.imageQuality,
          submit: true,
        }),
      );
      if (isDeviceImage(patch.imageKey)) updated = await uploadFromDevice(screeningId, patch.imageKey);
      set((state) => ({ screenings: upsert(state.screenings, updated) }));
      return updated;
    },

    analyzeScreening: async (screeningId) => {
      try {
        const updated = normaliseScreening(
          await api.post<Raw<Screening>>(`/screenings/${screeningId}/analyze`),
        );
        set((state) => ({ screenings: upsert(state.screenings, updated) }));
        return updated;
      } catch (cause) {
        // No model service behind the API (a static or serverless deployment,
        // say): run the model in this browser instead and report what it found.
        if (
          cause instanceof ApiError &&
          (cause.code === 'MODEL_NOT_CONNECTED' || cause.code === 'MODEL_UNREACHABLE') &&
          localModelSupported()
        ) {
          try {
            const url = await getScreeningImageUrl(screeningId);
            const response = await fetch(url);
            if (!response.ok) throw new Error('The radiograph could not be fetched.');
            const { probabilities, model } = await classifyImage(await response.blob());
            const updated = normaliseScreening(
              await api.post<Raw<Screening>>(`/screenings/${screeningId}/analysis`, {
                probabilities,
                model,
              }),
            );
            set((state) => ({ screenings: upsert(state.screenings, updated) }));
            return updated;
          } catch (local) {
            // A conflict (already analysed, not submitted) is the server's
            // answer and should reach the caller as it is. Anything else means
            // the browser could not do it, which for the person is the same as
            // the model not being connected.
            if (local instanceof ApiError && local.status === 409) throw local;
          }
        }

        // Mirror what the server recorded so the badge is right without a refetch.
        if (cause instanceof ApiError && cause.code === 'MODEL_NOT_CONNECTED') {
          set((state) => ({
            screenings: state.screenings.map((s) =>
              s.id === screeningId ? { ...s, modelStatus: 'unavailable' } : s,
            ),
          }));
        } else if (cause instanceof ApiError && cause.status >= 500) {
          await refreshScreening(screeningId);
        }
        throw cause;
      }
    },

    submitReview: async (screeningId, review) => {
      const updated = normaliseScreening(
        await api.post<Raw<Screening>>(`/screenings/${screeningId}/review`, {
          agreement: review.agreement,
          decision: review.decision,
          notes: review.notes,
        }),
      );
      set((state) => ({ screenings: upsert(state.screenings, updated) }));
      // The server also filed the review notes on the patient's timeline.
      if (review.notes.trim()) void get().loadPatient(updated.patientId).catch(() => undefined);
    },

    deleteScreening: async (id) => {
      const screening = get().screenings.find((s) => s.id === id);
      if (!isLocalId(id)) await api.delete(`/screenings/${id}`);
      if (isDeviceImage(screening?.imageKey)) await deleteImage(screening.imageKey);
      commit({
        screenings: get().screenings.filter((s) => s.id !== id),
        syncQueue: get().syncQueue.filter((item) => item.entityId !== id),
      });
    },

    /* ── Referrals ────────────────────────────────────────────────────── */

    createReferral: async (input) => {
      const created = normaliseReferral(
        await api.post<Raw<Referral>>('/referrals', {
          patientId: input.patientId,
          screeningId: input.screeningId,
          toFacilityId: input.toFacilityId,
          reason: input.reason.trim(),
          requestedService: input.requestedService,
          priority: input.priority,
          appointmentDate: input.appointmentDate,
          assignedWorkerId: input.assignedWorkerId,
          status: input.status,
        }),
      );
      set((state) => ({ referrals: upsert(state.referrals, created) }));
      // The server moves the originating screening to "referred".
      if (input.screeningId) await refreshScreening(input.screeningId);
      return created;
    },

    updateReferral: async (id, patch) => {
      const updated = normaliseReferral(await api.patch<Raw<Referral>>(`/referrals/${id}`, patch));
      set((state) => ({ referrals: upsert(state.referrals, updated) }));
    },

    setReferralStatus: async (id, status, note) => {
      const updated = normaliseReferral(
        await api.patch<Raw<Referral>>(`/referrals/${id}/status`, {
          status,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      );
      set((state) => ({ referrals: upsert(state.referrals, updated) }));
    },

    /* ── Follow-ups ───────────────────────────────────────────────────── */

    createFollowUp: async (input) => {
      const created = normaliseFollowUp(await api.post<Raw<FollowUp>>('/followups', input));
      set((state) => ({ followUps: upsert(state.followUps, created) }));
      return created;
    },

    rescheduleFollowUp: async (id, dueDate, note) => {
      const updated = normaliseFollowUp(
        await api.patch<Raw<FollowUp>>(`/followups/${id}/schedule`, {
          dueDate,
          ...(note?.trim() ? { note: note.trim() } : {}),
        }),
      );
      set((state) => ({ followUps: upsert(state.followUps, updated) }));
    },

    logContactAttempt: async (id, channel, outcome, note) => {
      const updated = normaliseFollowUp(
        await api.post<Raw<FollowUp>>(`/followups/${id}/attempts`, { channel, outcome, note }),
      );
      set((state) => ({ followUps: upsert(state.followUps, updated) }));
    },

    completeFollowUp: async (id, note) => {
      const updated = normaliseFollowUp(
        await api.post<Raw<FollowUp>>(
          `/followups/${id}/complete`,
          note?.trim() ? { note: note.trim() } : {},
        ),
      );
      set((state) => ({ followUps: upsert(state.followUps, updated) }));
      if (note?.trim()) void get().loadPatient(updated.patientId).catch(() => undefined);
    },

    markFollowUpUnresolved: async (id, reason) => {
      const updated = normaliseFollowUp(
        await api.post<Raw<FollowUp>>(`/followups/${id}/unresolved`, { reason: reason.trim() }),
      );
      set((state) => ({ followUps: upsert(state.followUps, updated) }));
    },

    reassignFollowUp: async (id, workerId) => {
      const updated = normaliseFollowUp(
        await api.patch<Raw<FollowUp>>(`/followups/${id}/assignee`, { workerId }),
      );
      set((state) => ({ followUps: upsert(state.followUps, updated) }));
    },

    /* ── Outbox ───────────────────────────────────────────────────────── */

    syncItem: async (itemId) => ((await runQueued(itemId)) ? 'synced' : 'failed'),

    removeSyncItem: (itemId) => commit({ syncQueue: get().syncQueue.filter((i) => i.id !== itemId) }),
  };
});

onSessionReset(() => useDataStore.getState().reset());
