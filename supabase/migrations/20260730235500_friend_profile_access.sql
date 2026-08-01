begin;

create or replace function public.get_friend_profile(p_other_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := private.social_require_friend(p_other_user_id);
  v_profile public.profiles%rowtype;
begin
  select p.* into v_profile
  from public.profiles p
  where p.id = p_other_user_id;

  if not found then
    raise exception 'social_unavailable';
  end if;

  return jsonb_build_object(
    'displayName', coalesce(v_profile.display_name, v_profile.username, 'Student'),
    'username', v_profile.username,
    'bio', coalesce(v_profile.bio, ''),
    'avatarPath', v_profile.avatar_path
  );
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

commit;
