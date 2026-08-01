begin;

create or replace function private.storage_object_profile_avatar_owner_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile/avatar\.(png|jpe?g|webp|gif)$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function private.storage_object_profile_avatar_owner_id(text) from public, anon;
grant execute on function private.storage_object_profile_avatar_owner_id(text) to authenticated;

update storage.buckets set public = false where id = 'doc2quiz';
alter table storage.objects enable row level security;

drop policy if exists doc2quiz_storage_select_own on storage.objects;
drop policy if exists doc2quiz_storage_insert_own on storage.objects;
drop policy if exists doc2quiz_storage_update_own on storage.objects;
drop policy if exists doc2quiz_storage_delete_own on storage.objects;
drop policy if exists doc2quiz_storage_select_own_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_insert_own_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_update_own_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_delete_own_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_select_friend_profile_avatar on storage.objects;

create policy doc2quiz_storage_select_own_profile_avatar on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) = (select auth.uid())
  );

create policy doc2quiz_storage_insert_own_profile_avatar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) = (select auth.uid())
  );

create policy doc2quiz_storage_update_own_profile_avatar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) = (select auth.uid())
  )
  with check (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) = (select auth.uid())
  );

create policy doc2quiz_storage_delete_own_profile_avatar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) = (select auth.uid())
  );

commit;
