import * as accountService from '../services/accountService.js';
import * as patientService from '../services/patientService.js';
import * as publicService from '../services/publicResultService.js';
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
const admin = (req) => req.app.locals.supabase.admin;

export const publicRoutes = {
  request: async (req, res) => created(res, await publicService.request(admin(req), req.valid.body)),
  result: async (req, res) => ok(res, await publicService.lookup(admin(req), req.valid.body.code)),
};

export const auth = {
  me: async (req, res) => ok(res, { account: accountService.me(ctx(req)) }),
  logout: async (req, res) => {
    await accountService.signOut(ctx(req));
    return noContent(res);
  },
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
  update: async (req, res) => ok(res, await patientService.update(ctx(req), req.valid.params.id, req.valid.body)),
};

export function screenings({ config, inference }) {
  const storage = { bucket: config.storage.bucket };
  const id = (req) => req.valid.params.id;
  return {
    list: async (req, res) => {
      const { items, meta } = await screeningService.list(ctx(req), req.valid.query);
      return ok(res, items, meta);
    },
    get: async (req, res) => ok(res, await screeningService.get(ctx(req), id(req))),
    createRequest: async (req, res) => created(res, await screeningService.createRequest(ctx(req), req.valid.body)),
    setPatient: async (req, res) =>
      ok(res, await screeningService.setPatient(ctx(req), id(req), req.valid.body.patientId)),
    cancel: async (req, res) => {
      await screeningService.cancel(ctx(req), id(req));
      return noContent(res);
    },
    start: async (req, res) => ok(res, await screeningService.start(ctx(req), id(req))),
    saveExamination: async (req, res) =>
      ok(res, await screeningService.saveExamination(ctx(req), id(req), req.valid.body)),
    uploadImage: async (req, res) =>
      ok(res, await screeningService.uploadImage(ctx(req), id(req), req.file, req.valid.body ?? {}, storage)),
    imageUrl: async (req, res) =>
      ok(
        res,
        await screeningService.signedImageUrl(ctx(req), id(req), {
          ...storage,
          ttlSeconds: config.storage.signedUrlTtlSeconds,
        }),
      ),
    analyze: async (req, res) => ok(res, await screeningService.analyze(ctx(req), id(req), { ...storage, inference })),
    recordAnalysis: async (req, res) =>
      ok(res, await screeningService.recordBrowserAnalysis(ctx(req), id(req), req.valid.body)),
    submit: async (req, res) => ok(res, await screeningService.submit(ctx(req), id(req), req.valid.body)),
    markServed: async (req, res) => ok(res, await screeningService.markServed(ctx(req), id(req))),
  };
}

export const queue = {
  today: async (req, res) => ok(res, await screeningService.queue(ctx(req), req.valid.query)),
};
