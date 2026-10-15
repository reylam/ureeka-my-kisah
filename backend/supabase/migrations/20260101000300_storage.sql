-- Private storage for chest X-ray images.
--
-- The bucket is private and storage.objects gets no policy for the anon or
-- authenticated roles, so a browser holding only a user JWT cannot list,
-- download or upload anything. The backend (service role) checks access to
-- the screening first and then hands out short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screening-images',
  'screening-images',
  false,
  15728640,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
