/**
 * The single source of truth for all mutable demo records.
 *
 * Every page reads from this store, so an update made on one screen (a
 * referral status change, a completed follow-up, a new screening) is visible
 * everywhere else immediately. Records are persisted to localStorage so demo
 * edits survive a reload.
 *
 * Images are deliberately NOT kept here; they live in IndexedDB via
 * `services/imageStore.ts` and are referenced by key only.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ClinicalReview,
  ContactAttempt,
  ContactChannel,
  FollowUp,
  FollowUpReason,
  FollowUpStatus,
  ImageMeta,
  ImageQuality,
  Patient,
  Referral,
  ReferralPriority,
  ReferralStatus,
  RiskFactor,
  Screening,
  ScreeningAnalysis,
  ScreeningVitals,
  Sex,
  SymptomSet,
  SyncQueueItem,
  SyncState,
  FacilityService,
  ISODate,
} from '@/types/domain';
import { createSeedDataset } from '@/data/seed';
import { OPERATING_FACILITY_ID } from '@/data/facilities';
import { PROVINCE } from '@/data/geography';
import { createId, createMrn } from '@/utils/id';
import { currentActorId } from './authStore';
import { clearImages, deleteImage } from '@/services/imageStore';

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
  imageKey: string | null;
  imageMeta: ImageMeta | null;
  imageQuality: ImageQuality;
  /** True when the record was captured without a connection. */
  offline: boolean;
  /** Draft records are saved without running the demo analysis. */
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

/* ── Store ────────────────────────────────────────────────────────────────── */

export interface DataState {
  patients: Patient[];
  screenings: Screening[];
  referrals: Referral[];
  followUps: FollowUp[];
  syncQueue: SyncQueueItem[];
  lastSyncAt: string | null;
  /** Bumped by resetDemoData so views can re-run loaders. */
  revision: number;

  /* Patients */
  createPatient: (input: NewPatientInput) => Patient;
  updatePatient: (id: string, patch: Partial<Patient>) => void;
  addPatientNote: (
    patientId: string,
    body: string,
    context?: 'general' | 'screening' | 'referral' | 'followup',
    contextId?: string,
  ) => void;

  /* Screenings */
  createScreening: (input: NewScreeningInput) => Screening;
  attachAnalysis: (screeningId: string, analysis: ScreeningAnalysis) => void;
  /** Complete a saved draft in place, keeping its original id and queue entry. */
  finalizeDraft: (
    screeningId: string,
    patch: Pick<Screening, 'symptoms' | 'vitals' | 'imageKey' | 'imageMeta' | 'imageQuality'>,
    offline: boolean,
  ) => void;
  submitReview: (
    screeningId: string,
    review: Omit<ClinicalReview, 'reviewerId' | 'reviewedAt'>,
  ) => void;
  updateScreening: (id: string, patch: Partial<Screening>) => void;
  deleteScreening: (id: string) => Promise<void>;

  /* Referrals */
  createReferral: (input: NewReferralInput) => Referral;
  updateReferral: (
    id: string,
    patch: Partial<Pick<Referral, 'toFacilityId' | 'reason' | 'requestedService' | 'priority' | 'appointmentDate' | 'assignedWorkerId'>>,
  ) => void;
  setReferralStatus: (id: string, status: ReferralStatus, note?: string) => void;

  /* Follow-ups */
  createFollowUp: (input: NewFollowUpInput) => FollowUp;
  rescheduleFollowUp: (id: string, dueDate: ISODate, note?: string) => void;
  logContactAttempt: (
    id: string,
    channel: ContactChannel,
    outcome: ContactAttempt['outcome'],
    note: string | null,
  ) => void;
  completeFollowUp: (id: string, note?: string) => void;
  markFollowUpUnresolved: (id: string, reason: string) => void;
  setFollowUpStatus: (id: string, status: FollowUpStatus) => void;
  reassignFollowUp: (id: string, workerId: string) => void;

  /* Offline sync */
  enqueueSync: (item: Omit<SyncQueueItem, 'id'>) => void;
  markSyncResult: (itemId: string, state: SyncState, error?: string | null) => void;
  resolveConflict: (itemId: string, keep: 'local' | 'remote') => void;
  removeSyncItem: (itemId: string) => void;
  setLastSyncAt: (value: string) => void;

  /* Demo lifecycle */
  resetDemoData: () => Promise<void>;
}

const seed = createSeedDataset();

/**
 * Shallow helper: replace the matching record in an array.
 *
 * `NoInfer` on the patch keeps `T` pinned to the array's element type.
 * Otherwise a narrow patch object (e.g. `Partial<Pick<Referral, 'reason'>>`)
 * drags the inferred element type down with it.
 */
function replaceById<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<NoInfer<T>>,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      patients: seed.patients,
      screenings: seed.screenings,
      referrals: seed.referrals,
      followUps: seed.followUps,
      syncQueue: seed.syncQueue,
      lastSyncAt: seed.lastSyncAt,
      revision: 0,

      /* ── Patients ─────────────────────────────────────────────────────── */

      createPatient: (input) => {
        const patient: Patient = {
          id: createId('pat'),
          mrn: createMrn(get().patients.length + 1),
          name: input.name.trim(),
          sex: input.sex,
          birthDate: input.birthDate,
          phone: input.phone?.trim() || null,
          village: input.village,
          district: input.district,
          province: PROVINCE,
          homeFacilityId: OPERATING_FACILITY_ID,
          riskFactors: input.riskFactors,
          householdContacts: input.householdContacts,
          registeredAt: new Date().toISOString(),
          notes: [],
        };
        set((state) => ({ patients: [patient, ...state.patients] }));
        return patient;
      },

      updatePatient: (id, patch) =>
        set((state) => ({ patients: replaceById(state.patients, id, patch) })),

      addPatientNote: (patientId, body, context = 'general', contextId) =>
        set((state) => ({
          patients: state.patients.map((patient) =>
            patient.id === patientId
              ? {
                  ...patient,
                  notes: [
                    {
                      id: createId('note'),
                      patientId,
                      authorId: currentActorId(),
                      createdAt: new Date().toISOString(),
                      body: body.trim(),
                      context,
                      contextId,
                    },
                    ...patient.notes,
                  ],
                }
              : patient,
          ),
        })),

      /* ── Screenings ───────────────────────────────────────────────────── */

      createScreening: (input) => {
        const screening: Screening = {
          id: createId('scr'),
          patientId: input.patientId,
          facilityId: OPERATING_FACILITY_ID,
          operatorId: currentActorId(),
          performedAt: new Date().toISOString(),
          status: input.asDraft ? 'draft' : 'queued',
          symptoms: input.symptoms,
          vitals: input.vitals,
          imageKey: input.imageKey,
          sampleImage: null,
          imageMeta: input.imageMeta,
          imageQuality: input.imageQuality,
          analysis: null,
          review: null,
          referralId: null,
          sync: input.offline ? (input.asDraft ? 'local-draft' : 'pending') : 'synced',
          createdOffline: input.offline,
        };

        set((state) => ({ screenings: [screening, ...state.screenings] }));

        // Anything captured offline needs to appear in the sync queue.
        if (input.offline) {
          const patient = get().patients.find((p) => p.id === input.patientId);
          get().enqueueSync({
            kind: 'screening',
            entityId: screening.id,
            label: `Screening · ${patient?.mrn ?? input.patientId}`,
            state: input.asDraft ? 'local-draft' : 'pending',
            queuedAt: screening.performedAt,
            lastAttemptAt: null,
            attempts: 0,
            sizeBytes: (input.imageMeta?.sizeBytes ?? 0) + 12 * 1024,
            error: null,
            conflict: null,
          });
        }

        return screening;
      },

      attachAnalysis: (screeningId, analysis) =>
        set((state) => ({
          screenings: state.screenings.map((s) =>
            s.id === screeningId ? { ...s, analysis, status: 'awaiting-review' } : s,
          ),
        })),

      finalizeDraft: (screeningId, patch, offline) => {
        const nextSync: SyncState = offline ? 'pending' : 'synced';
        set((state) => ({
          screenings: state.screenings.map((s) =>
            s.id === screeningId
              ? { ...s, ...patch, status: 'queued', sync: nextSync, createdOffline: offline }
              : s,
          ),
          // Move the existing queue entry along rather than adding a second one.
          // Attempt counters are left alone: completing a draft is not a sync
          // attempt, it is the record becoming eligible for one.
          syncQueue: state.syncQueue.map((item) =>
            item.entityId === screeningId
              ? {
                  ...item,
                  state: nextSync,
                  error: null,
                  sizeBytes: (patch.imageMeta?.sizeBytes ?? 0) + 12 * 1024,
                }
              : item,
          ),
        }));
      },

      submitReview: (screeningId, review) => {
        const reviewerId = currentActorId();
        const reviewedAt = new Date().toISOString();
        set((state) => ({
          screenings: state.screenings.map((s) =>
            s.id === screeningId
              ? {
                  ...s,
                  review: { ...review, reviewerId, reviewedAt },
                  status: review.decision === 'no-action' ? 'closed' : 'reviewed',
                }
              : s,
          ),
        }));

        const screening = get().screenings.find((s) => s.id === screeningId);
        if (screening && review.notes.trim()) {
          get().addPatientNote(screening.patientId, review.notes, 'screening', screeningId);
        }
      },

      updateScreening: (id, patch) =>
        set((state) => ({ screenings: replaceById(state.screenings, id, patch) })),

      deleteScreening: async (id) => {
        const screening = get().screenings.find((s) => s.id === id);
        if (screening?.imageKey) await deleteImage(screening.imageKey);
        set((state) => ({
          screenings: state.screenings.filter((s) => s.id !== id),
          syncQueue: state.syncQueue.filter((item) => item.entityId !== id),
        }));
      },

      /* ── Referrals ────────────────────────────────────────────────────── */

      createReferral: (input) => {
        const actorId = currentActorId();
        const createdAt = new Date().toISOString();
        const referral: Referral = {
          id: createId('ref'),
          code: `REF-${String(get().referrals.length + 1).padStart(4, '0')}`,
          patientId: input.patientId,
          screeningId: input.screeningId,
          fromFacilityId: OPERATING_FACILITY_ID,
          toFacilityId: input.toFacilityId,
          reason: input.reason.trim(),
          requestedService: input.requestedService,
          priority: input.priority,
          status: input.status,
          createdAt,
          appointmentDate: input.appointmentDate,
          assignedWorkerId: input.assignedWorkerId,
          history: [
            {
              id: createId('rev'),
              at: createdAt,
              actorId,
              from: null,
              to: input.status,
              note: 'Referral created.',
            },
          ],
          sync: input.status === 'draft' ? 'local-draft' : 'synced',
        };

        set((state) => ({
          referrals: [referral, ...state.referrals],
          // Keep the originating screening in step with the referral.
          screenings: input.screeningId
            ? state.screenings.map((s) =>
                s.id === input.screeningId
                  ? { ...s, referralId: referral.id, status: 'referred' }
                  : s,
              )
            : state.screenings,
        }));

        return referral;
      },

      updateReferral: (id, patch) =>
        set((state) => ({ referrals: replaceById(state.referrals, id, patch) })),

      setReferralStatus: (id, status, note) => {
        const actorId = currentActorId();
        set((state) => ({
          referrals: state.referrals.map((referral) =>
            referral.id === id
              ? {
                  ...referral,
                  status,
                  history: [
                    ...referral.history,
                    {
                      id: createId('rev'),
                      at: new Date().toISOString(),
                      actorId,
                      from: referral.status,
                      to: status,
                      note: note?.trim() || null,
                    },
                  ],
                }
              : referral,
          ),
        }));
      },

      /* ── Follow-ups ───────────────────────────────────────────────────── */

      createFollowUp: (input) => {
        const followUp: FollowUp = {
          id: createId('fup'),
          code: `FU-${String(get().followUps.length + 1).padStart(4, '0')}`,
          patientId: input.patientId,
          referralId: input.referralId,
          screeningId: input.screeningId,
          reason: input.reason,
          dueDate: input.dueDate,
          status: 'scheduled',
          assignedWorkerId: input.assignedWorkerId,
          createdAt: new Date().toISOString(),
          completedAt: null,
          unresolvedReason: null,
          attempts: [],
          sync: 'synced',
        };
        set((state) => ({ followUps: [...state.followUps, followUp] }));
        return followUp;
      },

      rescheduleFollowUp: (id, dueDate, note) => {
        set((state) => ({
          followUps: state.followUps.map((f) =>
            f.id === id
              ? {
                  ...f,
                  dueDate,
                  status: f.status === 'completed' ? 'scheduled' : f.status,
                  completedAt: null,
                  attempts: note
                    ? [
                        ...f.attempts,
                        {
                          id: createId('att'),
                          at: new Date().toISOString(),
                          actorId: currentActorId(),
                          channel: 'phone' as ContactChannel,
                          outcome: 'rescheduled' as const,
                          note,
                        },
                      ]
                    : f.attempts,
                }
              : f,
          ),
        }));
      },

      logContactAttempt: (id, channel, outcome, note) =>
        set((state) => ({
          followUps: state.followUps.map((f) =>
            f.id === id
              ? {
                  ...f,
                  // Logging an attempt moves a scheduled task into progress.
                  status: f.status === 'scheduled' ? 'in-progress' : f.status,
                  attempts: [
                    ...f.attempts,
                    {
                      id: createId('att'),
                      at: new Date().toISOString(),
                      actorId: currentActorId(),
                      channel,
                      outcome,
                      note: note?.trim() || null,
                    },
                  ],
                }
              : f,
          ),
        })),

      completeFollowUp: (id, note) => {
        const completedAt = new Date().toISOString();
        set((state) => ({
          followUps: state.followUps.map((f) =>
            f.id === id
              ? { ...f, status: 'completed', completedAt, unresolvedReason: null }
              : f,
          ),
        }));
        const followUp = get().followUps.find((f) => f.id === id);
        if (followUp && note?.trim()) {
          get().addPatientNote(followUp.patientId, note, 'followup', id);
        }
      },

      markFollowUpUnresolved: (id, reason) =>
        set((state) => ({
          followUps: state.followUps.map((f) =>
            f.id === id
              ? { ...f, status: 'unresolved', unresolvedReason: reason.trim(), completedAt: null }
              : f,
          ),
        })),

      setFollowUpStatus: (id, status) =>
        set((state) => ({
          followUps: state.followUps.map((f) => (f.id === id ? { ...f, status } : f)),
        })),

      reassignFollowUp: (id, workerId) =>
        set((state) => ({
          followUps: state.followUps.map((f) =>
            f.id === id ? { ...f, assignedWorkerId: workerId } : f,
          ),
        })),

      /* ── Offline sync ─────────────────────────────────────────────────── */

      enqueueSync: (item) =>
        set((state) => ({
          syncQueue: [{ ...item, id: createId('syn') }, ...state.syncQueue],
        })),

      markSyncResult: (itemId, state, error = null) =>
        set((current) => {
          const item = current.syncQueue.find((i) => i.id === itemId);
          const next = current.syncQueue.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  state,
                  error,
                  lastAttemptAt: new Date().toISOString(),
                  attempts: i.attempts + 1,
                }
              : i,
          );

          // Propagate the sync state onto the underlying record so status
          // badges elsewhere in the app stay truthful.
          if (!item) return { syncQueue: next };
          return {
            syncQueue: next,
            screenings:
              item.kind === 'screening'
                ? current.screenings.map((s) =>
                    s.id === item.entityId ? { ...s, sync: state } : s,
                  )
                : current.screenings,
            referrals:
              item.kind === 'referral'
                ? current.referrals.map((r) => (r.id === item.entityId ? { ...r, sync: state } : r))
                : current.referrals,
            followUps:
              item.kind === 'followup'
                ? current.followUps.map((f) => (f.id === item.entityId ? { ...f, sync: state } : f))
                : current.followUps,
          };
        }),

      resolveConflict: (itemId, keep) => {
        const item = useDataStore.getState().syncQueue.find((i) => i.id === itemId);
        if (!item?.conflict) return;

        // Keeping the remote value means our local edit is discarded; keeping
        // local means the record is re-queued to overwrite the remote copy.
        set((state) => ({
          syncQueue: state.syncQueue.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  state: keep === 'remote' ? 'synced' : 'pending',
                  conflict: null,
                  error: null,
                  lastAttemptAt: new Date().toISOString(),
                }
              : i,
          ),
          screenings:
            item.kind === 'screening'
              ? state.screenings.map((s) =>
                  s.id === item.entityId
                    ? {
                        ...s,
                        sync: keep === 'remote' ? 'synced' : 'pending',
                        review:
                          keep === 'remote' && s.review
                            ? { ...s.review, decision: 'refer' }
                            : s.review,
                      }
                    : s,
                )
              : state.screenings,
        }));
      },

      removeSyncItem: (itemId) =>
        set((state) => ({ syncQueue: state.syncQueue.filter((i) => i.id !== itemId) })),

      setLastSyncAt: (value) => set({ lastSyncAt: value }),

      /* ── Demo lifecycle ───────────────────────────────────────────────── */

      resetDemoData: async () => {
        await clearImages();
        const fresh = createSeedDataset();
        set((state) => ({
          patients: fresh.patients,
          screenings: fresh.screenings,
          referrals: fresh.referrals,
          followUps: fresh.followUps,
          syncQueue: fresh.syncQueue,
          lastSyncAt: fresh.lastSyncAt,
          revision: state.revision + 1,
        }));
      },
    }),
    {
      name: 'sentratb.data.v1',
      version: 1,
      partialize: (state) => ({
        patients: state.patients,
        screenings: state.screenings,
        referrals: state.referrals,
        followUps: state.followUps,
        syncQueue: state.syncQueue,
        lastSyncAt: state.lastSyncAt,
      }),
    },
  ),
);
