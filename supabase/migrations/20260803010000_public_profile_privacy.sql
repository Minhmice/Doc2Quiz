begin;

create or replace function public.resolve_profile_user(p_username text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('userId', p.id)
  from public.profiles p
  where p.username_normalized = private.normalize_username(p_username)
$$;

revoke all on function public.resolve_profile_user(text) from public, anon;
grant execute on function public.resolve_profile_user(text) to authenticated;

create or replace function public.get_friend_profile(p_other_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  perform private.social_require_friend(p_other_user_id);
  select p.* into v_profile from public.profiles p where p.id = p_other_user_id;
  if not found then raise exception 'social_unavailable'; end if;
  return jsonb_build_object(
    'displayName', coalesce(v_profile.display_name, v_profile.username, 'Student'),
    'username', v_profile.username,
    'bio', coalesce(v_profile.bio, ''),
    'avatarPath', v_profile.avatar_path
  );
end;
$$;

create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'displayName', coalesce(p.display_name, p.username, 'Student'),
    'username', p.username,
    'bio', coalesce(p.bio, ''),
    'avatarPath', p.avatar_path
  )
  from public.profiles p
  where p.id = p_user_id
$$;

revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

drop policy if exists doc2quiz_storage_select_friend_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_select_profile_avatar on storage.objects;
create policy doc2quiz_storage_select_profile_avatar on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) is not null
  );

commit;
