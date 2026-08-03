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

create or replace function public.resolve_friend_user(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select p.id into v_other_user_id
  from public.profiles p
  where p.username_normalized = private.normalize_username(p_username);

  if not private.social_are_accepted_friends(v_user_id, v_other_user_id) then
    raise exception 'social_unavailable';
  end if;

  return jsonb_build_object('userId', v_other_user_id);
end;
$$;

revoke all on function public.resolve_friend_user(text) from public, anon;
grant execute on function public.resolve_friend_user(text) to authenticated;

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

create or replace function public.list_social_friends(
  p_limit integer,
  p_cursor jsonb default null,
  p_presence text default 'offline'
) returns jsonb
language sql
security definer
set search_path = public
as $$
with owned as (
  select case when fr.sender_id = auth.uid() then fr.recipient_id else fr.sender_id end user_id
  from public.friend_requests fr
  where auth.uid() is not null
    and fr.status = 'accepted'
    and auth.uid() in (fr.sender_id, fr.recipient_id)
), rows as (
  select
    o.user_id,
    p.username,
    p.avatar_path,
    case
      when a.last_active_at >= now() - interval '5 minutes' then 0
      when a.last_active_at is not null then 1
      else 2
    end presence_rank,
    a.last_active_at
  from owned o
  join public.profiles p on p.id = o.user_id
  left join private.social_activity a on a.user_id = o.user_id
  where not private.social_users_blocked(auth.uid(), o.user_id)
    and p_presence in ('online', 'offline')
    and (
      (p_presence = 'online' and case when a.last_active_at >= now() - interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end = 0)
      or (p_presence = 'offline' and case when a.last_active_at >= now() - interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end in (1, 2))
    )
), page as (
  select *
  from rows
  where p_cursor is null
     or (presence_rank, coalesce(username, ''), user_id::text) > ((p_cursor->>0)::int, p_cursor->>1, p_cursor->>2)
  order by presence_rank, coalesce(username, ''), user_id
  limit least(greatest(p_limit, 1), 51)
)
select jsonb_build_object(
  'items', coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'username', username,
      'avatarPath', avatar_path,
      'presenceRank', presence_rank,
      'presence', case presence_rank when 0 then 'online' when 1 then 'recently_active' else 'offline' end,
      'lastActiveAt', last_active_at
    ) order by presence_rank, coalesce(username, ''), user_id
  ), '[]'),
  'totalCount', (select count(*) from rows)
)
from page
$$;

drop policy if exists doc2quiz_storage_select_friend_profile_avatar on storage.objects;
drop policy if exists doc2quiz_storage_select_profile_avatar on storage.objects;
create policy doc2quiz_storage_select_profile_avatar on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and private.storage_object_profile_avatar_owner_id(name) is not null
  );

commit;
