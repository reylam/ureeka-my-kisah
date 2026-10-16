# PARUPINTAS backend

Express API in front of Supabase (Postgres, Auth, Storage), for one clinic and three kinds of people:

| Who | Account | Does |
| --- | --- | --- |
| **Pasien** | none | Sends a request from the public form and gets an **access code** (voucher). Follows the request with the code until the initial result and queue number are out. |
| **Admin** | `admin` | Saves the patient behind each request (new, or linked to one on file), registers walk-ins, checks a patient's X-ray history, watches the queue and calls patients. |
| **Dokter Sp. Radiologi** | `radiologist` | Takes a request, completes the patient's data, checks the X-ray (the model reads it in the browser), sets the priority and submits it into the queue. |

Staff sign in with Supabase Auth and send the access token to this API, which queries the database **as that user**, so Row Level Security is the enforcement and the Express checks are a second layer with clearer errors. The patient routes run with the service role, kept to one narrow write (the request) and one narrow read (the status).

```
patient ──(form, access code)──▶ /public/* ──(service role, narrow)──▶ Postgres
staff ──(Supabase Auth)──▶ token ──▶ /api/v1 ──(user JWT)──▶ Postgres (RLS)
                                         └──(service role, after an access check)──▶ Storage, model output
```

## A visit

One `screenings` row is one visit, from the request to the queue:

```
waiting ──start_screening()──▶ examining ──submit_screening()──▶ queued ──mark_served()──▶ served
```

- **waiting**: the request exists and has its access code. A request from the public form has no patient yet, only what the person typed (`applicant`); staff save it with `set_screening_patient()` before it can be started.
- **examining**: a radiologist took it (`operator_id`). Only they can record symptoms, vitals, the image and the model output.
- **queued**: submitted with a priority. The day's queue number (`A-001`, `A-002`, …) is taken under a lock, in the clinic's time zone (Asia/Jakarta).
- **served**: the patient has been called.

Every transition is a `SECURITY DEFINER` function that checks the caller, so no client can write a status, a queue number or a code. The access code is eight characters from `A-Z` without `I`/`O` and `2-9`, drawn from the database's cryptographic random source.

## Layout

```
backend/
  server.js                 entry point
  src/
    app.js                  builds the Express app (everything injectable for tests)
    config/                 env parsing (Zod), Supabase clients
    middleware/             auth, role guard, rate limit, validation, errors, CORS/helmet, upload
    routes/  controllers/   thin; one access rule per route
    services/               business logic and queries
    validators/             Zod schemas (strict: unknown keys are rejected)
    utils/                  ApiError, response envelope, pagination
  supabase/
    migrations/             schema, workflow functions, RLS + grants + storage
    seed.sql                DEVELOPMENT data only: staff sign-ins, patients, sample visits
  scripts/provision-user.js create staff accounts / give a role
  tests/                    node:test (see "Tests")
```

## Setup

Requires Node 20+ and either the [Supabase CLI](https://supabase.com/docs/guides/cli) or a hosted project.

```bash
cd backend
npm install
cp .env.example .env        # fill in the three Supabase values

supabase start              # local stack; prints the API URL and keys
supabase db reset           # applies migrations/ then seed.sql

npm run dev                 # http://localhost:4000/api/v1/health
```

Hosted project: `supabase link`, then `supabase db push`. **Do not run `seed.sql` against production.**

**Upgrading a project that had the old migrations:** the migrations were rewritten for this workflow, not appended to. A database that already applied the old files has a different history, so reset it (`supabase db reset` locally, or reset the hosted database) rather than pushing on top.

Without Docker or the CLI: `npm run e2e:setup` once (downloads PostgREST), then `npm run dev:local` runs the real migrations and seed in an in-process Postgres with the real PostgREST and this API. Development only: data lives in memory.

### Environment (`backend/.env`)

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and public anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS. Never in the frontend, never logged. |
| `FRONTEND_ORIGIN` | Comma-separated browser origins allowed by CORS. |
| `TRUST_PROXY` | Turn on behind a proxy, so the public rate limits see the client's address. |
| `INFERENCE_SERVICE_URL` | Optional Python model endpoint. Empty = the model runs in the radiologist's browser instead. |
| `MAX_UPLOAD_MB`, `SIGNED_URL_TTL_SECONDS` | See `.env.example`. |

## Staff accounts

A new auth user gets a profile with **no role** and reaches nothing (a role in the sign-up metadata is ignored). Roles are given from a trusted machine:

```bash
npm run provision -- --email admin@example.org --name "Rina Hartati" --role admin
npm run provision -- --email rad@example.org --name "dr. Hanif, Sp.Rad" --role radiologist
```

A suspended account (`profiles.status = 'suspended'`) matches no policy and is refused by the API.

## API

Prefix `/api/v1`. Success: `{ "success": true, "data": …, "meta"?: { page, pageSize, total, pageCount } }`. Failure: `{ "success": false, "error": { "code", "message", "details"? } }`. Staff auth: `Authorization: Bearer <Supabase access token>`.

| Method & path | Who | Purpose |
| --- | --- | --- |
| `GET /health` | public | Liveness; `modelConnected` |
| `POST /public/requests` | public, 20/hour per address | The request form. Returns `{ code, requestDate, requestedAt }` |
| `POST /public/result` | public, 30/min per address | Status from the code: `status`, masked `name`, `ahead`, and once out `queueNumber`, `priority`, `outcome` |
| `GET /auth/me`, `POST /auth/logout` | staff | Account (`id`, `name`, `email`, `role`) |
| `GET /staff` | staff | Names for "diperiksa oleh" |
| `GET/POST /patients`, `GET/PATCH /patients/:id` | staff | Patient records (`?q=` searches name, MRN, phone) |
| `GET /screenings?status=&patientId=&date=` | staff | Visits; `status` takes a comma list |
| `POST /screenings` | staff | Register a walk-in for a saved patient; returns it with its code |
| `GET /screenings/:id`, `GET /screenings/:id/image` | staff | One visit; a short-lived signed URL for its X-ray |
| `PUT /screenings/:id/patient` | staff | Save which patient a request belongs to (before submit) |
| `DELETE /screenings/:id` | admin | Cancel a request no one has started |
| `POST /screenings/:id/start` | radiologist | Take the request |
| `PATCH /screenings/:id` | radiologist (who took it) | Symptoms, vitals, image quality |
| `POST /screenings/:id/image` | radiologist (who took it) | JPEG/PNG, checked by content, to private storage |
| `POST /screenings/:id/analysis` | radiologist (who took it) | Store what the browser model reported (probabilities + grounded boxes) |
| `POST /screenings/:id/analyze` | radiologist (who took it) | Run the server model; `503 MODEL_NOT_CONNECTED` without one |
| `POST /screenings/:id/submit` | radiologist (who took it) | Priority `high`/`medium`/`low`; allocates the queue number |
| `GET /queue?date=` | staff | `items` (to be called, most urgent first) and `served` |
| `POST /screenings/:id/served` | staff | The patient has been called |

## The screening model

It runs in the radiologist's browser (`frontend/src/services/localModel.ts`, ONNX Runtime Web), which reports the three class probabilities and the areas it leaned on, found by occlusion and each grounded to a class. The server checks the probabilities form a distribution and the boxes lie inside the image, then works out everything derived (leading class, outcome, risk point, zone names) itself. Alternatively, set `INFERENCE_SERVICE_URL` to the Python service in `../inference`; its reply is validated and mapped by `services/inferenceService.js`, and a malformed reply is rejected, not repaired. No result or performance figure is ever generated server-side, and the seed contains no model output.

## Tests

```bash
npm test
```

- `queue.test.js`: the real migrations in an in-process Postgres (PGlite); the whole visit, RLS, column grants and every workflow function, as `anon`, staff and role-less users.
- `e2e/flow.test.js`: the real API over HTTP against the real PostgREST: request form → code → save patient → examine → upload → model output → submit → queue → called, plus the API's own refusals and a check that every route is exercised. Needs `npm run e2e:setup` once; skipped without it.
- `units.test.js`: config, model-reply mapping, image-size reading, helpers.

**Not verified here** (needs a real Supabase project): GoTrue sign-in and bans, Storage itself (the e2e stack uses an in-memory stand-in), and `supabase db reset` on the real CLI.
