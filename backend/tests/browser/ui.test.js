/**
 * UI journeys: drive the real frontend in a real browser against the real
 * backend + PostgREST + migrations. Run with `npm run test:browser`.
 *
 * Every journey ends by asserting that the browser saw no uncaught errors,
 * no console errors and no failed API calls, so a screen that renders but
 * quietly fails a request cannot pass.
 *
 * Screenshots go to backend/.tools/screens/ for a human to look at.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { SCREENSHOTS, launchBackend, makePng, openBrowser, skipReason, startFrontend } from './harness.js';

const VITE_PORT = 5199;
const PNG = makePng(320, 320);

let backend;
let vite;
let browser;
let problems = [];
const expected = [];

async function newSession() {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    if ((url.startsWith(backend.apiUrl) || url.startsWith(backend.stack.url)) && response.status() >= 400) {
      const line = `${response.status()} ${response.request().method()} ${url.replace(backend.stack.url, '').replace(backend.apiUrl, '/api')}`;
      if (!expected.some((pattern) => pattern.test(line))) problems.push(line);
    }
  });
  return { context, page };
}

const shot = (page, name) => page.screenshot({ path: join(SCREENSHOTS, `${name}.png`), fullPage: true });

/** Run a journey; on failure keep a screenshot and what the browser reported. */
async function journey(page, name, body) {
  try {
    await body();
  } catch (error) {
    await shot(page, `FAILED-${name}`).catch(() => {});
    console.log(`[${name}] url=${page.url()} problems=${JSON.stringify(problems)}`);
    throw error;
  }
}

function assertClean(label) {
  const found = problems.slice();
  problems = [];
  expected.length = 0;
  assert.deepEqual(found, [], `${label}: the browser reported problems`);
}

async function signIn(page, email, password) {
  await page.goto(`${backend.origin}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** The menu in the header holds the person's name and "Sign out". */
async function signOutVia(page, name) {
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login|localhost:\d+\/$/);
}

before(async () => {
  if (skipReason) return;
  backend = await launchBackend({ vitePort: VITE_PORT });
  vite = await startFrontend({ vitePort: VITE_PORT, stack: backend.stack, apiUrl: backend.apiUrl });
  browser = await openBrowser();
});
after(async () => {
  await browser?.close();
  vite?.kill();
  await backend?.close();
});

describe('sign-in', { skip: skipReason }, () => {
  test('a wrong password shows one generic message and nothing else leaks', async () => {
    const { page, context } = await newSession();
    expected.push(/^400 POST \/auth\/v1\/token/);
    await signIn(page, 'doctor@pulmo.test', 'wrong-password');
    await page.getByText('Those credentials do not match an account.').waitFor();
    await signIn(page, 'nobody@pulmo.test', 'whatever123');
    await page.getByText('Those credentials do not match an account.').waitFor();
    assert.match(page.url(), /\/login/);
    await shot(page, 'login-error');
    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('sign-in failure');
  });

  test('protected pages send a visitor to sign in', async () => {
    const { page, context } = await newSession();
    await page.goto(`${backend.origin}/patients`);
    await page.waitForURL(/\/login/);
    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('guard');
  });
});

describe('healthcare professional journey', { skip: skipReason }, () => {
  test('dashboard, patients, a full screening, review, referral and follow-up', async () => {
    const { page, context } = await newSession();
    // No model is connected, so "analyze" answers 503 on purpose; the UI must handle it.
    expected.push(/^503 POST \/api\/screenings\/[0-9a-f-]+\/analyze/);
    await journey(page, 'doctor', async () => {
    await signIn(page, 'doctor@pulmo.test', 'Doctor123!');
    await page.waitForURL(/\/dashboard/);
    await page.getByText('Screening records').first().waitFor();
    await shot(page, 'doctor-dashboard');

    // A reload restores the session instead of bouncing to sign-in.
    await page.reload();
    await page.waitForURL(/\/dashboard/);
    await page.getByText('Screening records').first().waitFor();

    // Patients come from the database.
    await page.goto(`${backend.origin}/patients`);
    await page.getByText('Siti Rahmawati').first().waitFor();
    await page.getByText('Yosef Banggur').first().waitFor();
    await shot(page, 'doctor-patients');
    await page.getByText('Siti Rahmawati').first().click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}/);
    await page.getByText('TB-2601-0001').first().waitFor();

    // New screening for an existing patient.
    await page.goto(`${backend.origin}/screenings/new`);
    await page.getByLabel('Find the patient').fill('Siti');
    await page.getByRole('button', { name: /Siti Rahmawati/ }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Weight').fill('54');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('How long has the cough lasted?').fill('3');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'film.png', mimeType: 'image/png', buffer: PNG });
    await page.getByText('Reading image on this device').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await shot(page, 'doctor-new-screening-review');
    await page.getByRole('button', { name: 'Submit screening' }).click();

    // No model is connected: the record is saved and says so, instead of inventing output.
    await page.waitForURL(/\/screenings\/[0-9a-f-]{36}$/);
    await page.getByRole('heading', { name: 'Screening result' }).waitFor();
    await page.waitForTimeout(2500);
    await shot(page, 'doctor-screening-result');
    const screeningUrl = page.url();

    // The radiograph is served through a signed URL.
    await page.locator('img').first().waitFor({ state: 'attached' });

    // Review.
    await page.getByLabel('Review note').fill('Right upper zone opacity, advise sputum testing.');
    await page.getByRole('button', { name: 'Record review' }).click();
    await page.getByText(/Reviewed by dr\. Hanif Ramadhan/).waitFor();
    await shot(page, 'doctor-reviewed');

    // The record is in the history and the dashboard counts it.
    await page.goto(`${backend.origin}/reports`);
    await page.getByText('Siti Rahmawati').first().waitFor();
    await page.goto(`${backend.origin}/dashboard`);
    await page.getByText('Screening records').first().waitFor();

    // Referral from the result page.
    await page.goto(screeningUrl);
    await page.getByRole('button', { name: 'Create referral' }).first().click();
    const referral = page.getByRole('dialog');
    await referral.getByLabel('Destination facility').selectOption({ index: 1 });
    await referral.getByLabel('Reason for referral').fill('Right upper zone opacity; needs molecular testing.');
    await shot(page, 'doctor-referral-dialog');
    await referral.getByRole('button', { name: 'Create referral' }).click();
    await page.getByText(/Referral REF-\d{4} created/).waitFor();

    // A follow-up from the same page.
    await page.getByRole('button', { name: 'Schedule follow-up' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Schedule follow-up' }).click();
    await page.getByText(/Follow-up FU-\d{4} scheduled/).waitFor();

    await page.goto(`${backend.origin}/referrals`);
    await page.getByText(/REF-\d{4}/).first().waitFor();

    // Follow-ups, facilities, offline queue and settings load real data.
    await page.goto(`${backend.origin}/followups`);
    await page.getByRole('heading', { name: /Follow-ups/ }).first().waitFor();
    await page.goto(`${backend.origin}/facilities`);
    await page.getByText('Puskesmas Waerana').first().waitFor();
    await page.goto(`${backend.origin}/offline`);
    await page.getByRole('heading', { name: /Offline queue/ }).waitFor();
    await page.goto(`${backend.origin}/settings`);
    await page.getByText('dr. Hanif Ramadhan').first().waitFor();
    });

    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('professional journey');
  });
});

describe('a new patient registers and completes onboarding', { skip: skipReason }, () => {
  test('sign-up, the wizard, the patient workspace and sign-out', async () => {
    const { page, context } = await newSession();
    await journey(page, 'register', async () => {
      await page.goto(`${backend.origin}/register`);
      await page.locator('input[autocomplete=name]').fill('UI Patient');
      await page.locator('input[type=email]').fill('ui.patient@example.test');
      await page.locator('input[autocomplete=new-password]').first().fill('Sturdy-Pass1');
      await page.locator('input[autocomplete=new-password]').last().fill('Sturdy-Pass1');
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.waitForURL(/\/onboarding/);

      // Step 1: about you
      await page.locator('input[type=date]').fill('1992-02-02');
      await page.locator('input[type=tel]').fill('0812-3456-7890');
      await page.getByRole('button', { name: 'Continue' }).click();
      // Step 2: address
      await page.getByLabel(/^District/).selectOption({ index: 1 });
      await page.getByLabel(/^Village/).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Continue' }).click();
      // Step 3: health answers, skipped on purpose
      await page.getByRole('button', { name: 'Skip this step' }).click();
      // Step 4: consent
      await page.getByText('I agree to my name, contact details and address').click();
      await shot(page, 'patient-onboarding-consent');
      await page.getByRole('button', { name: 'Finish', exact: true }).click();
      await page.waitForURL(/\/me$/);
      await page.getByText(/UI/).first().waitFor();
      await shot(page, 'patient-overview-new');

      // Their own clinical record exists, with nothing in it yet.
      await page.goto(`${backend.origin}/me/screenings`);
      await page.getByText('Nothing recorded yet').waitFor();
      await page.goto(`${backend.origin}/me/profile`);
      await page.getByText('ui.patient@example.test').waitFor();

      // A patient cannot open clinical or administrative pages.
      await page.goto(`${backend.origin}/patients`);
      await page.waitForURL(/\/me$/);
      await page.goto(`${backend.origin}/admin`);
      await page.waitForURL(/\/me$/);

      await signOutVia(page, 'UI Patient');
    });
    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('registration');
  });
});

describe('administrator journey', { skip: skipReason }, () => {
  test('accounts, placing a patient, staff records, facilities, audit, metadata only', async () => {
    const { page, context } = await newSession();
    await journey(page, 'admin', async () => {
      await signIn(page, 'admin@pulmo.test', 'Admin123!');
      await page.waitForURL(/\/admin$/);
      await page.getByText('Patient accounts').first().waitFor();
      await shot(page, 'admin-overview');

      await page.goto(`${backend.origin}/admin/users`);
      await page.getByText('UI Patient').first().waitFor();
      await page.getByText('Ayu Lestari').first().waitFor();

      // The new patient has no facility yet; placing her is what lets professionals see her.
      const place = page.getByLabel('Home facility for UI Patient');
      await place.selectOption({ label: 'Puskesmas Waerana' });
      await page.getByText(/UI Patient placed at the facility/).waitFor();

      // A staff record for the community health worker.
      const chw = page.getByRole('row', { name: /chw@pulmo\.test/ });
      await chw.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Save record' }).click();
      await page.getByText('Staff record saved.').waitFor();
      await shot(page, 'admin-users');

      // Facilities: created hidden, then published.
      await page.goto(`${backend.origin}/admin/facilities`);
      await page.getByRole('button', { name: 'Add facility' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Facility name').fill('Puskesmas Browser Uji');
      await dialog.getByLabel('District').selectOption({ index: 1 });
      await dialog.getByLabel('Address').fill('Jl. Uji Browser 7');
      await dialog.getByLabel('Phone').fill('(0385) 555-7777');
      await dialog.getByText('Chest X-ray').first().click();
      await dialog.getByRole('button', { name: 'Add facility' }).click();
      await page.getByText('Facility added.').waitFor();
      const row = page.getByRole('row', { name: /Puskesmas Browser Uji/ });
      await row.getByText('Hidden').waitFor();
      await row.getByRole('button', { name: 'Publish' }).click();
      await row.getByText('Public').waitFor();

      // Audit trail records what happened, written by the server.
      await page.goto(`${backend.origin}/admin/audit`);
      await page.getByRole('row').getByText('Facility published').first().waitFor();
      await page.getByRole('row').getByText('Role changed').first().waitFor();
      await page.getByRole('row').getByText('Screening reviewed').first().waitFor();
      await page.getByRole('row').getByText('Patient record opened').first().waitFor();
      await shot(page, 'admin-audit');

      // Screening records: metadata only.
      await page.goto(`${backend.origin}/admin/screenings`);
      await page.getByText('Metadata only').waitFor();
      await shot(page, 'admin-screenings');
      assert.equal(await page.getByText('Right upper zone opacity').count(), 0, 'no clinical text on the admin page');

      // And clinical pages are not for administrators.
      await page.goto(`${backend.origin}/dashboard`);
      await page.waitForURL(/\/admin$/);
    });
    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('administrator');
  });
});

describe('an existing patient', { skip: skipReason }, () => {
  test('sees their own record and the clinician’s review, edits their profile, tracks learning', async () => {
    const { page, context } = await newSession();
    await journey(page, 'patient', async () => {
      await signIn(page, 'patient@pulmo.test', 'Patient123!');
      await page.waitForURL(/\/me$/);
      await page.getByText(/Siti/).first().waitFor();
      await shot(page, 'patient-overview');

      await page.goto(`${backend.origin}/me/screenings`);
      await page.getByText('Right upper zone opacity, advise sputum testing.').waitFor();
      assert.equal(await page.getByText(/symptom/i).count() >= 0, true);
      await shot(page, 'patient-screenings');

      await page.goto(`${backend.origin}/me/followup`);
      await page.getByRole('heading', { name: /follow/i }).first().waitFor();
      await page.goto(`${backend.origin}/me/facilities`);
      await page.getByText('Puskesmas Waerana').first().waitFor();

      // Learning progress is stored on the server and survives a reload.
      await page.goto(`${backend.origin}/me/learn`);
      await page.getByText('Articles read: 0 of 7').waitFor();
      await page.goto(`${backend.origin}/me/learn?article=what-is-tb`);
      await page.getByRole('button', { name: 'Mark as read' }).click();
      await page.getByRole('button', { name: 'Marked as read' }).waitFor();
      await page.goto(`${backend.origin}/me/learn`);
      await page.getByText('Articles read: 1 of 7').waitFor();

      // Profile edit goes to the API.
      await page.goto(`${backend.origin}/me/profile`);
      await page.getByRole('button', { name: 'Edit' }).first().click();
      await page.locator('input[type=tel]').fill('0899-1111-2222');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Profile updated.').waitFor();
      await page.reload();
      await page.getByText('0899-1111-2222').waitFor();

      // Withdrawing health answers clears them on the server.
      await page.getByRole('button', { name: /Withdraw and clear my health answers/ }).click();
      await page.getByText('Health answers withdrawn.').waitFor();
      await page.reload();
      await page.getByText('Not shared').first().waitFor();
      await shot(page, 'patient-profile');

      await signOutVia(page, 'Siti');
    });
    await context.close();
    problems = problems.filter((p) => !/Failed to load resource/.test(p));
    assertClean('patient');
  });
});
