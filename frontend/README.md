# Sentra TB · Screening & Healthcare Access

Frontend prototype for preliminary tuberculosis screening from chest X-rays, aimed at community
health teams working in remote areas with unreliable connectivity.

> **Screening, not diagnosis.** This is demonstration software. It is not a medical device, it has
> not been validated, and it must not be used for clinical decisions. Every patient, facility,
> contact detail and result in it is synthetic.

---

## What this build is

A complete, interactive frontend covering the whole screening pathway: record an encounter, route
the output to a clinician, refer the patient to a facility that can test them, and track whether
they got there. There is no backend, no database server and no trained model in this phase.

**Implemented**

- Public overview page at `/`, readable without signing in
- Simulated sign-in and sign-out
- Dashboard whose every figure is derived from the local dataset
- Patient directory with search, status filters, sorting and pagination
- Patient record with a merged timeline, screenings, referrals, follow-ups and notes
- Multi-step screening form with local chest X-ray upload, preview and validation
- Screening result screen with a dark radiograph viewer and an overlay toggle
- Explainable report with a side-by-side comparison and a print layout
- Facility directory with list and schematic map views
- Referral register with the full status lifecycle and history
- Follow-up tracker with overdue, due-today, upcoming, completed and unresolved queues
- Offline queue with drafts, retries, conflict review and a demo synchronisation action
- Settings, including storage usage and a demo data reset

**Deliberately not included**

- **No trained model.** Screening output comes from a built-in simulator, labelled as such on
  every surface that displays it. See [Connecting a real model](#connecting-a-real-model).
- **No backend, database or auth server.** Sign-in is a local string comparison, not a security
  boundary.
- **No real patient data.** The dataset is generated. Sample radiographs are drawn in SVG rather
  than taken from a patient dataset, and are watermarked `SYNTHETIC SAMPLE`.
- **No verified facility information.** Distances, opening hours, phone numbers and services are
  illustrative.
- **No notifications.** Nothing is sent to any patient, facility or external service.
- **No performance figures.** Nothing here has been evaluated, so no accuracy, sensitivity or
  specificity numbers appear anywhere.
- No Docker, and no container-based workflow.

---

## Running it

Requires Node.js 20 or newer (built against Node 26).

```bash
npm install
npm run dev
```

The dev server prints a local URL, by default <http://localhost:5173>.

| Script            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Vite dev server with hot reload              |
| `npm run build`   | Type-check with `tsc -b`, then build to `dist/` |
| `npm run preview` | Serve the production build locally           |
| `npm run typecheck` | Type-check only                            |

### Signing in

`/` is public. Select **Sign in** to enter the application; the form arrives pre-filled, so no
credentials need to be looked up. Clearing the fields exercises the form's own validation.

Roles differ in one way that matters: only a nurse or physician can sign off a clinical review. Use
**Act as a different role** in the profile menu or in Settings to switch between a community health
worker and a reviewing clinician.

---

## Resetting demo data

Records you create or edit are persisted in the browser, so they survive a reload. To get back to
the seeded dataset:

**Settings → Reset demo data**

That rebuilds the original patients, screenings, referrals and follow-ups, deletes every uploaded
radiograph from IndexedDB, and drops the cached application shell.

Settings also offers **Clear stored radiographs** on its own, which removes the images but keeps the
screening records.

To wipe everything manually, clear site data for the origin in your browser's developer tools. The
relevant keys are `sentratb.data.v1` and `sentratb.auth.v1` in localStorage, plus the `keyval-store`
IndexedDB database.

---

## Where data lives

| Data                            | Stored in            | Why                                                     |
| ------------------------------- | -------------------- | ------------------------------------------------------- |
| Patients, screenings, referrals, follow-ups, sync queue | localStorage (`sentratb.data.v1`) | Small JSON, needs to survive a reload |
| Uploaded chest radiographs      | IndexedDB            | Blobs are large; localStorage is synchronous and capped  |
| Session flag                    | localStorage (`sentratb.auth.v1`) | Nothing else to keep                       |
| Application shell (HTML, JS, CSS, icons) | Service worker cache | Lets the app open with no connection           |

Radiographs are kept out of localStorage and out of the service-worker cache on purpose. The service
worker only caches shell assets and refuses anything else.

**Browser storage is not equivalent to a secured backend.** Anyone with access to this device
profile can read these records.

### Offline behaviour

Four separate things, kept distinct throughout the UI:

1. **Offline form entry** works with no connection.
2. **Local persistence** writes records to this browser's storage on this device.
3. **Synchronisation** in this prototype only moves records between local states. Nothing is
   transmitted, because there is no server.
4. **Model inference** is not performed on the device and needs a connection, so queued records
   wait.

Use **Simulate being offline** (connection indicator in the top bar, the Offline Queue page, or
Settings) to demonstrate the offline path without disconnecting anything. Pulling the real network
works too: the app is a PWA with a cached shell.

---

## Project structure

```
src/
├── components/
│   ├── dashboard/      activity chart, metric tiles
│   ├── facilities/     schematic facility map
│   ├── followups/      scheduling and contact-attempt dialogs
│   ├── forms/          field wrapper, inputs, stepper
│   ├── layout/         app shell, sidebar, top bar, mobile nav
│   ├── patients/       timeline builder and renderer
│   ├── referrals/      referral form and status controls
│   ├── screening/      X-ray viewer, upload, review form, sample radiographs
│   └── ui/             buttons, badges, cards, tables, dialogs, toasts
├── data/               seeded dataset and static reference data
├── hooks/              query, table controls, image resolution
├── pages/              one file per route
├── routes/             route table and auth guard
├── services/           mock API, screening simulator, sync, image store
├── stores/             Zustand stores and derived selectors
├── types/              domain model and the inference wire contract
└── utils/              dates, formatting, labels, class names
```

### Data layer

One dataset, built once in `data/seed.ts`, with real referential integrity: every screening points
at a patient that exists, every referral at a real screening and facility, every follow-up at a real
referral. A fixed PRNG seed makes it identical on every load, and all dates are generated relative
to today, so "overdue" and "upcoming" are always genuinely correct.

### Service layer

`services/mockApi.ts` is the boundary where a real backend would attach. Every method is async and
returns plain data, so each can become a `fetch` call without touching a component. The current
"transport" is the local store plus a short delay, which is what lets the UI show real loading
states. No endpoint URLs are invented.

---

## Connecting a real model

`services/screeningService.ts` is the only seam. `requestAnalysis()` returns an `InferenceResponse`,
which mirrors — field for field — the JSON emitted by the sibling Python project in `../train/tb-train`:

```json
{
  "image": "...",
  "prediction": "TB",
  "probabilities": { "Healthy": 0.02, "Sick-non-TB": 0.11, "TB": 0.87 },
  "model": { "classifier": "...", "backbone": "densenet121" },
  "disclaimer": "...",
  "detection": { "n_lesions": 2, "boxes": [{ "box_xyxy": [x1, y1, x2, y2], "score": 0.81 }] }
}
```

To go live:

1. Set `INFERENCE_ENDPOINT` in `src/types/inference.ts`.
2. POST the image blob to it inside `requestAnalysis()` and delete the simulator branch.
3. Remove the `simulated: true` flag and the notices keyed off it.

The three class labels (`Healthy`, `Sick-non-TB`, `TB`) and the lesion-box shape are already modelled
in `types/domain.ts`, and the report already renders boxes as a toggleable overlay. No component or
store needs to change.

### What the simulator actually does

It does **not** look at the image. No model runs in the browser and no image leaves the device. It
produces a deterministic result from data the health worker already typed in: symptom duration,
red-flag symptoms and the declared image-quality rating. That exists purely so the downstream
workflow (review, referral, follow-up, report) can be demonstrated end to end. The derivation is
stated in the UI wherever output is shown.

---

## Design notes

Visual identity is obsidian black with a calm CT-scan blue accent. Black carries the brand, the
sidebar and the primary actions; CT blue is reserved for active navigation, focus rings, links and
radiology visualisations. Content surfaces stay light and readable. The radiograph viewer is the one
deliberately dark area, because a chest X-ray is unreadable against white.

Clinical and operational status is never communicated by colour alone: every status badge renders an
icon and a text label as well, so meaning survives greyscale printing and colour-vision deficiency.
"No screening alert" is deliberately not green, because an absent alert is not a clean bill of
health.

Accessibility: semantic HTML, a single consistent focus treatment, keyboard-navigable tabs, dialogs
with focus trapping and restoration, a skip link, `aria-live` toasts, and reduced-motion support
that also disables the mock service layer's artificial delays. Full WCAG conformance would require
manual testing with assistive technology and an expert review, which has not been done here.

---

## Known limitations

- The schematic facility map is a relative-position plot, not a navigable map. No mapping provider
  is connected.
- Sync conflict resolution models the decision a real sync would force; both versions are local.
- Review permissions are enforced in the UI only, which is appropriate for a prototype and would
  not be sufficient in a real deployment.
