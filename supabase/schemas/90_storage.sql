-- Storage bucket and effective object policies.

insert into storage.buckets (id, name, public)
values ('doc2quiz', 'doc2quiz', false)
on conflict (id) do nothing;

create policy doc2quiz_storage_select_workspace on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_view_workspace(private.storage_object_workspace_id(name)))
  );

create policy doc2quiz_storage_insert_workspace on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

create policy doc2quiz_storage_update_workspace on storage.objects
  for update to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  )
  with check (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

create policy doc2quiz_storage_delete_workspace on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

create policy doc2quiz_storage_select_friend_profile_avatar on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.social_are_accepted_friends(
      auth.uid(),
      private.storage_object_profile_avatar_owner_id(name)
    ))
  );

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
