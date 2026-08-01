begin;

create table if not exists public.direct_conversation_participants (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.direct_conversation_participants enable row level security;
revoke all on table public.direct_conversation_participants from anon, authenticated;

create index if not exists direct_conversation_participants_user_read_idx
  on public.direct_conversation_participants (user_id, read_at);

insert into public.direct_conversation_participants (conversation_id, user_id, read_at)
select id, user_low_id, last_message_at from public.direct_conversations
on conflict (conversation_id, user_id) do nothing;
insert into public.direct_conversation_participants (conversation_id, user_id, read_at)
select id, user_high_id, last_message_at from public.direct_conversations
on conflict (conversation_id, user_id) do nothing;

create or replace function public.open_direct_conversation(p_other_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := private.social_require_friend(p_other_user_id); v_id uuid;
begin
  insert into public.direct_conversations(user_low_id, user_high_id)
  values (least(v_user_id, p_other_user_id), greatest(v_user_id, p_other_user_id))
  on conflict (user_low_id, user_high_id) do update set last_message_at = direct_conversations.last_message_at
  returning id into v_id;
  insert into public.direct_conversation_participants (conversation_id, user_id)
  values (v_id, v_user_id), (v_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;
  return jsonb_build_object('conversationId', v_id);
end;
$$;

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
    'lastActiveAt', last_active_at,
    'unreadCount', unread_count
  ) order by (last_active_at >= now() - interval '5 minutes') desc, username), '[]'::jsonb) into v_friends
  from (
    select case when fr.sender_id = v_user_id then fr.recipient_id else fr.sender_id end friend_id
    from public.friend_requests fr
    where fr.status = 'accepted' and (fr.sender_id = v_user_id or fr.recipient_id = v_user_id)
  ) accepted
  join public.profiles p on p.id = accepted.friend_id
  left join private.social_activity a on a.user_id = accepted.friend_id
  left join public.direct_conversations c on (c.user_low_id = least(v_user_id, accepted.friend_id) and c.user_high_id = greatest(v_user_id, accepted.friend_id))
  left join public.direct_conversation_participants cp on cp.conversation_id = c.id and cp.user_id = v_user_id
  left join lateral (
    select count(*)::integer as unread_count
    from public.direct_messages m
    where m.conversation_id = c.id
      and m.sender_id = accepted.friend_id
      and m.created_at > coalesce(cp.read_at, '-infinity'::timestamptz)
  ) unread on true
  where not private.social_users_blocked(v_user_id, accepted.friend_id);
  return jsonb_build_object('friends', v_friends);
end;
$$;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid;
begin
  if v_user_id is null or p_conversation_id is null then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id
  from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  insert into public.direct_conversation_participants (conversation_id, user_id, read_at)
  values (p_conversation_id, v_user_id, now())
  on conflict (conversation_id, user_id) do update set read_at = greatest(direct_conversation_participants.read_at, excluded.read_at);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.mark_direct_conversation_read(uuid) from public, anon;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;

commit;
