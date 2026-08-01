begin;

create or replace function public.list_accepted_friends()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_friends jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', friend_id,
    'username', username,
    'avatarPath', avatar_path,
    'isOnline', last_active_at >= now() - interval '5 minutes',
    'lastActiveAt', case when last_active_at is null then null else last_active_at end
  ) order by (last_active_at >= now() - interval '5 minutes') desc, username), '[]'::jsonb) into v_friends
  from (
    select case when fr.sender_id = v_user_id then fr.recipient_id else fr.sender_id end friend_id
    from public.friend_requests fr
    where fr.status = 'accepted' and (fr.sender_id = v_user_id or fr.recipient_id = v_user_id)
  ) accepted
  join public.profiles p on p.id = accepted.friend_id
  left join private.social_activity a on a.user_id = accepted.friend_id
  where not private.social_users_blocked(v_user_id, accepted.friend_id);
  return jsonb_build_object('friends', v_friends);
end;
$$;

commit;
