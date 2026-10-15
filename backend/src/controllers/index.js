import * as accountService from '../services/accountService.js';
import * as auditService from '../services/auditService.js';
import * as educationService from '../services/educationService.js';
import * as facilityService from '../services/facilityService.js';
import * as followUpService from '../services/followUpService.js';
import * as onboardingService from '../services/onboardingService.js';
import * as patientService from '../services/patientService.js';
import * as referralService from '../services/referralService.js';
import * as screeningService from '../services/screeningService.js';
import * as staffService from '../services/staffService.js';
import { created, noContent, ok } from '../utils/response.js';

/**
 * Controllers stay thin on purpose: read validated input off `req.valid`, call
 * one service function with the session (`req.auth`), shape the response.
 * Express 5 forwards a rejected promise to the error handler, so there is no
 * try/catch here.
 */

const ctx = (req) => req.auth;

export const auth = {
  me: async (req, res) => ok(res, { account: await accountService.me(ctx(req)) }),
  logout: async (req, res) => {
    await accountService.signOut(ctx(req));
    return noContent(res);
  },
};

export const accounts = {
  list: async (req, res) => {
    const { items, meta } = await accountService.list(ctx(req), req.valid.query);
    return ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await accountService.get(ctx(req), req.valid.params.id)),
  setRole: async (req, res) =>
    ok(res, await accountService.setRole(ctx(req), req.valid.params.id, req.valid.body.role)),
  setStatus: async (req, res) =>
    ok(res, await accountService.setStatus(ctx(req), req.valid.params.id, req.valid.body.status)),
  upsertStaff: async (req, res) =>
    ok(res, await accountService.upsertStaffProfile(ctx(req), req.valid.params.id, req.valid.body)),
  removeStaff: async (req, res) =>
    ok(res, await accountService.removeStaffProfile(ctx(req), req.valid.params.id)),
};

export const me = {
  onboarding: async (req, res) => ok(res, { onboarding: await onboardingService.get(ctx(req)) }),
  savePersonal: async (req, res) =>
    ok(res, { onboarding: await onboardingService.savePersonal(ctx(req), req.valid.body) }),
  saveAddress: async (req, res) =>
    ok(res, { onboarding: await onboardingService.saveAddress(ctx(req), req.valid.body) }),
  saveHealth: async (req, res) =>
    ok(res, { onboarding: await onboardingService.saveHealth(ctx(req), req.valid.body) }),
  completeOnboarding: async (req, res) =>
    ok(res, {
      onboarding: await onboardingService.complete(ctx(req), req.valid.body),
      account: await accountService.me(ctx(req)),
    }),
  reopenOnboarding: async (req, res) =>
    ok(res, { onboarding: await onboardingService.reopen(ctx(req), req.valid.body.step) }),
  setHealthConsent: async (req, res) =>
    ok(res, { onboarding: await onboardingService.setHealthConsent(ctx(req), req.valid.body.healthInfo) }),

  patient: async (req, res) => ok(res, await patientService.getOwn(ctx(req))),
  screenings: async (req, res) => ok(res, await screeningService.listOwn(ctx(req))),
  screening: async (req, res) => ok(res, await screeningService.getOwn(ctx(req), req.valid.params.id)),
  followUps: async (req, res) => ok(res, await followUpService.listOwn(ctx(req))),
  referrals: async (req, res) => ok(res, await referralService.listOwn(ctx(req))),

  learning: async (req, res) => ok(res, { read: await educationService.listRead(ctx(req)) }),
  markRead: async (req, res) =>
    ok(res, { read: await educationService.markRead(ctx(req), req.valid.params.articleId) }),
  markUnread: async (req, res) =>
    ok(res, { read: await educationService.markUnread(ctx(req), req.valid.params.articleId) }),
};

export const staff = {
  list: async (req, res) => ok(res, await staffService.list(ctx(req))),
};

export const patients = {
  list: async (req, res) => {
    const { items, meta } = await patientService.list(ctx(req), req.valid.query);
    return ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await patientService.get(ctx(req), req.valid.params.id)),
  create: async (req, res) => created(res, await patientService.create(ctx(req), req.valid.body)),
  update: async (req, res) =>
    ok(res, await patientService.update(ctx(req), req.valid.params.id, req.valid.body)),
  setHomeFacility: async (req, res) =>
    ok(res, await patientService.setHomeFacility(ctx(req), req.valid.params.id, req.valid.body.homeFacilityId)),
  addNote: async (req, res) =>
    created(res, await patientService.addNote(ctx(req), req.valid.params.id, req.valid.body)),
};

export function screenings({ config, inference }) {
  const storage = { bucket: config.storage.bucket };
  return {
    list: async (req, res) => {
      const { items, meta } = await screeningService.list(ctx(req), req.valid.query);
      return ok(res, items, meta);
    },
    get: async (req, res) => ok(res, await screeningService.get(ctx(req), req.valid.params.id)),
    create: async (req, res) => created(res, await screeningService.create(ctx(req), req.valid.body)),
    finalize: async (req, res) =>
      ok(res, await screeningService.finalize(ctx(req), req.valid.params.id, req.valid.body)),
    remove: async (req, res) => {
      await screeningService.removeDraft(ctx(req), req.valid.params.id, storage);
      return noContent(res);
    },
    uploadImage: async (req, res) =>
      ok(res, await screeningService.uploadImage(ctx(req), req.valid.params.id, req.file, req.valid.body ?? {}, storage)),
    imageUrl: async (req, res) =>
      ok(
        res,
        await screeningService.signedImageUrl(ctx(req), req.valid.params.id, {
          ...storage,
          ttlSeconds: config.storage.signedUrlTtlSeconds,
        }),
      ),
    analyze: async (req, res) =>
      ok(res, await screeningService.analyze(ctx(req), req.valid.params.id, { ...storage, inference })),
    review: async (req, res) =>
      created(res, await screeningService.review(ctx(req), req.valid.params.id, req.valid.body)),
  };
}

export const referrals = {
  list: async (req, res) => {
    const { items, meta } = await referralService.list(ctx(req), req.valid.query);
    return ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await referralService.get(ctx(req), req.valid.params.id)),
  create: async (req, res) => created(res, await referralService.create(ctx(req), req.valid.body)),
  update: async (req, res) =>
    ok(res, await referralService.update(ctx(req), req.valid.params.id, req.valid.body)),
  setStatus: async (req, res) =>
    ok(res, await referralService.setStatus(ctx(req), req.valid.params.id, req.valid.body)),
};

export const followUps = {
  list: async (req, res) => {
    const { items, meta } = await followUpService.list(ctx(req), req.valid.query);
    return ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await followUpService.get(ctx(req), req.valid.params.id)),
  create: async (req, res) => created(res, await followUpService.create(ctx(req), req.valid.body)),
  reschedule: async (req, res) =>
    ok(res, await followUpService.reschedule(ctx(req), req.valid.params.id, req.valid.body)),
  logAttempt: async (req, res) =>
    ok(res, await followUpService.logAttempt(ctx(req), req.valid.params.id, req.valid.body)),
  complete: async (req, res) =>
    ok(res, await followUpService.complete(ctx(req), req.valid.params.id, req.valid.body)),
  markUnresolved: async (req, res) =>
    ok(res, await followUpService.markUnresolved(ctx(req), req.valid.params.id, req.valid.body)),
  reassign: async (req, res) =>
    ok(res, await followUpService.reassign(ctx(req), req.valid.params.id, req.valid.body)),
};

export const facilities = {
  list: async (req, res) => {
    const session = req.auth;
    // Anonymous visitors use the anon client; signed-in callers use their own.
    const client = session ? session.db : req.app.locals.supabase.anon;
    const isAdmin = session?.role === 'admin';
    return ok(res, await facilityService.list(client, req.valid.query, { isAdmin }));
  },
  create: async (req, res) => created(res, await facilityService.create(ctx(req), req.valid.body)),
  update: async (req, res) =>
    ok(res, await facilityService.update(ctx(req), req.valid.params.id, req.valid.body)),
  setPublished: async (req, res) =>
    ok(res, await facilityService.setPublished(ctx(req), req.valid.params.id, req.valid.body.published)),
  remove: async (req, res) => {
    await facilityService.remove(ctx(req), req.valid.params.id);
    return noContent(res);
  },
};

export const audit = {
  list: async (req, res) => {
    const { items, meta } = await auditService.list(ctx(req), req.valid.query);
    return ok(res, items, meta);
  },
};
