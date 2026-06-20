-- Tighten the private-documents bucket INSERT policy.
--
-- Original (in 001_initial_schema.sql) allowed any authenticated user to write
-- anywhere in the bucket — meaning user A could overwrite user B's documents
-- under B's folder. The replacement constrains writes to paths of the form
--   {owner_type}/{auth.uid()}/...
-- where owner_type is the literal 'provider' or 'driver'. Reads + updates
-- already require owner = auth.uid() (or admin), so the path guard only
-- matters for INSERT, but we apply the same prefix check to UPDATE for
-- defence-in-depth (otherwise a user could rename their own object into
-- someone else's folder).

drop policy if exists "Authenticated users can upload private documents"
  on storage.objects;

create policy "Authenticated users upload into their own folder"
on storage.objects for insert
with check (
  bucket_id = 'private-documents'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] in ('provider', 'driver')
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Document owners and admins can update private documents"
  on storage.objects;

create policy "Document owners and admins can update private documents"
on storage.objects for update
using (
  bucket_id = 'private-documents'
  and (owner = auth.uid() or public.is_admin())
)
with check (
  bucket_id = 'private-documents'
  and (owner = auth.uid() or public.is_admin())
  and (storage.foldername(name))[1] in ('provider', 'driver')
  and (storage.foldername(name))[2] = auth.uid()::text
);
