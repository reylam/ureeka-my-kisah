-- PULMO core schema.
--
-- Tables exist only where the frontend docs (frontend/docs/*.md) and the
-- domain types (frontend/src/types) describe a record that has to be stored.
-- Educational articles stay a static frontend module (api-contract.md lists
-- content management under "not yet designed"), so only reading progress is
-- stored.
--
-- Row Level Security is switched on in 20260101000200_rls_policies.sql.

-- ── Shared helpers ──────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence if not exists public.patient_mrn_seq;
create sequence if not exists public.referral_code_seq;
create sequence if not exists public.follow_up_code_seq;

-- ── Accounts ────────────────────────────────────────────────────────────────

-- One row per auth.users row. Created by a trigger, always as 'patient'.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'patient'
    check (role in ('patient', 'professional', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Facilities ──────────────────────────────────────────────────────────────

create table public.healthcare_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  type text not null
    check (type in ('posyandu', 'puskesmas', 'clinic', 'district-hospital', 'referral-hospital', 'lab')),
  region text not null default '',
  province text not null default '',
  address text not null default '',
  phone text not null default '',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  services text[] not null default '{}',
  distance_km numeric(7, 1) not null default 0 check (distance_km >= 0),
  travel_time_minutes integer not null default 0 check (travel_time_minutes >= 0),
  info_status text not null default 'needs-review'
    check (info_status in ('verified-sample', 'needs-review', 'unconfirmed')),
  info_updated_at date not null default current_date,
  operating_hours text not null default '',
  tb_programme_contact text,
  -- New entries are unpublished on purpose: patients use the directory to
  -- decide where to go, so an unchecked entry must not appear on save.
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index healthcare_facilities_published_idx on public.healthcare_facilities (published);

create trigger healthcare_facilities_set_updated_at
  before update on public.healthcare_facilities
  for each row execute function public.set_updated_at();

-- Staff record behind a professional (or administrator) account. It carries
-- the facility (which decides which patients are "assigned") and can_review
-- (a community health worker cannot sign off a review).
create table public.healthcare_professional_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  clinical_role text not null
    check (clinical_role in ('chw', 'nurse', 'physician', 'coordinator')),
  can_review boolean not null default false,
  facility_id uuid not null references public.healthcare_facilities (id) on delete restrict,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index healthcare_professional_profiles_facility_idx
  on public.healthcare_professional_profiles (facility_id);

create trigger healthcare_professional_profiles_set_updated_at
  before update on public.healthcare_professional_profiles
  for each row execute function public.set_updated_at();

-- ── Patients ────────────────────────────────────────────────────────────────

-- The clinical record. profile_id is set for patients who registered
-- themselves and null for records a professional created on someone's behalf.
create table public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique
    default ('TB-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.patient_mrn_seq')::text, 4, '0')),
  profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 200),
  sex text check (sex in ('male', 'female')),
  birth_date date,
  phone text,
  village text not null default '',
  district text not null default '',
  province text not null default '',
  -- Null until a professional or administrator places the patient at a
  -- facility. Until then no professional is "assigned" to the record.
  home_facility_id uuid references public.healthcare_facilities (id) on delete set null,
  risk_factors text[] not null default '{}',
  household_contacts integer not null default 0 check (household_contacts >= 0),
  registered_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index patient_profiles_home_facility_idx on public.patient_profiles (home_facility_id);
create index patient_profiles_name_idx on public.patient_profiles (lower(name));

create trigger patient_profiles_set_updated_at
  before update on public.patient_profiles
  for each row execute function public.set_updated_at();

-- Saved per wizard step so a half-finished onboarding resumes.
create table public.patient_onboarding (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  step integer not null default 0 check (step between 0 and 3),
  personal jsonb,
  address jsonb,
  health jsonb,
  consent_data_use boolean,
  consent_health_info boolean,
  consent_accepted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger patient_onboarding_set_updated_at
  before update on public.patient_onboarding
  for each row execute function public.set_updated_at();

create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  context text not null default 'general'
    check (context in ('general', 'screening', 'referral', 'followup')),
  context_id uuid,
  created_at timestamptz not null default now()
);

create index patient_notes_patient_idx on public.patient_notes (patient_id, created_at desc);

-- ── Screenings ──────────────────────────────────────────────────────────────

-- Workflow metadata. Administrators may read this table; they may not read
-- the clinical content, which lives in screening_reports / screening_reviews.
--
-- Three separate statuses are kept apart on purpose:
--   screenings.status            where the record is in the human workflow
--   screening_reports.model_status   what the AI step did (or did not do)
--   screening_reviews (row exists)   whether a clinician has signed off
create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete cascade,
  facility_id uuid not null references public.healthcare_facilities (id) on delete restrict,
  operator_id uuid not null references public.profiles (id) on delete restrict,
  performed_at timestamptz not null default now(),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'awaiting-review', 'reviewed', 'referred', 'closed')),
  image_quality text not null default 'adequate'
    check (image_quality in ('adequate', 'borderline', 'inadequate')),
  created_offline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index screenings_patient_idx on public.screenings (patient_id, performed_at desc);
create index screenings_status_idx on public.screenings (status);
create index screenings_operator_idx on public.screenings (operator_id);

create trigger screenings_set_updated_at
  before update on public.screenings
  for each row execute function public.set_updated_at();

-- Clinical content of a screening. Never readable by administrators.
create table public.screening_reports (
  screening_id uuid primary key references public.screenings (id) on delete cascade,
  symptoms jsonb not null default '{}'::jsonb,
  vitals jsonb not null default '{}'::jsonb,
  -- Path inside the private 'screening-images' bucket. Written only by the
  -- backend (service role) after an authorisation check.
  image_path text,
  image_meta jsonb,
  -- State of the model step. 'not-run' is the honest default: nothing in this
  -- database is ever fabricated as a model output.
  model_status text not null default 'not-run'
    check (model_status in ('not-run', 'pending', 'completed', 'failed', 'unavailable')),
  -- Verbatim output of the inference service, null until a real run completed.
  analysis jsonb,
  analysed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger screening_reports_set_updated_at
  before update on public.screening_reports
  for each row execute function public.set_updated_at();

create table public.screening_reviews (
  screening_id uuid primary key references public.screenings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  agreement text not null check (agreement in ('agrees', 'disagrees', 'needs-more-data')),
  decision text not null check (decision in ('refer', 'repeat-image', 'observe', 'no-action')),
  notes text not null default '' check (char_length(notes) <= 4000)
);

-- ── Referrals ───────────────────────────────────────────────────────────────

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default ('REF-' || lpad(nextval('public.referral_code_seq')::text, 4, '0')),
  patient_id uuid not null references public.patient_profiles (id) on delete cascade,
  screening_id uuid references public.screenings (id) on delete set null,
  from_facility_id uuid not null references public.healthcare_facilities (id) on delete restrict,
  to_facility_id uuid not null references public.healthcare_facilities (id) on delete restrict,
  reason text not null default '' check (char_length(reason) <= 2000),
  requested_service text not null
    check (requested_service in ('cxr', 'sputum-microscopy', 'tcm-genexpert', 'tb-treatment',
                                 'mdr-tb-treatment', 'pediatric-tb', 'general-outpatient', 'inpatient')),
  priority text not null default 'routine' check (priority in ('routine', 'soon', 'urgent')),
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'referred', 'appointment-scheduled',
                      'attended', 'followup-required', 'closed')),
  appointment_date date,
  assigned_worker_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referrals_patient_idx on public.referrals (patient_id, created_at desc);
create index referrals_screening_idx on public.referrals (screening_id);

create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute function public.set_updated_at();

create table public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index referral_events_referral_idx on public.referral_events (referral_id, created_at);

-- ── Follow-ups ──────────────────────────────────────────────────────────────

create table public.follow_up_records (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default ('FU-' || lpad(nextval('public.follow_up_code_seq')::text, 4, '0')),
  patient_id uuid not null references public.patient_profiles (id) on delete cascade,
  referral_id uuid references public.referrals (id) on delete set null,
  screening_id uuid references public.screenings (id) on delete set null,
  reason text not null
    check (reason in ('referral-attendance', 'sputum-result', 'repeat-imaging',
                      'treatment-adherence', 'contact-tracing', 'symptom-recheck')),
  due_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in-progress', 'completed', 'unresolved')),
  assigned_worker_id uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  unresolved_reason text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index follow_up_records_patient_idx on public.follow_up_records (patient_id, due_date);
create index follow_up_records_due_idx on public.follow_up_records (due_date) where status in ('scheduled', 'in-progress');

create trigger follow_up_records_set_updated_at
  before update on public.follow_up_records
  for each row execute function public.set_updated_at();

create table public.follow_up_attempts (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.follow_up_records (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  channel text not null check (channel in ('phone', 'home-visit', 'village-cadre', 'sms')),
  outcome text not null
    check (outcome in ('reached', 'no-answer', 'wrong-number', 'moved-away', 'rescheduled')),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index follow_up_attempts_follow_up_idx on public.follow_up_attempts (follow_up_id, created_at);

-- ── Education ───────────────────────────────────────────────────────────────

-- Articles are a static module in the frontend; only who has read what is
-- stored, and only the owner can see it.
create table public.educational_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  article_id text not null check (char_length(article_id) between 1 and 120),
  read_at timestamptz not null default now(),
  primary key (profile_id, article_id)
);

-- ── Audit ───────────────────────────────────────────────────────────────────

-- Append-only. Rows are written by the backend (service role) and by the
-- security-definer account functions; nothing can update or delete them.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  action text not null check (char_length(action) between 1 and 80),
  subject text not null default '',
  detail text,
  metadata jsonb not null default '{}'::jsonb
);

create index audit_logs_at_idx on public.audit_logs (at desc);
create index audit_logs_action_idx on public.audit_logs (action);
