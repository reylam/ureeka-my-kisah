-- Helpers and the workflow steps that must be atomic.
--
-- Every step that moves a screening forward (start, submit, call) is a
-- SECURITY DEFINER function that checks the caller itself, so the status and
-- queue columns can stay closed to direct writes. Error messages raised with
-- errcode 23514 are written to be shown to the person who caused them.

-- ── Who is calling ──────────────────────────────────────────────────────────

-- Role of the caller, or null: no session, no role, or a suspended account.
create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_account_role() = 'admin', false)
$$;

create or replace function public.is_radiologist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_account_role() = 'radiologist', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_account_role() is not null
$$;

-- ── Accounts ────────────────────────────────────────────────────────────────

-- Every new auth user gets a profile with no role. raw_user_meta_data is set by
-- whoever signs up, so only the display name is read from it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ── Access codes ────────────────────────────────────────────────────────────

-- Eight symbols from A-Z without I and O, and 2-9: 32 symbols, 40 bits. The
-- bytes come from gen_random_uuid(), which draws on the database's
-- cryptographic random source (the fixed version bits are skipped).
create or replace function public.new_access_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  v_i integer;
begin
  for v_try in 1..10 loop
    v_bytes := decode(
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
      || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4),
      'hex'
    );
    v_code := '';
    for v_i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 32) + 1, 1);
    end loop;
    if not exists (select 1 from public.screenings where access_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'Could not allocate an access code' using errcode = '55000';
end;
$$;

-- ── Workflow ────────────────────────────────────────────────────────────────

-- A new request and its access code.
--
-- Two callers: the backend's public form (service role, no auth.uid(), with
-- `p_applicant` holding what the person typed) and a staff member registering
-- someone at the desk (with `p_patient_id`). Anyone else is refused.
create or replace function public.create_request(
  p_patient_id uuid,
  p_applicant jsonb,
  p_complaint text
)
returns public.screenings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.screenings;
begin
  if auth.uid() is not null and not public.is_staff() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_patient_id is null and (p_applicant is null or coalesce(btrim(p_applicant ->> 'name'), '') = '') then
    raise exception 'Isi data pasien terlebih dahulu.' using errcode = '23514';
  end if;
  if p_patient_id is not null and not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;

  insert into public.screenings (patient_id, applicant, complaint, access_code, created_by)
  values (
    p_patient_id,
    case when p_patient_id is null then p_applicant end,
    left(coalesce(btrim(p_complaint), ''), 1000),
    public.new_access_code(),
    auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Save which patient a request belongs to. Staff only, and only before the
-- screening is submitted.
create or replace function public.set_screening_patient(p_screening_id uuid, p_patient_id uuid)
returns public.screenings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.screenings;
begin
  if not public.is_staff() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id) then
    raise exception 'Patient not found' using errcode = 'P0002';
  end if;

  select * into v_row from public.screenings where id = p_screening_id for update;
  if not found then
    raise exception 'Screening not found' using errcode = 'P0002';
  end if;
  if v_row.status not in ('waiting', 'examining') then
    raise exception 'Data pasien tidak bisa diganti setelah screening dikirim.' using errcode = '23514';
  end if;

  update public.screenings set patient_id = p_patient_id where id = p_screening_id returning * into v_row;
  return v_row;
end;
$$;

-- A radiologist takes a request. Taking one already taken by the same
-- radiologist is a no-op, so reopening the page is harmless.
create or replace function public.start_screening(p_screening_id uuid)
returns public.screenings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.screenings;
begin
  if not public.is_radiologist() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.screenings where id = p_screening_id for update;
  if not found then
    raise exception 'Screening not found' using errcode = 'P0002';
  end if;

  if v_row.status = 'examining' and v_row.operator_id = auth.uid() then
    return v_row;
  end if;
  if v_row.status = 'examining' then
    raise exception 'Permintaan ini sedang diperiksa radiolog lain.' using errcode = '23514';
  end if;
  if v_row.status <> 'waiting' then
    raise exception 'Screening ini sudah dikirim ke antrean.' using errcode = '23514';
  end if;
  if v_row.patient_id is null then
    raise exception 'Simpan data pasien terlebih dahulu.' using errcode = '23514';
  end if;

  update public.screenings
  set status = 'examining', operator_id = auth.uid(), started_at = now()
  where id = p_screening_id
  returning * into v_row;
  return v_row;
end;
$$;

-- Submit into today's queue (the clinic's calendar day, Asia/Jakarta). The
-- next number is taken under a lock so two submissions cannot share one.
create or replace function public.submit_screening(p_screening_id uuid, p_priority text)
returns public.screenings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.screenings;
  v_day date := (now() at time zone 'Asia/Jakarta')::date;
  v_seq integer;
begin
  if not public.is_radiologist() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_priority is null or p_priority not in ('high', 'medium', 'low') then
    raise exception 'Invalid priority' using errcode = '22023';
  end if;

  select * into v_row from public.screenings where id = p_screening_id for update;
  if not found or v_row.operator_id is distinct from auth.uid() then
    -- Same answer for "missing" and "not yours".
    raise exception 'Screening not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'examining' then
    raise exception 'Screening ini sudah dikirim ke antrean.' using errcode = '23514';
  end if;
  if v_row.image_path is null then
    raise exception 'Unggah rontgen terlebih dahulu.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtext('screening-queue-' || v_day::text));
  select coalesce(max(queue_seq), 0) + 1 into v_seq from public.screenings where queue_date = v_day;

  update public.screenings
  set status = 'queued',
      queue_priority = p_priority,
      queue_date = v_day,
      queue_seq = v_seq,
      queue_number = 'A-' || lpad(v_seq::text, 3, '0'),
      submitted_at = now()
  where id = p_screening_id
  returning * into v_row;
  return v_row;
end;
$$;

-- The patient has been called from the queue.
create or replace function public.mark_served(p_screening_id uuid)
returns public.screenings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.screenings;
begin
  if not public.is_staff() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.screenings where id = p_screening_id for update;
  if not found then
    raise exception 'Screening not found' using errcode = 'P0002';
  end if;
  if v_row.status = 'served' then
    return v_row;
  end if;
  if v_row.status <> 'queued' then
    raise exception 'Hanya pasien di antrean yang bisa dipanggil.' using errcode = '23514';
  end if;

  update public.screenings set status = 'served', served_at = now()
  where id = p_screening_id
  returning * into v_row;
  return v_row;
end;
$$;
