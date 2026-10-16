# Sample accounts

Sign-in credentials for a **local development** database. They exist only after
`supabase db reset` has run `backend/supabase/seed.sql`, they are sample
accounts for a database with no real data behind it, and the passwords are
listed openly here for that reason. Passwords are hashed by Supabase Auth; the
frontend never stores or digests one. Do not seed them into any shared or
production project.

Browsing the public side needs no account at all: the home page, the
"How it works" explainer and the screening demo are open.

| Role | Email | Password | What they can do |
| --- | --- | --- | --- |
| Patient | `patient@pulmo.test` | `Patient123!` | Own screening history, follow-up schedule, health profile and the learning centre |
| Healthcare professional | `doctor@pulmo.test` | `Doctor123!` | Assigned patients, the review queue, referrals and follow-ups |
| Healthcare professional (CHW) | `chw@pulmo.test` | `Worker123!` | Field worker without review sign-off, to show how `canReview` differs within the role |
| Administrator | `admin@pulmo.test` | `Admin123!` | Accounts, roles, the facility directory, record metadata and the audit log |

The second half of `seed.sql` (sample records) adds three more sign-ins, plus
screenings, reviews, referrals, follow-ups and notes for the sample patients. It
never contains model output or X-ray images.

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Healthcare professional (nurse) | `nurse@pulmo.test` | `Nurse123!` | At RSUD Lembor Tengah, so sees only that facility's patient; shows facility scoping |
| Patient | `patient2@pulmo.test` | `Patient123!` | Onboarded, placed at RSUD Lembor Tengah, has read three articles |
| Patient | `newpatient@pulmo.test` | `Patient123!` | Stopped after the first onboarding step; resumes the wizard on sign-in |

## Where each role lands

| Role | Home route |
| --- | --- |
| Patient | `/me` (via `/onboarding` until profile completion is done) |
| Healthcare professional | `/dashboard` |
| Administrator | `/admin` |

`/app` redirects any signed-in account to the home above, resolved from the
role, so one link serves everyone.

## Registering

Anyone who signs up through `/register` becomes a patient. There is no role
selector, and `register` has no role argument to pass one to; the database
assigns `patient` to every new sign-up and ignores anything the browser sends.
Healthcare professional and administrator accounts are created by promoting an
existing account from the administrator's **Accounts** screen (which records the
change in the audit log) or with `npm run provision` in `backend/`. A promoted
professional also needs a staff record (clinical role, facility, review rights);
until one exists they have no assigned patients.

## Source of truth

The accounts are defined in `backend/supabase/seed.sql`. Role and status live in
the `profiles` table and are changed only through database functions that
administrators can call (or by the provisioning script).
