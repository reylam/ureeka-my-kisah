-- Row Level Security, grants and storage.
--
--   * Staff (admin and radiologist) read every patient and every screening:
--     it is one clinic.
--   * Patients have no account. They reach their own request only through the
--     backend, with the access code, and see a narrow summary of it.
--   * Status, queue and code columns are never writable by a client. They
--     change only through the functions in 20260101000100_functions.sql.
--   * Image paths and model output are written by the backend's service role,
--     after the same request has loaded the screening through the caller's own
--     RLS-scoped client.
--
-- The backend queries with the caller's JWT, so these rules are the real
-- enforcement. The API repeats them for clearer errors.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant execute on function
  public.current_account_role(),
  public.is_admin(),
  public.is_radiologist(),
  public.is_staff()
to authenticated;

grant execute on function
  public.create_request(uuid, jsonb, text),
  public.set_screening_patient(uuid, uuid),
  public.start_screening(uuid),
  public.submit_screening(uuid, text),
  public.mark_served(uuid)
to authenticated;

-- The public request form goes through the backend with the service role.
grant execute on function public.create_request(uuid, jsonb, text) to service_role;
grant execute on function public.new_access_code() to service_role;

-- The MRN default calls nextval() as the inserting role.
grant usage on sequence public.patient_mrn_seq to authenticated;

-- ── profiles ────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

-- Your own row, and every staff row (names for "diperiksa oleh").
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or (public.is_staff() and role is not null));

-- ── patients ────────────────────────────────────────────────────────────────

alter table public.patients enable row level security;

grant select on public.patients to authenticated;
grant insert (name, sex, birth_date, phone, address, created_by) on public.patients to authenticated;
grant update (name, sex, birth_date, phone, address) on public.patients to authenticated;

create policy patients_select on public.patients
  for select to authenticated
  using (public.is_staff());

create policy patients_insert on public.patients
  for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());

create policy patients_update on public.patients
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── screenings ──────────────────────────────────────────────────────────────

alter table public.screenings enable row level security;

grant select on public.screenings to authenticated;
-- What the radiologist records while examining. Nothing else is client-writable.
grant update (symptoms, vitals, image_quality) on public.screenings to authenticated;
grant delete on public.screenings to authenticated;

create policy screenings_select on public.screenings
  for select to authenticated
  using (public.is_staff());

-- Only the radiologist who took the request, and only while examining.
create policy screenings_update on public.screenings
  for update to authenticated
  using (public.is_radiologist() and status = 'examining' and operator_id = auth.uid())
  with check (public.is_radiologist() and status = 'examining' and operator_id = auth.uid());

-- The administrator may cancel a request no one has started (a duplicate, a
-- no-show, spam from the public form).
create policy screenings_delete on public.screenings
  for delete to authenticated
  using (public.is_admin() and status = 'waiting');

-- ── Storage ─────────────────────────────────────────────────────────────────

-- Private bucket for the X-rays. storage.objects gets no policy for client
-- roles, so a browser cannot list, read or write it. The backend checks access
-- to the screening first and then hands out a short-lived signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screening-images', 'screening-images', false, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
