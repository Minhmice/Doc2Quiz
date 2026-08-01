begin;

-- Keep username_normalized in sync when usernames are saved.
create or replace function public.set_profile_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  v_normalized := private.social_validate_username(p_username);

  update public.profiles
  set username = v_normalized,
      username_normalized = v_normalized,
      updated_at = now()
  where id = v_user_id;

  if not found then
    insert into public.profiles (id, username, username_normalized)
    values (v_user_id, v_normalized, v_normalized);
  end if;

  return jsonb_build_object('username', v_normalized);
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

-- Resolve recipients even when legacy rows only populated profiles.username.
create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_normalized text;
  v_recipient_id uuid;
  v_request_id uuid;
begin
  if v_sender_id is null then
    raise exception 'authentication_required';
  end if;

  v_normalized := private.social_validate_username(p_username);

  select p.id
  into v_recipient_id
  from public.profiles p
  where p.username_normalized = v_normalized
     or (
       p.username_normalized is null
       and p.username is not null
       and lower(btrim(p.username)) = v_normalized
     );

  if v_recipient_id is null
     or v_recipient_id = v_sender_id
     or private.social_users_blocked(v_sender_id, v_recipient_id) then
    raise exception 'request_unavailable';
  end if;

  if exists (
    select 1
    from public.friend_requests fr
    where fr.status = 'pending'
      and (
        (fr.sender_id = v_sender_id and fr.recipient_id = v_recipient_id)
        or (fr.sender_id = v_recipient_id and fr.recipient_id = v_sender_id)
      )
  ) then
    raise exception 'request_unavailable';
  end if;

  perform private.social_raise_rate_limited(v_sender_id);

  insert into public.friend_requests (sender_id, recipient_id, status)
  values (v_sender_id, v_recipient_id, 'pending')
  returning id into v_request_id;

  insert into private.social_friend_request_events (sender_id)
  values (v_sender_id);

  return jsonb_build_object('ok', true, 'requestId', v_request_id);
exception
  when unique_violation then
    raise exception 'request_unavailable';
end;
$$;

update public.profiles
set username_normalized = lower(btrim(username))
where username is not null
  and (username_normalized is null or username_normalized <> lower(btrim(username)));

revoke all on function public.set_profile_username(text) from public, anon;
grant execute on function public.set_profile_username(text) to authenticated;

revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

commit;
