-- Phase 10 social safety: list/respond/cancel friend requests and list blocks.
begin;

create or replace function public.list_friend_requests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requests jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'direction', case when fr.sender_id = v_user_id then 'outgoing' else 'incoming' end,
        'otherUserId', case when fr.sender_id = v_user_id then fr.recipient_id else fr.sender_id end,
        'otherUsername', p.username,
        'status', fr.status,
        'createdAt', fr.created_at
      )
      order by fr.created_at desc
    ),
    '[]'::jsonb
  )
  into v_requests
  from public.friend_requests fr
  left join public.profiles p
    on p.id = case when fr.sender_id = v_user_id then fr.recipient_id else fr.sender_id end
  where fr.status = 'pending'
    and (fr.sender_id = v_user_id or fr.recipient_id = v_user_id);

  return jsonb_build_object('requests', v_requests);
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_sender_id uuid;
  v_recipient_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_request_id is null or v_action not in ('accept', 'decline') then
    raise exception 'request_unavailable';
  end if;

  select fr.sender_id, fr.recipient_id
  into v_sender_id, v_recipient_id
  from public.friend_requests fr
  where fr.id = p_request_id
    and fr.status = 'pending'
    and fr.recipient_id = v_user_id
  for update;

  if not found then
    raise exception 'request_unavailable';
  end if;

  if private.social_users_blocked(v_user_id, v_sender_id) then
    raise exception 'request_unavailable';
  end if;

  update public.friend_requests fr
  set status = case when v_action = 'accept' then 'accepted' else 'declined' end,
      responded_at = now()
  where fr.id = p_request_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_request_id is null then
    raise exception 'request_unavailable';
  end if;

  update public.friend_requests fr
  set status = 'cancelled',
      responded_at = now()
  where fr.id = p_request_id
    and fr.sender_id = v_user_id
    and fr.status = 'pending';

  if not found then
    raise exception 'request_unavailable';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.list_blocked_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_blocks jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', b.blocked_id,
        'username', p.username,
        'blockedAt', b.created_at
      )
      order by b.created_at desc
    ),
    '[]'::jsonb
  )
  into v_blocks
  from public.user_blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = v_user_id;

  return jsonb_build_object('blocks', v_blocks);
end;
$$;

revoke all on function public.list_friend_requests() from public;
revoke all on function public.list_friend_requests() from anon;
grant execute on function public.list_friend_requests() to authenticated;

revoke all on function public.respond_friend_request(uuid, text) from public;
revoke all on function public.respond_friend_request(uuid, text) from anon;
grant execute on function public.respond_friend_request(uuid, text) to authenticated;

revoke all on function public.cancel_friend_request(uuid) from public;
revoke all on function public.cancel_friend_request(uuid) from anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

revoke all on function public.list_blocked_users() from public;
revoke all on function public.list_blocked_users() from anon;
grant execute on function public.list_blocked_users() to authenticated;

commit;
