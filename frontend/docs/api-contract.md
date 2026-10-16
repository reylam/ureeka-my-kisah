# PARUPINTAS API contract

What the frontend expects when you connect a backend. Written against the
frontend as it stands, so every endpoint here corresponds to something the
interface already does against local state.

## Implementation status

This contract has now been implemented by `backend/` (see `backend/README.md`
for the full route table). Where the implementation differs from the sketch
below, the backend is the source of truth:

- **Sign-up, sign-in and sign-out are Supabase Auth**, called from the browser
  (`src/stores/authStore.ts`). There is no `POST /auth/register` or
  `/auth/login` on the API. The API accepts the Supabase access token and
  `GET /auth/me` returns the account. The "patient only" rule is enforced by a
  database trigger that ignores any client-supplied role.
- **Responses** use `{ success, data, meta? }` / `{ success: false, error }`.
- **Facility publication** is `PATCH /facilities/:id/published`, as drafted.
- **Staff link** became `PUT/DELETE /accounts/:id/staff-profile`, because the
  staff record is now a table (`healthcare_professional_profiles`) rather than
  a static module.
- **Inference** stays a separate service: `POST /screenings/:id/analyze` calls
  it when `INFERENCE_SERVICE_URL` is set and answers `503 MODEL_NOT_CONNECTED`
  otherwise. Nothing is simulated server-side.
- **Still not designed:** password reset, email verification flow beyond
  Supabase's own, professional invitations, messaging, reminders, and
  educational content management (only reading progress is stored).

The sections below are the original reasoning and are kept for context.

## The thing to read first

Everything in the current build runs in the browser. The account directory,
the session and the permission checks all live in `localStorage` and in
zustand stores beside it. That means:

- **No check in `src/lib/permissions.ts` is enforcement.** It decides what the
  interface offers. Anyone can open devtools, set `role: "admin"` on their own
  account row, and the UI will show them the administration screens.
- **`src/lib/password.ts` is not password hashing.** It keeps plain text out of
  storage. Delete the file when the API lands; the client should stop seeing
  passwords at all.
- **The audit log is advisory.** A log the client writes can be avoided by not
  running the client.

So every permission in the matrix below has to be re-checked server-side, from
the session, on every request. The frontend sending the right thing is not
evidence that the right thing was asked for.

## Roles

Three stored roles plus the unauthenticated case.

| Role | Stored | Notes |
| --- | --- | --- |
| Visitor | no | Absence of a session, not a row |
| `patient` | yes | The only role self-registration can produce |
| `professional` | yes | Links to a staff record that carries `canReview` |
| `admin` | yes | Administrative, deliberately **not** clinical |

`admin` does not hold `screening:review`. Administrative access is not clinical
competence, and the server should reject a review submitted by an admin even
though no UI offers it.

## Authentication

```
POST /auth/register
  body   { name, email, password }
  200    { account, session }
  409    email already registered
  422    validation errors, keyed by field
```

The role is **not** a parameter. The server assigns `patient`
unconditionally. A `role` field in the payload must be ignored, not honoured,
and ideally rejected so a bug surfaces loudly.

```
POST /auth/login
  body   { email, password }
  200    { account, session }
  401    bad credentials, or suspended
```

Return one message for both "no such address" and "wrong password". Telling an
unauthenticated caller which half failed hands them address enumeration. The
frontend already does this in `authStore.signIn`.

```
POST /auth/logout        204
GET  /auth/me            200 { account } | 401
```

Password hashing: bcrypt or argon2id, server-side, never the digest in
`lib/password.ts`.

## Accounts

```
GET    /accounts?role=&q=&page=        admin only
GET    /accounts/:id                   admin, or self
PATCH  /accounts/:id/role              admin only   { role }
PATCH  /accounts/:id/status            admin only   { status }
PATCH  /accounts/:id/staff-link        admin only   { staffUserId | null }
```

Server-side rules the frontend also applies, and which must not live only in
the frontend:

- An admin cannot change their own role or suspend themselves.
- The last active admin cannot be demoted or suspended.
- No endpoint ever returns `passwordHash` or `passwordSalt`.

## Patient onboarding

```
GET   /me/onboarding                   200 { onboarding }
PATCH /me/onboarding/personal          { fullName, birthDate, phone, sex }
PATCH /me/onboarding/address           { province, district, village, addressLine }
PATCH /me/onboarding/health            { symptoms[], symptomWeeks, priorTb, notes, shared }
POST  /me/onboarding/complete          { dataUse, healthInfo }
```

Saved per step, because the wizard resumes. `dataUse` is required;
`healthInfo` is separate and optional. Withdrawing health consent must
**clear the answers**, not just flip the flag: a consent switch that leaves the
data in place is a preference, not consent. See `PatientProfilePage`.

## Patient records

```
GET /me/screenings                     own records only
GET /me/screenings/:id
GET /me/followups
GET /me/referrals
```

Scoped by the session's `patientId` on the server. `usePatientRecords` filters
client-side today; that filter is a convenience, not the boundary.

## Clinical

```
GET   /patients?q=                     professional, scoped to assignment
GET   /patients/:id                    professional assigned to that patient
POST  /screenings                      professional
POST  /screenings/:id/review           professional AND staff canReview
GET   /screenings/:id/image            professional assigned; admin must be refused
POST  /referrals                       professional
PATCH /referrals/:id/status            professional
POST  /followups                       professional
```

`GET /screenings/:id/image` is the one to be most careful with. An
administrator has `screening:read:all` for metadata and must still be refused
the image and the clinical assessment.

## Facilities

```
GET    /facilities?published=true      public
GET    /facilities                     admin, includes unpublished
POST   /facilities                     admin, created unpublished
PATCH  /facilities/:id                 admin, resets infoStatus to needs-review
PATCH  /facilities/:id/published       admin
```

New entries are created unpublished on purpose: patients use this directory to
decide where to go for a test, so an unchecked entry should not appear the
moment a form is saved.

Coordinates and travel estimates are not in the create form. They need a real
geocoding lookup, and a hand-typed latitude is how a directory ends up pointing
at open water. `facilityStore.fromDraft` currently inherits a default position.

## Inference

The screening model is not connected. `src/services/screeningService.ts` holds
the response shape, mirrored from the Python project's `infer.py`:

```
POST /inference/screen
  body   multipart image
  200    {
           probabilities: { Healthy: number, "Sick-non-TB": number, TB: number },
           predicted_label: "Healthy" | "Sick-non-TB" | "TB",
           regions: [{ box: [x, y, w, h], score, zone }],
           model: { name, version, backbone }
         }
```

Connecting it means replacing one transport function. Two things must happen at
the same time:

1. `SIMULATED_RESULT_NOTICE` in `src/data/model.ts` is removed, and
   `ScreeningAnalysis.simulated` stops being hard-coded `true`.
2. `ModelDescriptor.validation` is filled from a real evaluation, or left null.
   It must not be populated with figures nobody measured.

Until then the interface states, next to every analysis output, that the model
is not connected. That line is load-bearing: without it the product shows an
invented TB classification as a real one.

## Audit

```
GET  /audit?action=&q=&page=           admin only
```

Server-side the log should be append-only and should also record **reads** of
patient records, which the client-side version cannot do usefully.

## Not yet designed

Deliberately absent, because the frontend does not do them yet and inventing
an endpoint for a screen that does not exist is how contracts rot:

- Password reset and email verification
- Professional invitation flow (accounts are promoted by an admin today)
- Patient-to-professional messaging
- Reminder scheduling and delivery
- Educational content management (articles are a static module)
