# Sample accounts

Sign-in credentials for the current frontend build. These are sample accounts
for a build with no real data behind it, so the passwords are listed openly
here. They are never stored in plain text: the account store digests them at
load (`src/lib/password.ts`), and real hashing moves to the server when the API
lands (`docs/api-contract.md`).

Browsing the public side needs no account at all: the home page, the
"How it works" explainer, the screening demo and the facility directory are all
open.

| Role | Email | Password | What they can do |
| --- | --- | --- | --- |
| Patient | `patient@pulmo.test` | `Patient123!` | Own screening history, follow-up schedule, health profile and the learning centre |
| Healthcare professional | `doctor@pulmo.test` | `Doctor123!` | Assigned patients, the review queue, referrals and follow-ups |
| Healthcare professional (CHW) | `chw@pulmo.test` | `Worker123!` | Field worker without review sign-off, to show how `canReview` differs within the role |
| Administrator | `admin@pulmo.test` | `Admin123!` | Accounts, roles, the facility directory, record metadata and the audit log |

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
selector, and the store's `register` has no role argument to pass one to.
Healthcare professional and administrator accounts are created by promoting an
existing account from the administrator's **Accounts** screen, which records
the change in the audit log.

## Source of truth

The accounts are seeded in `src/data/accounts.ts`. The matching
`SAMPLE_CREDENTIALS` export is what the sign-in screen used to list inline; it
now backs this document instead.
