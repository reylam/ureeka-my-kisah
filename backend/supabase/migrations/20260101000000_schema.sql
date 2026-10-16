-- PARUPINTAS schema: one clinic, three kinds of people.
--
--   Pasien       has no account. Fills in a request form and gets an access code
--                (voucher). With the code they follow their request until the
--                initial result and queue number are out.
--   Admin        saves patient data, checks a patient's X-ray history, watches
--                the queue and its priorities.
--   Radiolog     checks the X-ray while completing the patient's data, sets the
--                priority and submits the screening into the queue.
--
-- One screening row is one visit, from the request to the queue:
--
--   waiting    the request is in, the access code exists, no one has started
--   examining  a radiologist has taken it and is working on it
--   queued     submitted: priority and queue number are set, the result is out
--   served     the patient has been called from the queue
--
-- Row Level Security is switched on in 20260101000200_policies.sql.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Staff accounts ──────────────────────────────────────────────────────────

-- One row per auth.users row, created by a trigger with no role. An account
-- without a role reaches nothing; roles are given by scripts/provision-user.js.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text check (role in ('admin', 'radiologist')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Patients ────────────────────────────────────────────────────────────────

create sequence public.patient_mrn_seq;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique
    default ('RM-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.patient_mrn_seq')::text, 4, '0')),
  name text not null check (char_length(name) between 2 and 200),
  sex text not null check (sex in ('male', 'female')),
  birth_date date not null,
  phone text check (phone is null or char_length(phone) <= 40),
  address text not null default '' check (char_length(address) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_name_idx on public.patients (lower(name));

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- ── Screenings ──────────────────────────────────────────────────────────────

create table public.screenings (
  id uuid primary key default gen_random_uuid(),

  -- The request. A request from the public form has no patient yet, only what
  -- the person typed (`applicant`); staff save it as a patient, or link it to
  -- an existing one, before the X-ray is checked.
  patient_id uuid references public.patients (id) on delete cascade,
  applicant jsonb,
  complaint text not null default '' check (char_length(complaint) <= 1000),
  -- Eight characters from a 32-symbol alphabet with no look-alikes (no I, O,
  -- 0 or 1), drawn by new_access_code(). The patient's only credential.
  access_code text not null unique check (access_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  request_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  requested_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,

  status text not null default 'waiting'
    check (status in ('waiting', 'examining', 'queued', 'served')),

  -- The examination.
  operator_id uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  symptoms jsonb not null default '{}'::jsonb,
  vitals jsonb not null default '{}'::jsonb,
  image_quality text not null default 'adequate'
    check (image_quality in ('adequate', 'borderline', 'inadequate')),
  -- Path in the private 'screening-images' bucket. Written by the backend only.
  image_path text,
  image_meta jsonb,
  -- What the model step did. 'not-run' is the honest default: nothing here is
  -- ever a made-up model output.
  model_status text not null default 'not-run'
    check (model_status in ('not-run', 'pending', 'completed', 'failed', 'unavailable')),
  analysis jsonb,
  analysed_at timestamptz,

  -- The queue. Set together by submit_screening(), never by a client.
  queue_priority text check (queue_priority in ('high', 'medium', 'low')),
  queue_date date,
  queue_seq integer check (queue_seq > 0),
  queue_number text,
  submitted_at timestamptz,
  served_at timestamptz,

  updated_at timestamptz not null default now(),

  constraint screenings_has_person check (patient_id is not null or applicant is not null),
  constraint screenings_examined_has_patient check (status = 'waiting' or patient_id is not null),
  constraint screenings_queued_has_number check (
    status not in ('queued', 'served')
    or (queue_number is not null and queue_priority is not null and queue_date is not null)
  )
);

create index screenings_patient_idx on public.screenings (patient_id, requested_at desc);
create index screenings_status_idx on public.screenings (status, request_date);
create unique index screenings_queue_seq_unique
  on public.screenings (queue_date, queue_seq)
  where queue_seq is not null;

create trigger screenings_set_updated_at
  before update on public.screenings
  for each row execute function public.set_updated_at();
