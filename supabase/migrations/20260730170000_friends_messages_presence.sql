begin;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint direct_conversations_distinct_users check (user_low_id < user_high_id),
  unique (user_low_id, user_high_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000 and body = btrim(body)),
  created_at timestamptz not null default now()
);

create table if not exists private.social_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now()
);

create table if not exists public.reaction_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  blocked_sender_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  constraint reaction_preferences_no_null_blocks check (array_position(blocked_sender_ids, null) is null)
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc);
create index if not exists direct_conversations_last_message_idx
  on public.direct_conversations (last_message_at desc);
create index if not exists social_activity_last_active_idx
  on private.social_activity (last_active_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.reaction_preferences enable row level security;

revoke all on table public.direct_conversations, public.direct_messages, public.reaction_preferences from anon, authenticated;
revoke all on table private.social_activity from public, anon, authenticated;

create or replace function private.social_are_accepted_friends(p_user_a uuid, p_user_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user_a is not null and p_user_b is not null and p_user_a <> p_user_b
    and not private.social_users_blocked(p_user_a, p_user_b)
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.sender_id = p_user_a and fr.recipient_id = p_user_b)
          or (fr.sender_id = p_user_b and fr.recipient_id = p_user_a))
    );
$$;
revoke all on function private.social_are_accepted_friends(uuid, uuid) from public, anon;

create or replace function private.social_require_friend(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not private.social_are_accepted_friends(v_user_id, p_other_user_id) then
    raise exception 'social_unavailable';
  end if;
  return v_user_id;
end;
$$;
revoke all on function private.social_require_friend(uuid) from public, anon;

create or replace function public.list_accepted_friends()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_friends jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', friend_id, 'username', username, 'isOnline', last_active_at >= now() - interval '5 minutes',
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

create or replace function public.list_incoming_friend_requests()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_requests jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', fr.id, 'userId', fr.sender_id, 'username', p.username, 'createdAt', fr.created_at) order by fr.created_at desc), '[]'::jsonb)
  into v_requests from public.friend_requests fr join public.profiles p on p.id = fr.sender_id
  where fr.recipient_id = v_user_id and fr.status = 'pending' and not private.social_users_blocked(v_user_id, fr.sender_id);
  return jsonb_build_object('count', jsonb_array_length(v_requests), 'requests', v_requests);
end;
$$;

create or replace function public.open_direct_conversation(p_other_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := private.social_require_friend(p_other_user_id); v_id uuid;
begin
  insert into public.direct_conversations(user_low_id, user_high_id)
  values (least(v_user_id, p_other_user_id), greatest(v_user_id, p_other_user_id))
  on conflict (user_low_id, user_high_id) do update set last_message_at = direct_conversations.last_message_at
  returning id into v_id;
  return jsonb_build_object('conversationId', v_id);
end;
$$;

create or replace function public.list_direct_messages(p_conversation_id uuid, p_before timestamptz default null, p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_messages jsonb;
begin
  if v_user_id is null or p_conversation_id is null or p_limit not between 1 and 100 then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id
  from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'senderId', sender_id, 'body', body, 'createdAt', created_at) order by created_at desc), '[]'::jsonb)
  into v_messages from (select * from public.direct_messages where conversation_id = p_conversation_id and (p_before is null or created_at < p_before) order by created_at desc limit p_limit) m;
  return jsonb_build_object('messages', v_messages);
end;
$$;

create or replace function public.send_direct_message(p_conversation_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_message_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user_id is null or p_conversation_id is null or char_length(v_body) not between 1 and 2000 then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id
  from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id) for update;
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  insert into public.direct_messages(conversation_id, sender_id, body) values (p_conversation_id, v_user_id, v_body) returning id into v_message_id;
  update public.direct_conversations set last_message_at = now() where id = p_conversation_id;
  return jsonb_build_object('id', v_message_id, 'senderId', v_user_id, 'body', v_body, 'createdAt', now());
end;
$$;

create or replace function public.update_reaction_preferences(p_enabled boolean, p_blocked_sender_ids uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_enabled is null or array_position(coalesce(p_blocked_sender_ids, '{}'::uuid[]), v_user_id) is not null then raise exception 'social_unavailable'; end if;
  insert into public.reaction_preferences(user_id, enabled, blocked_sender_ids) values (v_user_id, p_enabled, coalesce(p_blocked_sender_ids, '{}'::uuid[]))
  on conflict (user_id) do update set enabled = excluded.enabled, blocked_sender_ids = excluded.blocked_sender_ids, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.send_preset_reaction(p_recipient_user_id uuid, p_reaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sender_id uuid := private.social_require_friend(p_recipient_user_id); v_enabled boolean; v_blocked uuid[];
begin
  if p_reaction_id not in ('xin_chao', 'co_len', 'dinh_qua', 'qua_hay', 'ban_gioi', 'thu_gian', 'good_luck', 'tuyet_voi') then raise exception 'social_unavailable'; end if;
  select enabled, blocked_sender_ids into v_enabled, v_blocked from public.reaction_preferences where user_id = p_recipient_user_id;
  if coalesce(v_enabled, true) is false or v_sender_id = any(coalesce(v_blocked, '{}'::uuid[])) then raise exception 'social_unavailable'; end if;
  return jsonb_build_object('recipientUserId', p_recipient_user_id, 'senderId', v_sender_id, 'reactionId', p_reaction_id);
end;
$$;

create or replace function public.touch_social_activity()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_last_active_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select last_active_at into v_last_active_at from private.social_activity where user_id = v_user_id for update;
  if v_last_active_at is null or v_last_active_at < now() - interval '1 minute' then
    insert into private.social_activity(user_id, last_active_at) values (v_user_id, now())
    on conflict (user_id) do update set last_active_at = excluded.last_active_at;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.list_accepted_friends(), public.list_incoming_friend_requests(), public.open_direct_conversation(uuid), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text), public.update_reaction_preferences(boolean, uuid[]), public.send_preset_reaction(uuid, text), public.touch_social_activity() from public, anon;
grant execute on function public.list_accepted_friends(), public.list_incoming_friend_requests(), public.open_direct_conversation(uuid), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text), public.update_reaction_preferences(boolean, uuid[]), public.send_preset_reaction(uuid, text), public.touch_social_activity() to authenticated;

alter table realtime.messages enable row level security;
drop policy if exists "social reaction recipient broadcasts" on realtime.messages;
create policy "social reaction recipient broadcasts" on realtime.messages for select to authenticated using (
  extension = 'broadcast'
  and realtime.topic() = 'social-reactions:' || auth.uid()::text
);
drop policy if exists "social conversation broadcasts" on realtime.messages;
create policy "social conversation broadcasts" on realtime.messages for select to authenticated using (
  extension = 'broadcast'
  and exists (
    select 1 from public.direct_conversations c
    where realtime.topic() = 'social-messages:' || c.id::text
      and auth.uid() in (c.user_low_id, c.user_high_id)
      and private.social_are_accepted_friends(c.user_low_id, c.user_high_id)
  )
);

commit;
