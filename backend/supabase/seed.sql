-- DEVELOPMENT SEED DATA. Never run this against a production project.
--
-- Everything below is synthetic, and it is kept apart from real operational
-- records in two ways: the e-mail domain `pulmo.test` (not routable), and the
-- fixed `…-4000-8000-…` UUID ranges, which `supabase db reset` recreates on
-- every run.
--
-- The file has two parts, split at the line "@@SAMPLE-RECORDS@@" below:
--
--   Part 1, base data
--     * the facility directory (the sample entries the frontend used to hard-code)
--     * four sign-ins, one per role, matching frontend/docs/accounts.md
--     * staff records for the professionals and the administrator
--     * one onboarded patient account with its clinical record, plus two walk-in
--       patients registered by the clinic
--
--   Part 2, sample records (so every table has 2-3 or more rows to look at)
--     * three more sign-ins: a nurse at another facility, a second patient, and
--       a patient who has not finished onboarding
--     * patient notes, reading progress, six screenings with symptoms and vitals,
--       three reviews, three referrals with their history, five follow-ups with
--       contact attempts, and audit entries for all of it
--
-- Part 2 never contains model output: every report has model_status 'not-run'
-- and analysis NULL, and no image is attached (an X-ray cannot be seeded from
-- SQL). The old frontend dummy data invented model results; doing that in a
-- database the application treats as real would be fabricated clinical output.
-- Reviews and notes in part 2 are labelled "Sample" in their text for the same
-- reason. The test suite loads part 1 only, so its expectations stay exact.
--
-- Passwords are the sample credentials from frontend/docs/accounts.md and are
-- hashed with bcrypt by the database. Change or remove them before any shared
-- deployment.

-- ── Facilities ──────────────────────────────────────────────────────────────

insert into public.healthcare_facilities
  (id, name, type, region, province, address, phone, latitude, longitude, services,
   distance_km, travel_time_minutes, info_status, info_updated_at, operating_hours,
   tb_programme_contact, published)
values
  ('f0000000-0000-4000-8000-000000000001', 'Puskesmas Waerana', 'puskesmas', 'Waerana', 'Nusa Tenggara Timur',
   'Jl. Raya Waerana No. 12, Wae Nioka', '(0385) 555-0110', -8.6221, 120.1894,
   '{cxr,sputum-microscopy,tb-treatment,general-outpatient}', 0, 0, 'verified-sample', current_date - 6,
   'Mon–Sat, 07:30–14:00', 'dr. Hanif Ramadhan', true),
  ('f0000000-0000-4000-8000-000000000002', 'Pustu Golo Mbu', 'posyandu', 'Waerana', 'Nusa Tenggara Timur',
   'Dusun Golo Mbu, Desa Golo Mbu', '0812-5550-0231', -8.6702, 120.2411,
   '{general-outpatient}', 7.4, 35, 'needs-review', current_date - 94,
   'Tue & Fri, 08:00–12:00', null, true),
  ('f0000000-0000-4000-8000-000000000003', 'Posyandu Rendu Bata', 'posyandu', 'Waerana', 'Nusa Tenggara Timur',
   'Balai Desa Rendu Bata', '0813-5550-0884', -8.5908, 120.2203,
   '{general-outpatient,pediatric-tb}', 5.1, 24, 'verified-sample', current_date - 21,
   'Wed, 08:00–11:00', null, true),
  ('f0000000-0000-4000-8000-000000000004', 'RSUD Lembor Tengah', 'district-hospital', 'Lembor Tengah', 'Nusa Tenggara Timur',
   'Jl. Kesehatan No. 4, Nggorang Baru', '(0385) 555-0420', -8.5411, 120.0732,
   '{cxr,sputum-microscopy,tcm-genexpert,tb-treatment,general-outpatient,inpatient}', 18.6, 52, 'verified-sample', current_date - 11,
   'Daily, 24 hours (TB clinic Mon–Fri 08:00–13:00)', 'dr. Sri Wulandari, Sp.P', true),
  ('f0000000-0000-4000-8000-000000000005', 'Klinik Pratama Siru Permai', 'clinic', 'Lembor Tengah', 'Nusa Tenggara Timur',
   'Jl. Siru Permai No. 88', '(0385) 555-0377', -8.5623, 120.1012,
   '{general-outpatient,sputum-microscopy}', 15.2, 41, 'unconfirmed', current_date - 168,
   'Mon–Sat, 16:00–20:00', null, true),
  ('f0000000-0000-4000-8000-000000000006', 'Puskesmas Satar Mese Utara', 'puskesmas', 'Satar Mese Utara', 'Nusa Tenggara Timur',
   'Jl. Lungar Raya, Lungar', '(0385) 555-0298', -8.7114, 120.3388,
   '{sputum-microscopy,tb-treatment,general-outpatient,pediatric-tb}', 22.9, 68, 'verified-sample', current_date - 33,
   'Mon–Sat, 07:30–14:00', 'Ns. Yohana Bete', true),
  ('f0000000-0000-4000-8000-000000000007', 'Laboratorium Rujukan Iteng', 'lab', 'Satar Mese Utara', 'Nusa Tenggara Timur',
   'Kompleks Iteng Selatan Blok B', '(0385) 555-0511', -8.7390, 120.3102,
   '{sputum-microscopy,tcm-genexpert}', 25.4, 74, 'verified-sample', current_date - 17,
   'Mon–Fri, 08:00–15:00', 'Andreas Liu, A.Md.AK', true),
  ('f0000000-0000-4000-8000-000000000008', 'Puskesmas Nanga Baru', 'puskesmas', 'Nanga Baru', 'Nusa Tenggara Timur',
   'Jl. Pelabuhan Nanga Lili No. 2', '(0385) 555-0633', -8.4488, 120.4201,
   '{cxr,sputum-microscopy,tb-treatment,general-outpatient}', 41.3, 115, 'needs-review', current_date - 77,
   'Mon–Sat, 08:00–13:00', 'Ns. Marselinus Dopo', true),
  ('f0000000-0000-4000-8000-000000000009', 'Pustu Lekolembo', 'posyandu', 'Nanga Baru', 'Nusa Tenggara Timur',
   'Dusun Lekolembo Atas', '0821-5550-1190', -8.4203, 120.4677,
   '{general-outpatient}', 47.8, 142, 'unconfirmed', current_date - 203,
   'Thu, 09:00–12:00', null, true),
  ('f0000000-0000-4000-8000-000000000010', 'RS Rujukan Tanjung Kelapa', 'referral-hospital', 'Tanjung Kelapa', 'Nusa Tenggara Timur',
   'Jl. Pesisir Kelapa Dua No. 1', '(0385) 555-0700', -8.4871, 119.9204,
   '{cxr,sputum-microscopy,tcm-genexpert,tb-treatment,mdr-tb-treatment,pediatric-tb,general-outpatient,inpatient}', 36.2, 88, 'verified-sample', current_date - 4,
   'Daily, 24 hours', 'dr. Bagas Prasetyo, Sp.P', true),
  ('f0000000-0000-4000-8000-000000000011', 'Klinik Loha Tengah', 'clinic', 'Tanjung Kelapa', 'Nusa Tenggara Timur',
   'Jl. Loha Tengah No. 19', '(0385) 555-0745', -8.5016, 119.9588,
   '{general-outpatient,pediatric-tb}', 33.0, 79, 'needs-review', current_date - 61,
   'Mon–Fri, 08:00–16:00', null, true),
  ('f0000000-0000-4000-8000-000000000012', 'Puskesmas Warloka Baru', 'puskesmas', 'Tanjung Kelapa', 'Nusa Tenggara Timur',
   'Jl. Warloka Baru KM 3', '(0385) 555-0812', -8.5544, 119.8831,
   '{sputum-microscopy,tb-treatment,general-outpatient}', 39.5, 97, 'verified-sample', current_date - 28,
   'Mon–Sat, 07:30–14:00', 'Ns. Clara Ndiwa', true),
  ('f0000000-0000-4000-8000-000000000013', 'RSUD Waerana', 'district-hospital', 'Waerana', 'Nusa Tenggara Timur',
   'Jl. Compang Tolok No. 30', '(0385) 555-0155', -8.6015, 120.1702,
   '{cxr,tcm-genexpert,tb-treatment,general-outpatient,inpatient}', 3.8, 14, 'verified-sample', current_date - 9,
   'Daily, 24 hours (TB clinic Mon–Sat 08:00–12:00)', 'dr. Intan Permatasari, Sp.P', true),
  ('f0000000-0000-4000-8000-000000000014', 'Pustu Tenda Wangka', 'posyandu', 'Lembor Tengah', 'Nusa Tenggara Timur',
   'Dusun Tenda Wangka', '0819-5550-0462', -8.5277, 120.1188,
   '{general-outpatient}', 12.7, 38, 'needs-review', current_date - 119,
   'Mon & Thu, 08:00–12:00', null, true)
on conflict (id) do nothing;

-- ── Sign-ins ────────────────────────────────────────────────────────────────
-- Inserting into auth.users fires the handle_new_user trigger, which creates a
-- `patient` profile for each. Roles are then raised below, the way an operator
-- would, because no client-supplied value can do it.

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'patient@pulmo.test', 'x ', 'Siti Rahmawati'),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'doctor@pulmo.test',  'Doctor123!',  'dr. Hanif Ramadhan'),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'chw@pulmo.test',     'Worker123!',  'Ayu Lestari'),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'admin@pulmo.test',   'Admin123!',   'Rina Hartati')
    ) as t(id, email, password, full_name)
  loop
    if not exists (select 1 from auth.users where id = rec.id) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', rec.id, 'authenticated', 'authenticated', rec.email,
        extensions.crypt(rec.password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.full_name),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), rec.id, rec.id::text,
        jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;

update public.profiles set role = 'professional'
  where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');
update public.profiles set role = 'admin'
  where id = 'a0000000-0000-4000-8000-000000000004';

-- ── Staff records ───────────────────────────────────────────────────────────
-- The doctor can sign off reviews; the community health worker cannot. The
-- administrator has a coordinator record, which never confers clinical access.

insert into public.healthcare_professional_profiles (profile_id, clinical_role, can_review, facility_id, phone)
values
  ('a0000000-0000-4000-8000-000000000002', 'physician',   true,  'f0000000-0000-4000-8000-000000000001', '0812-5550-3302'),
  ('a0000000-0000-4000-8000-000000000003', 'chw',         false, 'f0000000-0000-4000-8000-000000000001', '0812-5550-7781'),
  ('a0000000-0000-4000-8000-000000000004', 'coordinator', false, 'f0000000-0000-4000-8000-000000000001', '0812-5550-1163')
on conflict (profile_id) do nothing;

-- ── Patients ────────────────────────────────────────────────────────────────

insert into public.patient_onboarding
  (profile_id, step, personal, address, health, consent_data_use, consent_health_info, consent_accepted_at, completed_at)
values (
  'a0000000-0000-4000-8000-000000000001', 3,
  '{"fullName":"Siti Rahmawati","birthDate":"1991-04-18","phone":"0812-5550-2043","sex":"female"}',
  '{"province":"Nusa Tenggara Timur","district":"Manggarai Barat","village":"Labuan Bajo","addressLine":"Jl. Soekarno Hatta No. 24"}',
  '{"symptoms":["cough","night-sweats"],"symptomWeeks":3,"priorTb":"never","householdContact":false,"notes":"","shared":true}',
  true, true, now(), now()
)
on conflict (profile_id) do nothing;

insert into public.patient_profiles
  (id, mrn, profile_id, name, sex, birth_date, phone, village, district, province, home_facility_id, created_by)
values
  ('b0000000-0000-4000-8000-000000000001', 'TB-2601-0001', 'a0000000-0000-4000-8000-000000000001',
   'Siti Rahmawati', 'female', '1991-04-18', '0812-5550-2043', 'Labuan Bajo', 'Manggarai Barat',
   'Nusa Tenggara Timur', 'f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'TB-2601-0002', null,
   'Yosef Banggur', 'male', '1968-09-02', '0813-5550-4417', 'Golo Mbu', 'Waerana',
   'Nusa Tenggara Timur', 'f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'TB-2601-0003', null,
   'Maria Goreti', 'female', '1984-12-11', null, 'Rendu Bata', 'Waerana',
   'Nusa Tenggara Timur', 'f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- Keep the MRN sequence ahead of the fixed seed numbers above.
select setval('public.patient_mrn_seq', greatest((select last_value from public.patient_mrn_seq), 3));

-- @@SAMPLE-RECORDS@@
-- ════════════════════════════════════════════════════════════════════════════
-- Part 2: sample records. Everything here is synthetic and safe to run twice.
-- ════════════════════════════════════════════════════════════════════════════

-- ── More sign-ins ───────────────────────────────────────────────────────────
--   nurse@pulmo.test        Nurse123!    nurse at RSUD Lembor Tengah (a second facility)
--   patient2@pulmo.test     Patient123!  onboarded, placed at RSUD Lembor Tengah
--   newpatient@pulmo.test   Patient123!  stopped halfway through onboarding

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('a0000000-0000-4000-8000-000000000005'::uuid, 'nurse@pulmo.test',      'Nurse123!',   'Ns. Fransiska Nggeok'),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'patient2@pulmo.test',   'Patient123!', 'Dewi Anggraeni'),
      ('a0000000-0000-4000-8000-000000000007'::uuid, 'newpatient@pulmo.test', 'Patient123!', 'Bernadus Lasar')
    ) as t(id, email, password, full_name)
  loop
    if not exists (select 1 from auth.users where id = rec.id) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', rec.id, 'authenticated', 'authenticated', rec.email,
        extensions.crypt(rec.password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.full_name),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), rec.id, rec.id::text,
        jsonb_build_object('sub', rec.id::text, 'email', rec.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;

update public.profiles set role = 'professional'
  where id = 'a0000000-0000-4000-8000-000000000005';

insert into public.healthcare_professional_profiles (profile_id, clinical_role, can_review, facility_id, phone)
values
  ('a0000000-0000-4000-8000-000000000005', 'nurse', false, 'f0000000-0000-4000-8000-000000000004', '0812-5550-4410')
on conflict (profile_id) do nothing;

-- ── Onboarding and the second patient ───────────────────────────────────────

insert into public.patient_onboarding
  (profile_id, step, personal, address, health, consent_data_use, consent_health_info, consent_accepted_at, completed_at)
values
  ('a0000000-0000-4000-8000-000000000006', 3,
   '{"fullName":"Dewi Anggraeni","birthDate":"1996-01-09","phone":"0813-5550-6120","sex":"female"}',
   '{"province":"Nusa Tenggara Timur","district":"Lembor Tengah","village":"Lembor","addressLine":"Jl. Lembor Raya No. 5"}',
   '{"symptoms":["cough"],"symptomWeeks":2,"priorTb":"never","householdContact":true,"notes":"","shared":true}',
   true, true, now() - interval '12 days', now() - interval '12 days'),
  -- Stopped after the first step: personal details saved, nothing else.
  ('a0000000-0000-4000-8000-000000000007', 1,
   '{"fullName":"Bernadus Lasar","birthDate":"1979-07-30","phone":"0821-5550-9012","sex":"male"}',
   null, null, null, null, null, null)
on conflict (profile_id) do nothing;

insert into public.patient_profiles
  (id, mrn, profile_id, name, sex, birth_date, phone, village, district, province,
   home_facility_id, household_contacts, registered_at, created_by)
values
  ('b0000000-0000-4000-8000-000000000004', 'TB-2601-0004', 'a0000000-0000-4000-8000-000000000006',
   'Dewi Anggraeni', 'female', '1996-01-09', '0813-5550-6120', 'Lembor', 'Lembor Tengah',
   'Nusa Tenggara Timur', 'f0000000-0000-4000-8000-000000000004', 2,
   now() - interval '12 days', 'a0000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

select setval('public.patient_mrn_seq', greatest((select last_value from public.patient_mrn_seq), 4));

-- ── Reading progress ────────────────────────────────────────────────────────

insert into public.educational_progress (profile_id, article_id, read_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'what-is-tb',  now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000001', 'symptoms',    now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000006', 'what-is-tb',  now() - interval '11 days'),
  ('a0000000-0000-4000-8000-000000000006', 'symptoms',    now() - interval '11 days'),
  ('a0000000-0000-4000-8000-000000000006', 'prevention',  now() - interval '10 days')
on conflict (profile_id, article_id) do nothing;

-- ── Screenings ──────────────────────────────────────────────────────────────
-- Inserted as 'queued' (or 'draft'); the review and referral triggers below then
-- move them, exactly as they do for the application. model_status stays
-- 'not-run' and analysis NULL: no model has seen these records.
--
--   1 Siti    reviewed, then referred
--   2 Yosef   queued, waiting for a reviewer
--   3 Maria   reviewed with no action, closed
--   4 Yosef   reviewed, repeat image requested (earlier visit)
--   5 Maria   draft, not yet submitted
--   6 Dewi    queued at the other facility

insert into public.screenings
  (id, patient_id, facility_id, operator_id, performed_at, status, image_quality, created_offline)
values
  ('c1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', now() - interval '10 days', 'queued', 'adequate', false),
  ('c1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', now() - interval '2 days', 'queued', 'borderline', false),
  ('c1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', now() - interval '20 days', 'queued', 'adequate', false),
  ('c1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', now() - interval '25 days', 'queued', 'inadequate', true),
  ('c1000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', now() - interval '1 hour', 'draft', 'adequate', false),
  ('c1000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000005', now() - interval '3 days', 'queued', 'adequate', false)
on conflict (id) do nothing;

insert into public.screening_reports (screening_id, symptoms, vitals, model_status)
values
  ('c1000000-0000-4000-8000-000000000001',
   '{"coughWeeks":4,"hemoptysis":false,"nightSweats":true,"weightLoss":true,"fever":false,"chestPain":false,"fatigue":true,"appetiteLoss":false}',
   '{"weightKg":52,"heightCm":160,"temperatureC":37.4,"respiratoryRate":20}', 'not-run'),
  ('c1000000-0000-4000-8000-000000000002',
   '{"coughWeeks":2,"hemoptysis":false,"nightSweats":false,"weightLoss":false,"fever":true,"chestPain":false,"fatigue":false,"appetiteLoss":false}',
   '{"weightKg":61,"heightCm":168,"temperatureC":38.1,"respiratoryRate":22}', 'not-run'),
  ('c1000000-0000-4000-8000-000000000003',
   '{"coughWeeks":0,"hemoptysis":false,"nightSweats":false,"weightLoss":false,"fever":false,"chestPain":false,"fatigue":false,"appetiteLoss":false}',
   '{"weightKg":58,"heightCm":157,"temperatureC":36.6,"respiratoryRate":16}', 'not-run'),
  ('c1000000-0000-4000-8000-000000000004',
   '{"coughWeeks":6,"hemoptysis":true,"nightSweats":true,"weightLoss":true,"fever":false,"chestPain":true,"fatigue":true,"appetiteLoss":true}',
   '{"weightKg":49,"heightCm":165,"temperatureC":37.8,"respiratoryRate":24}', 'not-run'),
  ('c1000000-0000-4000-8000-000000000005',
   '{"coughWeeks":1,"hemoptysis":false,"nightSweats":false,"weightLoss":false,"fever":false,"chestPain":false,"fatigue":true,"appetiteLoss":false}',
   '{"weightKg":58,"heightCm":157,"temperatureC":null,"respiratoryRate":null}', 'not-run'),
  ('c1000000-0000-4000-8000-000000000006',
   '{"coughWeeks":2,"hemoptysis":false,"nightSweats":true,"weightLoss":false,"fever":false,"chestPain":false,"fatigue":true,"appetiteLoss":false}',
   '{"weightKg":55,"heightCm":158,"temperatureC":37.2,"respiratoryRate":18}', 'not-run')
on conflict (screening_id) do nothing;

-- Reviews. The trigger refuses a second review of a screening that is no longer
-- open, so each row is inserted only when it is missing. The doctor is the only
-- reviewer in the seed.
insert into public.screening_reviews (screening_id, reviewer_id, reviewed_at, agreement, decision, notes)
select v.screening_id::uuid, 'a0000000-0000-4000-8000-000000000002'::uuid, v.reviewed_at, v.agreement, v.decision, v.notes
from (values
  ('c1000000-0000-4000-8000-000000000001', now() - interval '9 days',  'needs-more-data', 'refer',
   'Sample review. Symptoms point to presumptive TB; refer for a molecular test.'),
  ('c1000000-0000-4000-8000-000000000003', now() - interval '19 days', 'agrees',          'no-action',
   'Sample review. No concern raised, no symptoms reported.'),
  ('c1000000-0000-4000-8000-000000000004', now() - interval '24 days', 'needs-more-data', 'repeat-image',
   'Sample review. Image quality too poor to read; repeat the film.')
) as v(screening_id, reviewed_at, agreement, decision, notes)
where not exists (select 1 from public.screening_reviews r where r.screening_id = v.screening_id::uuid);

-- ── Referrals ───────────────────────────────────────────────────────────────
-- Created as 'pending' so the insert trigger writes the first history event, then
-- moved on directly (this script is a trusted context) with matching events.

insert into public.referrals
  (id, patient_id, screening_id, from_facility_id, to_facility_id, reason, requested_service,
   priority, status, assigned_worker_id, created_by, created_at)
values
  ('c2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000013',
   'Sample referral. Presumptive TB, needs a molecular test.', 'tcm-genexpert', 'urgent', 'pending',
   'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', now() - interval '9 days'),
  ('c2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', null,
   'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000007',
   'Sample referral. Sputum smear after a persistent cough.', 'sputum-microscopy', 'soon', 'pending',
   'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', now() - interval '5 days'),
  ('c2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003',
   'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000013',
   'Sample referral. General check-up after screening.', 'general-outpatient', 'routine', 'pending',
   'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', now() - interval '18 days')
on conflict (id) do nothing;

update public.referrals
  set status = 'appointment-scheduled', appointment_date = current_date + 3
  where id = 'c2000000-0000-4000-8000-000000000002' and status = 'pending';
update public.referrals
  set status = 'attended', appointment_date = current_date - 13
  where id = 'c2000000-0000-4000-8000-000000000003' and status = 'pending';

insert into public.referral_events (id, referral_id, actor_id, from_status, to_status, note, created_at)
values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'pending', 'appointment-scheduled', 'Appointment booked at the laboratory.', now() - interval '4 days'),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'pending', 'appointment-scheduled', 'Appointment booked.', now() - interval '16 days'),
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'appointment-scheduled', 'attended', 'Patient attended.', now() - interval '13 days')
on conflict (id) do nothing;

-- The first history event takes the referral's own creation time.
update public.referral_events e
  set created_at = r.created_at
  from public.referrals r
  where r.id = e.referral_id and e.from_status is null
    and e.referral_id in ('c2000000-0000-4000-8000-000000000001',
                          'c2000000-0000-4000-8000-000000000002',
                          'c2000000-0000-4000-8000-000000000003');

-- ── Follow-ups and contact attempts ─────────────────────────────────────────

insert into public.follow_up_records
  (id, patient_id, referral_id, screening_id, reason, due_date, status, assigned_worker_id,
   completed_at, unresolved_reason, created_by, created_at)
values
  ('c4000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001', 'referral-attendance', current_date + 4, 'scheduled',
   'a0000000-0000-4000-8000-000000000003', null, null, 'a0000000-0000-4000-8000-000000000002', now() - interval '8 days'),
  ('c4000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', null,
   'c1000000-0000-4000-8000-000000000004', 'repeat-imaging', current_date - 3, 'in-progress',
   'a0000000-0000-4000-8000-000000000003', null, null, 'a0000000-0000-4000-8000-000000000002', now() - interval '23 days'),
  ('c4000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003',
   null, 'symptom-recheck', current_date - 10, 'completed',
   'a0000000-0000-4000-8000-000000000003', now() - interval '9 days', null, 'a0000000-0000-4000-8000-000000000003', now() - interval '15 days'),
  ('c4000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', null,
   'c1000000-0000-4000-8000-000000000006', 'symptom-recheck', current_date + 2, 'scheduled',
   'a0000000-0000-4000-8000-000000000005', null, null, 'a0000000-0000-4000-8000-000000000005', now() - interval '2 days'),
  ('c4000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002',
   null, 'contact-tracing', current_date - 14, 'unresolved',
   'a0000000-0000-4000-8000-000000000003', null, 'Household could not be reached after two attempts.',
   'a0000000-0000-4000-8000-000000000003', now() - interval '20 days')
on conflict (id) do nothing;

insert into public.follow_up_attempts (id, follow_up_id, actor_id, channel, outcome, note, created_at)
values
  ('c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'phone', 'no-answer', 'Sample note. Phone rang out.', now() - interval '6 days'),
  ('c5000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'home-visit', 'rescheduled', 'Sample note. Patient asked for a morning slot.', now() - interval '4 days'),
  ('c5000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003',
   'phone', 'reached', 'Sample note. No symptoms; visit completed.', now() - interval '9 days'),
  ('c5000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003',
   'phone', 'wrong-number', null, now() - interval '17 days'),
  ('c5000000-0000-4000-8000-000000000005', 'c4000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003',
   'village-cadre', 'moved-away', 'Sample note. Neighbours say the household moved.', now() - interval '15 days')
on conflict (id) do nothing;

-- ── Patient notes ───────────────────────────────────────────────────────────

insert into public.patient_notes (id, patient_id, author_id, body, context, context_id, created_at)
values
  ('c6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'Sample note. Discuss household contact screening at the next visit.', 'screening',
   'c1000000-0000-4000-8000-000000000001', now() - interval '9 days'),
  ('c6000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
   'Sample note. Works in the fields; mornings are the best time to reach him.', 'followup',
   'c4000000-0000-4000-8000-000000000002', now() - interval '4 days'),
  ('c6000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'Sample note. Registered through the posyandu; no concerns at intake.', 'general',
   null, now() - interval '20 days'),
  ('c6000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005',
   'Sample note. Two household contacts to be invited for screening.', 'screening',
   'c1000000-0000-4000-8000-000000000006', now() - interval '3 days')
on conflict (id) do nothing;

-- ── Audit trail for the sample activity ─────────────────────────────────────
-- The triggers already recorded each account's creation. These entries cover the
-- rest, in the same wording the application uses, with a metadata flag marking
-- them as seed data. Ids are derived from the record so a second run adds nothing.

insert into public.audit_logs (id, at, actor_id, actor_name, action, subject, detail, metadata)
select md5('seed-audit:' || e.action || ':' || e.ref)::uuid, e.at, e.actor, coalesce(p.full_name, ''),
       e.action, e.subject, e.detail, jsonb_build_object('seed', true)
from (
  select 'account.role-changed' as action, a.id::text as ref, now() - interval '30 days' as at,
         'a0000000-0000-4000-8000-000000000004'::uuid as actor, a.email as subject, 'patient to professional' as detail
    from public.profiles a where a.id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000005')
  union all
  select 'account.role-changed', a.id::text, now() - interval '30 days',
         'a0000000-0000-4000-8000-000000000004'::uuid, a.email, 'patient to admin'
    from public.profiles a where a.id = 'a0000000-0000-4000-8000-000000000004'
  union all
  select 'onboarding.completed', o.profile_id::text, o.completed_at, o.profile_id, p.email, 'Consented to health information use.'
    from public.patient_onboarding o join public.profiles p on p.id = o.profile_id where o.completed_at is not null
  union all
  select 'patient.created', pp.id::text, pp.registered_at, pp.created_by, pp.mrn, null
    from public.patient_profiles pp
  union all
  select 'patient.facility-changed', pp.id::text, pp.registered_at + interval '1 hour',
         'a0000000-0000-4000-8000-000000000004'::uuid, pp.mrn, 'Placed at facility ' || pp.home_facility_id
    from public.patient_profiles pp where pp.id = 'b0000000-0000-4000-8000-000000000004'
  union all
  select 'screening.created', s.id::text, s.created_at, s.operator_id, s.id::text, null
    from public.screenings s
  union all
  select 'screening.reviewed', r.screening_id::text, r.reviewed_at, r.reviewer_id, r.screening_id::text, r.decision
    from public.screening_reviews r
  union all
  select 'referral.created', rf.id::text, rf.created_at, rf.created_by, rf.id::text, null
    from public.referrals rf
  union all
  select 'referral.status-changed', ev.id::text, ev.created_at, ev.actor_id, ev.referral_id::text, ev.to_status
    from public.referral_events ev where ev.from_status is not null
  union all
  select 'followup.created', f.id::text, f.created_at, f.created_by, f.id::text, null
    from public.follow_up_records f
) e
left join public.profiles p on p.id = e.actor
on conflict (id) do nothing;
