import { Router } from 'express';
import * as controllers from '../controllers/index.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { requireCanReview, requireRole, requireStaffRecord } from '../middleware/authorize.js';
import { imageUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import * as v from '../validators/schemas.js';
import { ok } from '../utils/response.js';

/**
 * Route table for /api/v1.
 *
 * Each route lists, in order: authentication, role, staff-record requirement,
 * input validation, handler. Reading a route top to bottom is reading its
 * access rule. The database enforces the same rules again through RLS.
 */

const id = { params: v.idParam };
const clinical = [requireAuth(), requireRole('professional'), requireStaffRecord()];
const staffOnly = [requireAuth(), requireRole('professional', 'admin')];
const adminOnly = [requireAuth(), requireRole('admin')];
const patientOnly = [requireAuth(), requireRole('patient')];

export function buildRouter({ config, inference }) {
  const router = Router();
  const screeningsController = controllers.screenings({ config, inference });

  /* ── Public ───────────────────────────────────────────────────────────── */

  router.get('/health', (_req, res) =>
    ok(res, {
      status: 'ok',
      service: 'pulmo-api',
      time: new Date().toISOString(),
      // Whether the model step is wired. Reporting it here keeps the frontend
      // from guessing.
      modelConnected: inference.configured,
    }),
  );

  router.get(
    '/facilities',
    optionalAuth(),
    validate({ query: v.facilityListQuery }),
    controllers.facilities.list,
  );

  /* ── Session ──────────────────────────────────────────────────────────── */

  router.get('/auth/me', requireAuth(), controllers.auth.me);
  router.post('/auth/logout', requireAuth(), controllers.auth.logout);

  /* ── Accounts (administrators) ────────────────────────────────────────── */

  router.get('/accounts', ...adminOnly, validate({ query: v.accountListQuery }), controllers.accounts.list);
  router.get('/accounts/:id', ...adminOnly, validate(id), controllers.accounts.get);
  router.patch('/accounts/:id/role', ...adminOnly, validate({ ...id, body: v.setRoleBody }), controllers.accounts.setRole);
  router.patch('/accounts/:id/status', ...adminOnly, validate({ ...id, body: v.setStatusBody }), controllers.accounts.setStatus);
  router.put('/accounts/:id/staff-profile', ...adminOnly, validate({ ...id, body: v.staffProfileBody }), controllers.accounts.upsertStaff);
  router.delete('/accounts/:id/staff-profile', ...adminOnly, validate(id), controllers.accounts.removeStaff);

  /* ── The signed-in person ─────────────────────────────────────────────── */

  router.get('/me/onboarding', ...patientOnly, controllers.me.onboarding);
  router.patch('/me/onboarding/personal', ...patientOnly, validate({ body: v.onboardingPersonalBody }), controllers.me.savePersonal);
  router.patch('/me/onboarding/address', ...patientOnly, validate({ body: v.onboardingAddressBody }), controllers.me.saveAddress);
  router.patch('/me/onboarding/health', ...patientOnly, validate({ body: v.onboardingHealthBody }), controllers.me.saveHealth);
  router.post('/me/onboarding/complete', ...patientOnly, validate({ body: v.onboardingCompleteBody }), controllers.me.completeOnboarding);
  router.post('/me/onboarding/reopen', ...patientOnly, validate({ body: v.onboardingReopenBody }), controllers.me.reopenOnboarding);
  router.patch('/me/consent/health', ...patientOnly, validate({ body: v.healthConsentBody }), controllers.me.setHealthConsent);

  router.get('/me/patient', ...patientOnly, controllers.me.patient);
  router.get('/me/screenings', ...patientOnly, controllers.me.screenings);
  router.get('/me/screenings/:id', ...patientOnly, validate(id), controllers.me.screening);
  router.get('/me/followups', ...patientOnly, controllers.me.followUps);
  router.get('/me/referrals', ...patientOnly, controllers.me.referrals);

  router.get('/me/learning', requireAuth(), controllers.me.learning);
  router.put('/me/learning/:articleId', requireAuth(), validate({ params: v.articleParam }), controllers.me.markRead);
  router.delete('/me/learning/:articleId', requireAuth(), validate({ params: v.articleParam }), controllers.me.markUnread);

  /* ── Staff directory ──────────────────────────────────────────────────── */

  router.get('/staff', requireAuth(), controllers.staff.list);

  /* ── Patients ─────────────────────────────────────────────────────────── */

  router.get('/patients', ...staffOnly, validate({ query: v.patientListQuery }), controllers.patients.list);
  router.post('/patients', ...staffOnly, validate({ body: v.patientCreateBody }), controllers.patients.create);
  router.get('/patients/:id', ...staffOnly, validate(id), controllers.patients.get);
  router.patch('/patients/:id', ...staffOnly, validate({ ...id, body: v.patientUpdateBody }), controllers.patients.update);
  router.patch('/patients/:id/home-facility', ...adminOnly, validate({ ...id, body: v.patientFacilityBody }), controllers.patients.setHomeFacility);
  router.post('/patients/:id/notes', ...clinical, validate({ ...id, body: v.noteBody }), controllers.patients.addNote);

  /* ── Screenings ───────────────────────────────────────────────────────── */

  // Administrators may list record metadata; the service returns only that for them.
  router.get('/screenings', ...staffOnly, validate({ query: v.screeningListQuery }), screeningsController.list);
  router.post('/screenings', ...clinical, validate({ body: v.screeningCreateBody }), screeningsController.create);
  router.get('/screenings/:id', ...staffOnly, validate(id), screeningsController.get);
  router.patch('/screenings/:id', ...clinical, validate({ ...id, body: v.screeningFinalizeBody }), screeningsController.finalize);
  router.delete('/screenings/:id', ...clinical, validate(id), screeningsController.remove);

  router.post(
    '/screenings/:id/image',
    ...clinical,
    validate({ params: v.idParam }),
    imageUpload(config.storage.maxUploadBytes),
    validate({ body: v.imageMetaFields }),
    screeningsController.uploadImage,
  );
  // Professionals only. An administrator is refused here, by design.
  router.get('/screenings/:id/image', ...clinical, validate(id), screeningsController.imageUrl);
  router.post('/screenings/:id/analyze', ...clinical, validate(id), screeningsController.analyze);
  router.post(
    '/screenings/:id/review',
    ...clinical,
    requireCanReview(),
    validate({ ...id, body: v.reviewBody }),
    screeningsController.review,
  );

  /* ── Referrals ────────────────────────────────────────────────────────── */

  router.get('/referrals', ...clinical, validate({ query: v.referralListQuery }), controllers.referrals.list);
  router.post('/referrals', ...clinical, validate({ body: v.referralCreateBody }), controllers.referrals.create);
  router.get('/referrals/:id', ...clinical, validate(id), controllers.referrals.get);
  router.patch('/referrals/:id', ...clinical, validate({ ...id, body: v.referralUpdateBody }), controllers.referrals.update);
  router.patch('/referrals/:id/status', ...clinical, validate({ ...id, body: v.referralStatusBody }), controllers.referrals.setStatus);

  /* ── Follow-ups ───────────────────────────────────────────────────────── */

  router.get('/followups', ...clinical, validate({ query: v.followUpListQuery }), controllers.followUps.list);
  router.post('/followups', ...clinical, validate({ body: v.followUpCreateBody }), controllers.followUps.create);
  router.get('/followups/:id', ...clinical, validate(id), controllers.followUps.get);
  router.patch('/followups/:id/schedule', ...clinical, validate({ ...id, body: v.followUpRescheduleBody }), controllers.followUps.reschedule);
  router.post('/followups/:id/attempts', ...clinical, validate({ ...id, body: v.followUpAttemptBody }), controllers.followUps.logAttempt);
  router.post('/followups/:id/complete', ...clinical, validate({ ...id, body: v.followUpCompleteBody }), controllers.followUps.complete);
  router.post('/followups/:id/unresolved', ...clinical, validate({ ...id, body: v.followUpUnresolvedBody }), controllers.followUps.markUnresolved);
  router.patch('/followups/:id/assignee', ...clinical, validate({ ...id, body: v.followUpAssigneeBody }), controllers.followUps.reassign);

  /* ── Facilities (administrators write) ────────────────────────────────── */

  router.post('/facilities', ...adminOnly, validate({ body: v.facilityDraftBody }), controllers.facilities.create);
  router.patch('/facilities/:id', ...adminOnly, validate({ ...id, body: v.facilityDraftBody }), controllers.facilities.update);
  router.patch('/facilities/:id/published', ...adminOnly, validate({ ...id, body: v.facilityPublishBody }), controllers.facilities.setPublished);
  router.delete('/facilities/:id', ...adminOnly, validate(id), controllers.facilities.remove);

  /* ── Dashboard (health professionals) ─────────────────────────────────── */

  router.get('/dashboard/summary', ...clinical, validate({ query: v.dashboardQuery }), controllers.dashboard.summary);

  /* ── Audit ────────────────────────────────────────────────────────────── */

  router.get('/audit', ...adminOnly, validate({ query: v.auditListQuery }), controllers.audit.list);

  return router;
}
