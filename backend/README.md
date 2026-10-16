# PARUPINTAS backend

Express API in front of Supabase (Postgres, Auth, Storage). The browser signs in with Supabase Auth and sends its access token to this API; the API queries the database **as that user**, so Row Level Security is the enforcement and the Express checks are a second layer with clearer errors.

```
browser ──(Supabase JS: sign in / sign up)──▶ Supabase Auth
   │
   └──(Bearer access token)──▶ Express /api/v1 ──(user JWT)──▶ Postgres (RLS)
                                   │
                                   └──(service role, narrow uses only)──▶ Storage, audit log, model output
```

## Layout

```
backend/
  server.js                 entry point
  src/
    app.js                  builds the Express app (everything injectable for tests)
    config/                 env parsing (Zod), Supabase clients
    middleware/             auth, role guards, validation, errors, CORS/helmet, upload
    routes/  controllers/   thin; one access rule per route
    services/               all business logic and queries
    validators/             Zod schemas (strict: unknown keys are rejected)
    utils/                  ApiError, response envelope, pagination
  supabase/
    migrations/             schema, functions/triggers, RLS + grants, storage, dashboard
    seed.sql                DEVELOPMENT data only: base data + sample records (2-3+ rows per table, no model output)
    config.toml             local Supabase CLI settings
  scripts/provision-user.js create / promote privileged accounts
  tests/                    node:test (see "Tests")
```

## Setup

Requires Node 20+ and the [Supabase CLI](https://supabase.com/docs/guides/cli) (which needs Docker for the local stack; a hosted project works without it).

```bash
cd backend
npm install
cp .env.example .env        # fill in the three Supabase values

# Local stack (from backend/, so the CLI finds supabase/):
supabase start              # prints the API URL and keys
supabase db reset           # applies migrations/ then seed.sql

npm run dev                 # http://localhost:4000/api/v1/health
```

Hosted project: link it (`supabase link`), then `supabase db push` to apply `supabase/migrations/`. **Do not run `seed.sql` against production.**

### Environment (`backend/.env`)

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and public anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS. Never in the frontend, never logged. |
| `FRONTEND_ORIGIN` | Comma-separated browser origins allowed by CORS. |
| `INFERENCE_SERVICE_URL` | Optional URL of the Python model endpoint. Empty = model not connected. |
| `MAX_UPLOAD_MB`, `SIGNED_URL_TTL_SECONDS`, `TRUST_PROXY` | See `.env.example`. |

## Roles and how they are assigned

- **Visitor**: no account; may read published facilities only.
- **Patient**: the *only* role self-registration can produce. A database trigger (`handle_new_user`) creates every profile as `patient` and ignores any `role` in the sign-up metadata. Roles cannot be changed by a user: `profiles.role`/`status` are not writable columns for clients.
- **Professional / Administrator**: assigned by an administrator in the app (`PATCH /accounts/:id/role`, which also needs a staff record) or from a trusted machine:

```bash
npm run provision -- --email admin@example.org --name "Rina Hartati" --role admin
npm run provision -- --email doc@example.org --name "dr. Hanif" --role professional \
    --clinical-role physician --facility <facility-uuid> --can-review
```

Rules enforced in SQL (`admin_set_account_role`, `admin_set_account_status`): administrators only; never on yourself; the last active administrator cannot be demoted or suspended; every change is audited. A suspended account matches no policy and is rejected by the API.

"Assigned" means a professional whose staff record's facility equals the patient's home facility. Administrators are deliberately **not** clinical: they get account/facility management and screening *metadata*, and are refused clinical reports, reviews, referrals, follow-ups, notes and radiographs.

## API

Prefix `/api/v1`. Success: `{ "success": true, "data": …, "meta"?: { page, pageSize, total, pageCount } }`. Failure: `{ "success": false, "error": { "code", "message", "details"? } }` (422 `details` is keyed by field; params/query keys are prefixed `params.`/`query.`). Auth: `Authorization: Bearer <Supabase access token>`.

| Method & path | Who | Purpose |
| --- | --- | --- |
| `GET /health` | public | Liveness; `modelConnected` |
| `GET /facilities?published&q&type&service` | public (admins may see unpublished) | Facility directory |
| `POST /facilities`, `PATCH /facilities/:id`, `PATCH /facilities/:id/published`, `DELETE /facilities/:id` | admin | Create (always unpublished), edit (resets to *needs-review*), publish, delete |
| `GET /auth/me`, `POST /auth/logout` | any signed in | Account (role, status, staff link, onboarding) |
| `GET /accounts`, `GET /accounts/:id` | admin | Directory (no onboarding answers) |
| `PATCH /accounts/:id/role`, `PATCH /accounts/:id/status` | admin | Role / suspension (SQL-enforced rules) |
| `PUT/DELETE /accounts/:id/staff-profile` | admin | Staff record (clinical role, facility, `canReview`) |
| `GET/PATCH /me/onboarding/{personal,address,health}`, `POST /me/onboarding/{complete,reopen}`, `PATCH /me/consent/health` | patient | Onboarding & consent (withdrawing clears the answers) |
| `GET /me/patient`, `/me/screenings[/:id]`, `/me/followups`, `/me/referrals` | patient | Own records only; screenings carry state + the clinician's review, nothing clinical |
| `GET /me/learning`, `PUT/DELETE /me/learning/:articleId` | signed in | Reading progress |
| `GET /staff` | signed in | Staff directory (patients see only staff on their own records, no contacts) |
| `GET/POST /patients`, `GET/PATCH /patients/:id`, `POST /patients/:id/notes` | professional (admin: list/get/create/update) | Patient records; opening one is audited |
| `PATCH /patients/:id/home-facility` | admin | Places a patient at a facility (decides who is assigned) |
| `GET/POST /screenings`, `GET/PATCH/DELETE /screenings/:id` | professional (admin: list/get metadata only) | Create, finish a draft, delete a draft |
| `POST /screenings/:id/image` | professional (operator) | Upload JPEG/PNG (checked by content) to private storage |
| `GET /screenings/:id/image` | professional only | Short-lived signed URL; audited first, **admins refused** |
| `POST /screenings/:id/analyze` | professional | Run the model; `503 MODEL_NOT_CONNECTED` when not wired |
| `POST /screenings/:id/review` | professional with `canReview` | Sign off (admins and CHWs refused) |
| `GET/POST /referrals`, `GET/PATCH /referrals/:id`, `PATCH /referrals/:id/status` | professional | Referrals + history events |
| `GET/POST /followups`, `GET /followups/:id`, `PATCH …/schedule`, `POST …/{attempts,complete,unresolved}`, `PATCH …/assignee` | professional | Follow-ups |
| `GET /dashboard/summary?days` | professional | Figures computed in the database over the caller's visible records |
| `GET /audit?action&q&page&pageSize` | admin | Append-only audit log |

Three statuses are kept apart on a screening: workflow `status`, `modelStatus` (`not-run | pending | completed | failed | unavailable`), and the clinician's `review`.

## Database

Tables: `profiles`, `healthcare_facilities`, `healthcare_professional_profiles`, `patient_profiles`, `patient_onboarding`, `patient_notes`, `screenings` (workflow metadata), `screening_reports` (symptoms, vitals, image path, model output; never readable by admins), `screening_reviews`, `referrals`, `referral_events`, `follow_up_records`, `follow_up_attempts`, `educational_progress`, `audit_logs`. Educational *articles* remain a static frontend module (the API contract lists content management as not yet designed).

Notable choices: screening status moves only through triggers (a draft can only become `queued` by its operator); referral status changes go through `set_referral_status` (writes the history event); `audit_logs` rejects update/delete/truncate even for trusted contexts; the radiograph bucket is private with no storage policy for clients, so images are reachable only via signed URLs the API issues after an access check.

## The screening model

Not bundled. Set `INFERENCE_SERVICE_URL` to an endpoint that accepts multipart `image` and replies like `train/tb-train/tb_ai/infer.py`'s `predict()` (`prediction`, `probabilities`, `model`, `detection.boxes[].box_xyxy`). The reply is validated and mapped (`services/inferenceService.js`); a malformed reply is rejected, not repaired. Without it, analysis answers 503, the report is marked `unavailable`, and records go to a clinician without model output. No result, probability or performance figure is ever generated server-side.

## Tests

```bash
npm test
```

- `rls.test.js`, `seed.test.js`: run the real migrations and seed in an in-process Postgres (PGlite) and exercise policies, column grants, triggers and functions as `anon` / `authenticated` users.
- `api.test.js`: the real Express app over a fake Supabase gateway: authentication, role guards, validation, error mapping, uploads, signed URLs, audit-before-read, model-not-connected.
- `units.test.js`: config, model-reply mapping, image-size reading, helpers.

**Not verified here** (needs a real Supabase project): PostgREST query behaviour for the embedded selects, GoTrue sign-up/sign-in/ban, Storage upload/signed URLs, `supabase db reset` on the real CLI, and any live model. PGlite proves the SQL and RLS; it is not Supabase.
