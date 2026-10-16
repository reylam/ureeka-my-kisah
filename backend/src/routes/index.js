import { Router } from 'express';
import * as controllers from '../controllers/index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { imageUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import * as v from '../validators/schemas.js';
import { ok } from '../utils/response.js';

/**
 * Route table for /api/v1.
 *
 * Each route lists, in order: authentication, role, input validation,
 * handler. Reading a route top to bottom is reading its access rule. The
 * database enforces the same rules again through RLS and its functions.
 *
 * Two kinds of caller. Staff (administrator, radiologist) sign in. Patients
 * do not: they send a request from the public form and follow it with the
 * access code it returns.
 */

const id = { params: v.idParam };
const staff = [requireAuth(), requireRole('admin', 'radiologist')];
const radiologist = [requireAuth(), requireRole('radiologist')];
const adminOnly = [requireAuth(), requireRole('admin')];

export function buildRouter({ config, inference }) {
  const router = Router();
  const s = controllers.screenings({ config, inference });

  /* ── Public ───────────────────────────────────────────────────────────── */

  router.get('/health', (_req, res) =>
    ok(res, {
      status: 'ok',
      service: 'parupintas-api',
      time: new Date().toISOString(),
      // Whether the model step is wired on the server, so the frontend does not guess.
      modelConnected: inference.configured,
    }),
  );

  // The request form. Returns the access code (voucher).
  router.post(
    '/public/requests',
    rateLimit({ windowMs: 60 * 60_000, max: 20, message: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.' }),
    validate({ body: v.publicRequestBody }),
    controllers.publicRoutes.request,
  );

  // Status of a request, from its access code. POST so the code stays out of
  // URLs, logs and browser history.
  router.post(
    '/public/result',
    rateLimit({ windowMs: 60_000, max: 30, message: 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' }),
    validate({ body: v.publicResultBody }),
    controllers.publicRoutes.result,
  );

  /* ── Session ──────────────────────────────────────────────────────────── */

  router.get('/auth/me', requireAuth(), controllers.auth.me);
  router.post('/auth/logout', requireAuth(), controllers.auth.logout);
  router.get('/staff', ...staff, controllers.staff.list);

  /* ── Patients ─────────────────────────────────────────────────────────── */

  router.get('/patients', ...staff, validate({ query: v.patientListQuery }), controllers.patients.list);
  router.post('/patients', ...staff, validate({ body: v.patientCreateBody }), controllers.patients.create);
  router.get('/patients/:id', ...staff, validate(id), controllers.patients.get);
  router.patch('/patients/:id', ...staff, validate({ ...id, body: v.patientUpdateBody }), controllers.patients.update);

  /* ── Screenings ───────────────────────────────────────────────────────── */

  router.get('/screenings', ...staff, validate({ query: v.screeningListQuery }), s.list);
  router.post('/screenings', ...staff, validate({ body: v.requestCreateBody }), s.createRequest);
  router.get('/screenings/:id', ...staff, validate(id), s.get);
  router.get('/screenings/:id/image', ...staff, validate(id), s.imageUrl);
  router.put('/screenings/:id/patient', ...staff, validate({ ...id, body: v.setPatientBody }), s.setPatient);
  router.delete('/screenings/:id', ...adminOnly, validate(id), s.cancel);

  // The radiologist's examination.
  router.post('/screenings/:id/start', ...radiologist, validate(id), s.start);
  router.patch('/screenings/:id', ...radiologist, validate({ ...id, body: v.examinationBody }), s.saveExamination);
  router.post(
    '/screenings/:id/image',
    ...radiologist,
    validate(id),
    imageUpload(config.storage.maxUploadBytes),
    validate({ body: v.imageMetaFields }),
    s.uploadImage,
  );
  router.post('/screenings/:id/analyze', ...radiologist, validate(id), s.analyze);
  // The model can also run in the radiologist's browser; this stores what it reported.
  router.post('/screenings/:id/analysis', ...radiologist, validate({ ...id, body: v.browserAnalysisBody }), s.recordAnalysis);
  router.post('/screenings/:id/submit', ...radiologist, validate({ ...id, body: v.submitBody }), s.submit);

  /* ── Queue ────────────────────────────────────────────────────────────── */

  router.get('/queue', ...staff, validate({ query: v.queueQuery }), controllers.queue.today);
  router.post('/screenings/:id/served', ...staff, validate(id), s.markServed);

  return router;
}
