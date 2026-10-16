-- DEVELOPMENT SEED DATA. Never run this against a production project.
--
-- Everything here is synthetic: the e-mail domain `parupintas.test` is not
-- routable, and the fixed `…-4000-8000-…` UUIDs are recreated by every
-- `supabase db reset`.
--
-- Two parts, split at the line "@@SAMPLE-RECORDS@@":
--
--   Part 1, base data: three staff sign-ins (one administrator, two
--   radiologists) and four saved patients.
--
--   Part 2, sample visits for today, one in every state, with fixed access
--   codes so the patient page can be tried straight away:
--
--     BARU-2345  waiting, sent from the public form, not yet saved as a patient
--     BARU-3456  waiting, sent from the public form, not yet saved as a patient
--     DAFT-2345  waiting, registered at the desk for a saved patient
--     PRKS-2345  examining, taken by the first radiologist
--     ANTR-2345  queued, priority high
--     ANTR-3456  queued, priority low
--     SLSE-2345  served
--     LAMA-2345  an older visit, for the X-ray history
--
-- No sample row carries model output or an image: an X-ray cannot be seeded
-- from SQL, and a made-up model result in a database the app treats as real
-- would be fabricated clinical output. The test suite loads part 1 only.
--
-- Passwords are hashed by the database. Change or remove these accounts before
-- any shared deployment.

-- ── Staff sign-ins ──────────────────────────────────────────────────────────
-- Inserting into auth.users fires handle_new_user, which creates a profile
-- with no role. The roles are given below, the way an operator would.

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@parupintas.test',     'Admin123!',    'Rina Hartati'),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'radiolog@parupintas.test',  'Radiolog123!', 'dr. Hanif Ramadhan, Sp.Rad'),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'radiolog2@parupintas.test', 'Radiolog123!', 'dr. Sri Wulandari, Sp.Rad')
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

update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'radiologist'
  where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');

-- ── Patients ────────────────────────────────────────────────────────────────

insert into public.patients (id, mrn, name, sex, birth_date, phone, address, created_by)
values
  ('b0000000-0000-4000-8000-000000000001', 'RM-2601-0001', 'Siti Rahmawati', 'female', '1987-03-14',
   '0812-5550-0101', 'Desa Golo Mbu, Waerana', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'RM-2601-0002', 'Yohanes Bata', 'male', '1962-11-02',
   '0813-5550-0202', 'Dusun Rendu Bata, Waerana', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'RM-2601-0003', 'Maria Ndiwa', 'female', '1995-07-21',
   null, 'Jl. Lungar Raya, Satar Mese Utara', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000004', 'RM-2601-0004', 'Agus Pranata', 'male', '1979-01-30',
   '0821-5550-0404', 'Jl. Pelabuhan Nanga Lili No. 2', 'a0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- Keep the generated numbers clear of the fixed ones above.
select setval('public.patient_mrn_seq', greatest((select last_value from public.patient_mrn_seq), 100));

-- @@SAMPLE-RECORDS@@

-- ── Today's visits ──────────────────────────────────────────────────────────

do $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_admin uuid := 'a0000000-0000-4000-8000-000000000001';
  v_rad uuid := 'a0000000-0000-4000-8000-000000000002';
begin
  insert into public.screenings
    (id, patient_id, applicant, complaint, access_code, request_date, requested_at, created_by,
     status, operator_id, started_at, symptoms, vitals,
     queue_priority, queue_date, queue_seq, queue_number, submitted_at, served_at)
  values
    -- From the public form, not yet saved as patients.
    ('c0000000-0000-4000-8000-000000000001', null,
     '{"name":"Fransiskus Jehaut","sex":"male","birthDate":"1971-05-09","phone":"0852-5550-1111","address":"Desa Wae Nioka"}',
     'Batuk lebih dari tiga minggu, kadang berdahak.', 'BARU2345', v_today, now() - interval '50 minutes', null,
     'waiting', null, null, '{}', '{}', null, null, null, null, null, null),
    ('c0000000-0000-4000-8000-000000000002', null,
     '{"name":"Siti Rahmawati","sex":"female","birthDate":"1987-03-14","phone":"0812-5550-0101","address":"Golo Mbu"}',
     'Kontrol, diminta rontgen ulang.', 'BARU3456', v_today, now() - interval '35 minutes', null,
     'waiting', null, null, '{}', '{}', null, null, null, null, null, null),
    -- Registered at the desk for a saved patient.
    ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', null,
     'Demam dan keringat malam dua minggu terakhir.', 'DAFT2345', v_today, now() - interval '25 minutes', v_admin,
     'waiting', null, null, '{}', '{}', null, null, null, null, null, null),
    -- Taken by the first radiologist.
    ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', null,
     'Sesak napas saat beraktivitas.', 'PRKS2345', v_today, now() - interval '70 minutes', v_admin,
     'examining', v_rad, now() - interval '10 minutes', '{}', '{}', null, null, null, null, null, null),
    -- In the queue. Submitted without a model result (none can be seeded).
    ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', null,
     'Batuk darah sejak seminggu.', 'ANTR2345', v_today, now() - interval '2 hours', v_admin,
     'queued', v_rad, now() - interval '100 minutes',
     '{"coughWeeks":6,"hemoptysis":true,"nightSweats":true,"weightLoss":true,"fever":false,"chestPain":false,"fatigue":true,"appetiteLoss":true}',
     '{"weightKg":51,"heightCm":166,"temperatureC":37.4,"respiratoryRate":22}',
     'high', v_today, 2, 'A-002', now() - interval '80 minutes', null),
    ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', null,
     'Pemeriksaan rutin karyawan.', 'ANTR3456', v_today, now() - interval '3 hours', v_admin,
     'queued', v_rad, now() - interval '160 minutes',
     '{"coughWeeks":0,"hemoptysis":false,"nightSweats":false,"weightLoss":false,"fever":false,"chestPain":false,"fatigue":false,"appetiteLoss":false}',
     '{"weightKg":58,"heightCm":158,"temperatureC":36.6,"respiratoryRate":16}',
     'low', v_today, 1, 'A-001', now() - interval '150 minutes', null),
    -- Called already.
    ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003', null,
     'Batuk dua minggu.', 'SLSE2345', v_today, now() - interval '4 hours', v_admin,
     'served', v_rad, now() - interval '230 minutes',
     '{"coughWeeks":2,"hemoptysis":false,"nightSweats":false,"weightLoss":false,"fever":true,"chestPain":false,"fatigue":false,"appetiteLoss":false}',
     '{"weightKg":49,"heightCm":155,"temperatureC":37.9,"respiratoryRate":18}',
     'medium', v_today, 3, 'A-003', now() - interval '220 minutes', now() - interval '60 minutes'),
    -- An older visit of a saved patient, for the X-ray history.
    ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000002', null,
     'Batuk lama.', 'LAMA2345', v_today - 30, now() - interval '30 days', v_admin,
     'served', v_rad, now() - interval '30 days',
     '{"coughWeeks":3,"hemoptysis":false,"nightSweats":true,"weightLoss":false,"fever":false,"chestPain":false,"fatigue":true,"appetiteLoss":false}',
     '{"weightKg":54,"heightCm":166,"temperatureC":37.1,"respiratoryRate":20}',
     'medium', v_today - 30, 1, 'A-001', now() - interval '30 days', now() - interval '30 days')
  on conflict (id) do nothing;
end $$;
