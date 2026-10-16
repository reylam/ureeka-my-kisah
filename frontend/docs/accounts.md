# Sample accounts and access codes

For a **local development** database only. They exist after `backend/supabase/seed.sql` has run
(`supabase db reset`, or `npm run dev:local` in `backend/`). The passwords are listed openly because
there is no real data behind them. Do not seed them into any shared or production project.

## Staff

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Admin | `admin@parupintas.test` | `Admin123!` | `/requests` |
| Dokter Sp. Radiologi | `radiolog@parupintas.test` | `Radiolog123!` | `/requests` |
| Dokter Sp. Radiologi | `radiolog2@parupintas.test` | `Radiolog123!` | `/requests` |

`/app` sends any signed-in account to its home. New staff accounts are created with
`npm run provision` in `backend/`; an account created any other way has no role and reaches nothing.

## Patients

Patients have no account. They send the form on `/daftar` and get an access code. The sample visits
in the seed carry fixed codes, so `/hasil` can be tried straight away:

| Code | State |
| --- | --- |
| `BARU-2345`, `BARU-3456` | Waiting, sent from the public form, not yet saved as a patient |
| `DAFT-2345` | Waiting, registered at the desk |
| `PRKS-2345` | Being examined by `radiolog@parupintas.test` |
| `ANTR-2345` | In the queue, priority high |
| `ANTR-3456` | In the queue, priority low |
| `SLSE-2345` | Already called |

The sample visits have no X-ray and no model output: an image cannot be seeded from SQL, and a made-up
model result would be fabricated clinical output.
