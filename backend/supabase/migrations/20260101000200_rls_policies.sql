-- Row Level Security and grants.
--
-- Principles (frontend/docs/api-contract.md):
--   * patients see only their own records
--   * professionals see only patients at their own facility ("assigned")
--   * administrators manage accounts, facilities and record metadata, and are
--     deliberately NOT clinical: no screening reports, no images, no reviews
--   * the public sees published facilities and nothing else
--
-- The backend queries with the caller's JWT, so these policies are the real
-- enforcement. Backend middleware repeats the checks for clearer errors.
--
-- Grants are closed first and opened per column where a table has fields a
-- client must never write (role, status, consent, image paths, analysis ...).

-- ── Close everything, then open deliberately ────────────────────────────────

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Functions the policies call, and the RPCs the backend exposes.
grant execute on function
  public.current_account_role(),
  public.is_admin(),
  public.is_professional(),
  public.staff_facility_id(),
  public.staff_can_review(),
  public.my_patient_id(),
  public.is_assigned_to_patient(uuid),
  public.screening_patient_id(uuid)
to anon, authenticated;

grant execute on function
  public.set_referral_status(uuid, text, text),
  public.admin_set_account_role(uuid, text),
  public.admin_set_account_status(uuid, text),
  public.admin_upsert_staff_profile(uuid, text, uuid, boolean, text),
  public.admin_remove_staff_profile(uuid),
  public.list_staff(),
  public.touch_last_sign_in(timestamptz),
  public.complete_patient_onboarding(boolean, boolean),
  public.set_health_consent(boolean),
  public.reopen_patient_onboarding(integer)
to authenticated;

-- Code defaults call nextval() as the inserting role.
grant usage on sequence
  public.patient_mrn_seq, public.referral_code_seq, public.follow_up_code_seq
to authenticated;

-- ── profiles ────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;
-- Role and status are not grantable columns: only the admin_* functions and
-- trusted server contexts change them.
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.current_account_role() is not null)
  with check (id = auth.uid());

-- ── healthcare_facilities ───────────────────────────────────────────────────

alter table public.healthcare_facilities enable row level security;

grant select on public.healthcare_facilities to anon, authenticated;
grant insert, update, delete on public.healthcare_facilities to authenticated;

create policy facilities_select_public on public.healthcare_facilities
  for select to anon
  using (published);

create policy facilities_select_auth on public.healthcare_facilities
  for select to authenticated
  using (
    published
    or public.is_admin()
    or id = public.staff_facility_id()
  );

create policy facilities_admin_insert on public.healthcare_facilities
  for insert to authenticated
  with check (public.is_admin() and not published);

create policy facilities_admin_update on public.healthcare_facilities
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy facilities_admin_delete on public.healthcare_facilities
  for delete to authenticated
  using (public.is_admin());

-- ── healthcare_professional_profiles ────────────────────────────────────────

alter table public.healthcare_professional_profiles enable row level security;

-- Written only through admin_upsert_staff_profile / admin_remove_staff_profile.
grant select on public.healthcare_professional_profiles to authenticated;

create policy staff_select on public.healthcare_professional_profiles
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ── patient_profiles ────────────────────────────────────────────────────────

alter table public.patient_profiles enable row level security;

grant select on public.patient_profiles to authenticated;
grant insert (name, sex, birth_date, phone, village, district, province,
              home_facility_id, risk_factors, household_contacts, created_by)
  on public.patient_profiles to authenticated;
grant update (name, sex, birth_date, phone, village, district, province,
              home_facility_id, risk_factors, household_contacts)
  on public.patient_profiles to authenticated;

create policy patients_select on public.patient_profiles
  for select to authenticated
  using (
    (profile_id = auth.uid() and public.current_account_role() = 'patient')
    or public.is_admin()
    or public.is_assigned_to_patient(id)
  );

create policy patients_insert on public.patient_profiles
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (public.is_professional() and home_facility_id = public.staff_facility_id())
      or public.is_admin()
    )
  );

create policy patients_update on public.patient_profiles
  for update to authenticated
  using (
    (profile_id = auth.uid() and public.current_account_role() = 'patient')
    or public.is_admin()
    or public.is_assigned_to_patient(id)
  )
  with check (
    (profile_id = auth.uid() and public.current_account_role() = 'patient')
    or public.is_admin()
    or public.is_professional()
  );

-- ── patient_onboarding ──────────────────────────────────────────────────────

alter table public.patient_onboarding enable row level security;

grant select on public.patient_onboarding to authenticated;
-- Consent and completion are written by complete_patient_onboarding /
-- set_health_consent only.
grant insert (profile_id, step, personal, address, health) on public.patient_onboarding to authenticated;
grant update (step, personal, address, health) on public.patient_onboarding to authenticated;

create policy onboarding_select on public.patient_onboarding
  for select to authenticated
  using (profile_id = auth.uid() and public.current_account_role() = 'patient');

create policy onboarding_insert on public.patient_onboarding
  for insert to authenticated
  with check (profile_id = auth.uid() and public.current_account_role() = 'patient');

create policy onboarding_update on public.patient_onboarding
  for update to authenticated
  using (profile_id = auth.uid() and public.current_account_role() = 'patient')
  with check (profile_id = auth.uid());

-- ── patient_notes ───────────────────────────────────────────────────────────

alter table public.patient_notes enable row level security;

grant select on public.patient_notes to authenticated;
grant insert (patient_id, author_id, body, context, context_id) on public.patient_notes to authenticated;

create policy notes_select on public.patient_notes
  for select to authenticated
  using (public.is_assigned_to_patient(patient_id));

create policy notes_insert on public.patient_notes
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_assigned_to_patient(patient_id));

-- ── screenings (workflow metadata) ──────────────────────────────────────────

alter table public.screenings enable row level security;

grant select, delete on public.screenings to authenticated;
grant insert (patient_id, facility_id, operator_id, performed_at, status, image_quality, created_offline)
  on public.screenings to authenticated;
grant update (status, image_quality) on public.screenings to authenticated;

create policy screenings_select on public.screenings
  for select to authenticated
  using (
    (patient_id = public.my_patient_id() and status <> 'draft')
    or public.is_admin()
    or public.is_assigned_to_patient(patient_id)
  );

create policy screenings_insert on public.screenings
  for insert to authenticated
  with check (
    public.is_professional()
    and operator_id = auth.uid()
    and facility_id = public.staff_facility_id()
    and public.is_assigned_to_patient(patient_id)
    and performed_at <= now() + interval '5 minutes'
  );

-- Operators complete their own drafts; everything after is trigger-driven.
create policy screenings_update_draft on public.screenings
  for update to authenticated
  using (public.is_professional() and operator_id = auth.uid() and status = 'draft')
  with check (operator_id = auth.uid());

create policy screenings_delete_draft on public.screenings
  for delete to authenticated
  using (public.is_professional() and operator_id = auth.uid() and status = 'draft');

-- ── screening_reports (clinical content, never admin) ───────────────────────

alter table public.screening_reports enable row level security;

grant select on public.screening_reports to authenticated;
-- image_path / image_meta / model_status / analysis are written by the backend
-- with the service role, after it has checked access and validated the file.
grant insert (screening_id, symptoms, vitals) on public.screening_reports to authenticated;
grant update (symptoms, vitals) on public.screening_reports to authenticated;

create policy reports_select on public.screening_reports
  for select to authenticated
  using (public.is_assigned_to_patient(public.screening_patient_id(screening_id)));

create policy reports_insert on public.screening_reports
  for insert to authenticated
  with check (
    exists (
      select 1 from public.screenings s
      where s.id = screening_id
        and s.operator_id = auth.uid()
        and s.status in ('draft', 'queued')
    )
    and public.is_professional()
  );

create policy reports_update on public.screening_reports
  for update to authenticated
  using (
    public.is_professional()
    and exists (
      select 1 from public.screenings s
      where s.id = screening_id and s.operator_id = auth.uid() and s.status = 'draft'
    )
  )
  with check (true);

-- ── screening_reviews ───────────────────────────────────────────────────────

alter table public.screening_reviews enable row level security;

grant select on public.screening_reviews to authenticated;
grant insert (screening_id, reviewer_id, agreement, decision, notes)
  on public.screening_reviews to authenticated;

-- A patient may read the review of their own screening (the page leads with
-- what the care team wrote). Administrators cannot.
create policy reviews_select on public.screening_reviews
  for select to authenticated
  using (
    public.screening_patient_id(screening_id) = public.my_patient_id()
    or public.is_assigned_to_patient(public.screening_patient_id(screening_id))
  );

create policy reviews_insert on public.screening_reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and public.staff_can_review()
    and public.is_assigned_to_patient(public.screening_patient_id(screening_id))
  );

-- ── referrals ───────────────────────────────────────────────────────────────

alter table public.referrals enable row level security;

grant select on public.referrals to authenticated;
grant insert (patient_id, screening_id, from_facility_id, to_facility_id, reason,
              requested_service, priority, status, appointment_date, assigned_worker_id, created_by)
  on public.referrals to authenticated;
-- status is changed only through set_referral_status (which writes the event).
grant update (to_facility_id, reason, requested_service, priority, appointment_date, assigned_worker_id)
  on public.referrals to authenticated;

create policy referrals_select on public.referrals
  for select to authenticated
  using (
    patient_id = public.my_patient_id()
    or public.is_assigned_to_patient(patient_id)
  );

create policy referrals_insert on public.referrals
  for insert to authenticated
  with check (
    public.is_professional()
    and created_by = auth.uid()
    and from_facility_id = public.staff_facility_id()
    and status in ('draft', 'pending')
    and public.is_assigned_to_patient(patient_id)
  );

create policy referrals_update on public.referrals
  for update to authenticated
  using (public.is_assigned_to_patient(patient_id))
  with check (public.is_assigned_to_patient(patient_id));

alter table public.referral_events enable row level security;

grant select on public.referral_events to authenticated;

create policy referral_events_select on public.referral_events
  for select to authenticated
  using (
    exists (
      select 1 from public.referrals r
      where r.id = referral_id
        and (r.patient_id = public.my_patient_id() or public.is_assigned_to_patient(r.patient_id))
    )
  );

-- ── follow-ups ──────────────────────────────────────────────────────────────

alter table public.follow_up_records enable row level security;

grant select on public.follow_up_records to authenticated;
grant insert (patient_id, referral_id, screening_id, reason, due_date, assigned_worker_id, created_by)
  on public.follow_up_records to authenticated;
grant update (due_date, status, assigned_worker_id, completed_at, unresolved_reason)
  on public.follow_up_records to authenticated;

create policy follow_ups_select on public.follow_up_records
  for select to authenticated
  using (
    patient_id = public.my_patient_id()
    or public.is_assigned_to_patient(patient_id)
  );

create policy follow_ups_insert on public.follow_up_records
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_assigned_to_patient(patient_id)
  );

create policy follow_ups_update on public.follow_up_records
  for update to authenticated
  using (public.is_assigned_to_patient(patient_id))
  with check (public.is_assigned_to_patient(patient_id));

alter table public.follow_up_attempts enable row level security;

grant select on public.follow_up_attempts to authenticated;
grant insert (follow_up_id, actor_id, channel, outcome, note) on public.follow_up_attempts to authenticated;

create policy follow_up_attempts_select on public.follow_up_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.follow_up_records f
      where f.id = follow_up_id
        and (f.patient_id = public.my_patient_id() or public.is_assigned_to_patient(f.patient_id))
    )
  );

create policy follow_up_attempts_insert on public.follow_up_attempts
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.follow_up_records f
      where f.id = follow_up_id and public.is_assigned_to_patient(f.patient_id)
    )
  );

-- ── educational_progress ────────────────────────────────────────────────────

alter table public.educational_progress enable row level security;

grant select, insert, delete on public.educational_progress to authenticated;

create policy progress_select on public.educational_progress
  for select to authenticated
  using (profile_id = auth.uid());

create policy progress_insert on public.educational_progress
  for insert to authenticated
  with check (profile_id = auth.uid() and public.current_account_role() is not null);

create policy progress_delete on public.educational_progress
  for delete to authenticated
  using (profile_id = auth.uid());

-- ── audit_logs ──────────────────────────────────────────────────────────────

alter table public.audit_logs enable row level security;

-- Read-only for administrators. Inserts come from the backend (service role)
-- and the security-definer functions; triggers block update/delete for all.
grant select on public.audit_logs to authenticated;

create policy audit_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());
