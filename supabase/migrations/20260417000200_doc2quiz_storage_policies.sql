-- Supabase Storage policies for Doc2Quiz assets
-- Assumes you store files in a single bucket, e.g. bucket_id = 'doc2quiz'.
-- Recommended: when uploading, set `owner` on storage.objects to auth.uid().

begin;

-- Ensure Storage RLS is enabled (usually already true in Supabase projects).
alter table if exists storage.objects enable row level security;

-- Drop old policies if they exist (idempotent).
drop policy if exists "doc2quiz_storage_select_own" on storage.objects;
drop policy if exists "doc2quiz_storage_insert_own" on storage.objects;
drop policy if exists "doc2quiz_storage_update_own" on storage.objects;
drop policy if exists "doc2quiz_storage_delete_own" on storage.objects;

-- Read your own objects in the Doc2Quiz bucket.
create policy "doc2quiz_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'doc2quiz'
  and owner = auth.uid()
);

-- Create objects in the Doc2Quiz bucket; must set owner = auth.uid().
create policy "doc2quiz_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'doc2quiz'
  and owner = auth.uid()
);

-- Update only your own objects in the Doc2Quiz bucket.
create policy "doc2quiz_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'doc2quiz'
  and owner = auth.uid()
)
with check (
  bucket_id = 'doc2quiz'
  and owner = auth.uid()
);

-- Delete only your own objects in the Doc2Quiz bucket.
create policy "doc2quiz_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'doc2quiz'
  and owner = auth.uid()
);

commit;

