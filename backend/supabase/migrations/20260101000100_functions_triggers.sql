-- Helper functions, triggers and the few operations that must be atomic.
--
-- Everything that reads another table from inside a policy is SECURITY
-- DEFINER with a pinned search_path. That is what keeps RLS policies from
-- recursing into each other (profiles -> staff -> patients -> profiles ...).

-- â”€â”€ Identity helpers (used by policies) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Role of the caller, or null when there is no session, no profile, or the
-- account is suspended. A suspended account therefore matches no policy.
create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
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

create or replace function public.is_professional()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_account_role() = 'professional', false)
$$;

-- Facility of the calling professional. Null for everyone else, including
-- administrators: an administrative account is not assigned to patients.
create or replace function public.staff_facility_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.facility_id
  from public.healthcare_professional_profiles s
  where s.profile_id = auth.uid() and public.is_professional()
$$;

-- Whether the caller may sign off a clinical review. Administrators never can,
-- even if their staff record says can_review: administrative access is not
-- clinical competence (frontend/docs/api-contract.md).
create or replace function public.staff_can_review()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.can_review
     from public.healthcare_professional_profiles s
     where s.profile_id = auth.uid()),
    false
  ) and public.is_professional()
$$;

-- The clinical record id of the calling patient.
create or replace function public.my_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pp.id
  from public.patient_profiles pp
  where pp.profile_id = auth.uid() and public.current_account_role() = 'patient'
$$;

-- "Assigned" means: the caller is a professional whose facility is the
-- patient's home facility.
create or replace function public.is_assigned_to_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_professional() and exists (
    select 1
    from public.patient_profiles pp
    where pp.id = p_patient_id
      and pp.home_facility_id is not null
      and pp.home_facility_id = public.staff_facility_id()
  )
$$;

create or replace function public.screening_patient_id(p_screening_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.patient_id from public.screenings s where s.id = p_screening_id
$$;

-- â”€â”€ New user -> profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Every sign-up becomes a patient. raw_user_meta_data is attacker-controlled
-- (the client sets it in signUp / updateUser), so only the display name is
-- read from it and any 'role' key is ignored on purpose.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200),
    'patient',
    'active'
  );

  insert into public.audit_logs (actor_id, actor_name, action, subject, detail)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200),
    'account.created',
    coalesce(new.email, ''),
    'Self-registered. Assigned the patient role.'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in step with auth.users.email.
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

-- â”€â”€ Audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function public.audit_logs_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_are_append_only();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_are_append_only();

-- Internal writer used by the functions below. Not callable by clients.
create or replace function public.write_audit(
  p_actor uuid,
  p_action text,
  p_subject text,
  p_detail text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = p_actor;
  insert into public.audit_logs (actor_id, actor_name, action, subject, detail, metadata)
  values (p_actor, coalesce(v_name, ''), p_action, p_subject, p_detail, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- â”€â”€ Guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Fields of a patient record that clients may not rewrite. A null auth.uid()
-- means a trusted server context (migrations, the service role), which is let
-- through.
create or replace function public.guard_patient_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.mrn is distinct from old.mrn
     or new.profile_id is distinct from old.profile_id
     or new.created_by is distinct from old.created_by
     or new.registered_at is distinct from old.registered_at then
    raise exception 'Immutable patient fields cannot be changed' using errcode = '42501';
  end if;

  -- Placing a patient at a facility decides who may see the record, so only
  -- an administrator may do it after creation.
  if new.home_facility_id is distinct from old.home_facility_id and not public.is_admin() then
    raise exception 'Only an administrator can change the home facility' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger patient_profiles_guard_update
  before update on public.patient_profiles
  for each row execute function public.guard_patient_profile_update();

-- A screening can only be filed for a patient the caller is assigned to, at
-- the caller's own facility.
create or replace function public.guard_screening_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status not in ('draft', 'queued') then
    raise exception 'A new screening starts as draft or queued' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger screenings_guard_insert
  before insert on public.screenings
  for each row execute function public.guard_screening_insert();

-- Operators can move their own record draft -> queued and nothing else; every
-- later transition is made by the triggers below.
create or replace function public.guard_screening_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted server context, or an update issued by another trigger of ours
  -- (review, referral, analysis): those are the legitimate status changes.
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.status is distinct from old.status then
    if not (old.status = 'draft' and new.status = 'queued') then
      raise exception 'Illegal screening status change % -> %', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  if new.patient_id is distinct from old.patient_id
     or new.facility_id is distinct from old.facility_id
     or new.operator_id is distinct from old.operator_id then
    raise exception 'Immutable screening fields cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger screenings_guard_update
  before update on public.screenings
  for each row execute function public.guard_screening_update();

-- â”€â”€ Workflow triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- A real model result moves a queued screening to awaiting-review.
create or replace function public.on_report_analysis_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.model_status = 'completed'
     and (tg_op = 'INSERT' or old.model_status is distinct from 'completed') then
    update public.screenings
    set status = 'awaiting-review'
    where id = new.screening_id and status = 'queued';
  end if;
  return new;
end;
$$;

create trigger screening_reports_analysis_completed
  after insert or update of model_status on public.screening_reports
  for each row execute function public.on_report_analysis_completed();

-- A review closes the loop. 'no-action' closes the record; any other decision
-- leaves it reviewed. Only a screening that is still open can be reviewed.
create or replace function public.on_review_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.screenings where id = new.screening_id for update;
  if v_status not in ('queued', 'awaiting-review') then
    raise exception 'Screening is not open for review (status: %)', v_status
      using errcode = '23514';
  end if;

  update public.screenings
  set status = case when new.decision = 'no-action' then 'closed' else 'reviewed' end
  where id = new.screening_id;

  return new;
end;
$$;

create trigger screening_reviews_inserted
  before insert on public.screening_reviews
  for each row execute function public.on_review_inserted();

-- New referral: record the first history event and mark the screening.
create or replace function public.on_referral_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.screening_id is not null then
    if public.screening_patient_id(new.screening_id) is distinct from new.patient_id then
      raise exception 'Screening does not belong to this patient' using errcode = '23514';
    end if;
    update public.screenings
    set status = 'referred'
    where id = new.screening_id and status in ('reviewed', 'queued', 'awaiting-review', 'referred');
  end if;

  insert into public.referral_events (referral_id, actor_id, from_status, to_status, note)
  values (new.id, new.created_by, null, new.status, 'Referral created.');

  return new;
end;
$$;

create trigger referrals_inserted
  after insert on public.referrals
  for each row execute function public.on_referral_inserted();

-- â”€â”€ Atomic operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Status change plus its history event, authorised inside the function so the
-- status column can stay closed to direct updates.
create or replace function public.set_referral_status(
  p_referral_id uuid,
  p_status text,
  p_note text default null
)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals;
  v_old text;
begin
  select * into v_ref from public.referrals where id = p_referral_id for update;
  if not found or not public.is_assigned_to_patient(v_ref.patient_id) then
    -- Same answer for "missing" and "not yours".
    raise exception 'Referral not found' using errcode = 'P0002';
  end if;

  if p_status not in ('draft', 'pending', 'referred', 'appointment-scheduled',
                      'attended', 'followup-required', 'closed') then
    raise exception 'Invalid referral status' using errcode = '22023';
  end if;

  v_old := v_ref.status;
  if v_old = p_status then
    return v_ref;
  end if;

  update public.referrals set status = p_status where id = p_referral_id returning * into v_ref;

  insert into public.referral_events (referral_id, actor_id, from_status, to_status, note)
  values (p_referral_id, auth.uid(), v_old, p_status, nullif(btrim(coalesce(p_note, '')), ''));

  return v_ref;
end;
$$;

-- Admin account management. Each function re-checks the caller, so the rules
-- hold no matter which client calls them.
create or replace function public.admin_set_account_role(p_target uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_previous text;
  v_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_role not in ('patient', 'professional', 'admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_target = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_target for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  v_previous := v_target.role;
  if v_previous = p_role then
    return v_target;
  end if;

  if v_previous = 'admin' and v_target.status = 'active' then
    select count(*) into v_admins from public.profiles where role = 'admin' and status = 'active';
    if v_admins <= 1 then
      raise exception 'The last active administrator cannot be demoted' using errcode = '23514';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_target returning * into v_target;

  perform public.write_audit(
    auth.uid(), 'account.role-changed', v_target.email,
    format('%s to %s', v_previous, p_role)
  );
  return v_target;
end;
$$;

create or replace function public.admin_set_account_status(p_target uuid, p_status text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles;
  v_admins integer;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if p_target = auth.uid() then
    raise exception 'You cannot change your own status' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = p_target for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if v_target.status = p_status then
    return v_target;
  end if;

  if p_status = 'suspended' and v_target.role = 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin' and status = 'active';
    if v_admins <= 1 then
      raise exception 'The last active administrator cannot be suspended' using errcode = '23514';
    end if;
  end if;

  update public.profiles set status = p_status where id = p_target returning * into v_target;

  perform public.write_audit(
    auth.uid(),
    case when p_status = 'suspended' then 'account.suspended' else 'account.reactivated' end,
    v_target.email,
    null
  );
  return v_target;
end;
$$;

create or replace function public.admin_upsert_staff_profile(
  p_target uuid,
  p_clinical_role text,
  p_facility_id uuid,
  p_can_review boolean,
  p_phone text default null
)
returns public.healthcare_professional_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.healthcare_professional_profiles;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select email into v_email from public.profiles where id = p_target;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;

  insert into public.healthcare_professional_profiles
    (profile_id, clinical_role, facility_id, can_review, phone)
  values (p_target, p_clinical_role, p_facility_id, coalesce(p_can_review, false), p_phone)
  on conflict (profile_id) do update
    set clinical_role = excluded.clinical_role,
        facility_id = excluded.facility_id,
        can_review = excluded.can_review,
        phone = excluded.phone
  returning * into v_row;

  perform public.write_audit(
    auth.uid(), 'account.role-changed', v_email,
    format('Staff record set: %s, can_review=%s', p_clinical_role, coalesce(p_can_review, false))
  );
  return v_row;
end;
$$;

create or replace function public.admin_remove_staff_profile(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select email into v_email from public.profiles where id = p_target;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  delete from public.healthcare_professional_profiles where profile_id = p_target;
  perform public.write_audit(auth.uid(), 'account.role-changed', v_email, 'Staff record removed');
end;
$$;

-- Staff directory. Professionals and administrators see everyone; a patient
-- sees only the staff who appear on their own screenings and referrals, and
-- only name and role.
create or replace function public.list_staff()
returns table (
  id uuid,
  name text,
  clinical_role text,
  can_review boolean,
  facility_id uuid,
  email text,
  phone text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_account_role();
  v_patient uuid := public.my_patient_id();
begin
  if v_role in ('professional', 'admin') then
    return query
      select s.profile_id, p.full_name, s.clinical_role, s.can_review, s.facility_id, p.email, s.phone
      from public.healthcare_professional_profiles s
      join public.profiles p on p.id = s.profile_id
      where p.status = 'active' or v_role = 'admin'
      order by p.full_name;
  elsif v_role = 'patient' and v_patient is not null then
    return query
      select s.profile_id, p.full_name, s.clinical_role, false, s.facility_id, null::text, null::text
      from public.healthcare_professional_profiles s
      join public.profiles p on p.id = s.profile_id
      where s.profile_id in (
        select sc.operator_id from public.screenings sc where sc.patient_id = v_patient
        union
        select r.reviewer_id
          from public.screening_reviews r
          join public.screenings sc on sc.id = r.screening_id
          where sc.patient_id = v_patient
        union
        select f.assigned_worker_id from public.follow_up_records f where f.patient_id = v_patient
        union
        select rf.assigned_worker_id from public.referrals rf where rf.patient_id = v_patient
      )
      order by p.full_name;
  end if;
end;
$$;

-- Records a sign-in. Only touches the caller's own row.
create or replace function public.touch_last_sign_in(p_at timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set last_sign_in_at = p_at
  where id = auth.uid() and (last_sign_in_at is null or last_sign_in_at < p_at)
$$;

-- â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Finishes onboarding and creates (or updates) the patient's clinical record
-- in one step. Withdrawing health consent clears the health answers: a switch
-- that leaves the data in place is a preference, not consent.
create or replace function public.complete_patient_onboarding(
  p_data_use boolean,
  p_health_info boolean
)
returns public.patient_onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.patient_onboarding;
  v_profile public.profiles;
  v_now timestamptz := now();
begin
  select * into v_profile from public.profiles where id = v_uid and status = 'active';
  if not found or v_profile.role <> 'patient' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if not coalesce(p_data_use, false) then
    raise exception 'Consent to data use is required' using errcode = '23514';
  end if;

  select * into v_row from public.patient_onboarding where profile_id = v_uid for update;
  if not found or v_row.personal is null or v_row.address is null then
    raise exception 'Personal and address details are required before completing'
      using errcode = '23514';
  end if;

  update public.patient_onboarding
  set consent_data_use = true,
      consent_health_info = coalesce(p_health_info, false),
      consent_accepted_at = v_now,
      completed_at = v_now,
      step = 3,
      health = case when coalesce(p_health_info, false) then health else null end
  where profile_id = v_uid
  returning * into v_row;

  insert into public.patient_profiles
    (mrn, profile_id, name, sex, birth_date, phone, village, district, province, created_by)
  values (
    'TB-' || to_char(v_now, 'YYMM') || '-' || lpad(nextval('public.patient_mrn_seq')::text, 4, '0'),
    v_uid,
    coalesce(nullif(btrim(v_row.personal ->> 'fullName'), ''), v_profile.full_name, 'Patient'),
    nullif(v_row.personal ->> 'sex', ''),
    nullif(v_row.personal ->> 'birthDate', '')::date,
    nullif(v_row.personal ->> 'phone', ''),
    coalesce(v_row.address ->> 'village', ''),
    coalesce(v_row.address ->> 'district', ''),
    coalesce(v_row.address ->> 'province', ''),
    v_uid
  )
  on conflict (profile_id) do update
    set name = excluded.name,
        sex = excluded.sex,
        birth_date = excluded.birth_date,
        phone = excluded.phone,
        village = excluded.village,
        district = excluded.district,
        province = excluded.province;

  update public.profiles
  set full_name = coalesce(nullif(btrim(v_row.personal ->> 'fullName'), ''), full_name)
  where id = v_uid;

  perform public.write_audit(
    v_uid, 'onboarding.completed', v_profile.email,
    case when coalesce(p_health_info, false)
      then 'Consented to health information use.'
      else 'Declined health information use.' end
  );

  return v_row;
end;
$$;

-- Changing the health-information consent after onboarding. Withdrawing it
-- clears the answers rather than flipping a flag.
create or replace function public.set_health_consent(p_health_info boolean)
returns public.patient_onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_onboarding;
begin
  if public.current_account_role() <> 'patient' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  update public.patient_onboarding
  set consent_health_info = coalesce(p_health_info, false),
      health = case when coalesce(p_health_info, false) then health else null end
  where profile_id = auth.uid() and completed_at is not null
  returning * into v_row;

  if not found then
    raise exception 'Onboarding has not been completed' using errcode = 'P0002';
  end if;

  perform public.write_audit(
    auth.uid(), 'consent.health-info-changed',
    (select email from public.profiles where id = auth.uid()),
    case when coalesce(p_health_info, false)
      then 'Health information sharing turned on.'
      else 'Health information sharing withdrawn; answers cleared.' end
  );
  return v_row;
end;
$$;

-- Lets a patient go back and edit their details; completion gates the app, so
-- reopening it sends them to the wizard again.
create or replace function public.reopen_patient_onboarding(p_step integer)
returns public.patient_onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.patient_onboarding;
begin
  if public.current_account_role() <> 'patient' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  update public.patient_onboarding
  set completed_at = null, step = least(greatest(coalesce(p_step, 0), 0), 2)
  where profile_id = auth.uid()
  returning * into v_row;
  if not found then
    raise exception 'Onboarding not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Follow-ups and referrals may only point at records of the same patient.
create or replace function public.guard_follow_up_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referral_id is not null
     and not exists (select 1 from public.referrals r
                     where r.id = new.referral_id and r.patient_id = new.patient_id) then
    raise exception 'Referral does not belong to this patient' using errcode = '23514';
  end if;
  if new.screening_id is not null
     and public.screening_patient_id(new.screening_id) is distinct from new.patient_id then
    raise exception 'Screening does not belong to this patient' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger follow_up_records_guard_links
  before insert or update of patient_id, referral_id, screening_id on public.follow_up_records
  for each row execute function public.guard_follow_up_links();
