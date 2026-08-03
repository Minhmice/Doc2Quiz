-- Effective final functions, RPCs, triggers, and function permissions.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.record_study_mistake(
  target_set_id uuid, target_item_id uuid, target_mode text, practiced_at timestamptz default now()
) returns public.study_mistakes language plpgsql security invoker as $$
declare result public.study_mistakes;
begin
  if target_mode not in ('quiz', 'flashcard') then raise exception 'invalid study mode'; end if;
  insert into public.study_mistakes (user_id, study_set_id, item_id, mode, last_practiced_at)
  values (auth.uid(), target_set_id, target_item_id, target_mode, practiced_at)
  on conflict (user_id, study_set_id, mode, item_id) do update set
    unresolved = true,
    mistake_count = public.study_mistakes.mistake_count + 1,
    last_mistake_at = practiced_at,
    last_practiced_at = practiced_at,
    resolved_at = null
  returning * into result;
  return result;
end $$;

create or replace function public.resolve_study_mistake(
  target_set_id uuid, target_item_id uuid, target_mode text, practiced_at timestamptz default now()
) returns public.study_mistakes language plpgsql security invoker as $$
declare result public.study_mistakes;
begin
  update public.study_mistakes set unresolved = false, resolved_at = practiced_at, last_practiced_at = practiced_at
  where user_id = auth.uid() and study_set_id = target_set_id and item_id = target_item_id and mode = target_mode
  returning * into result;
  return result;
end $$;

create or replace function public.replace_quiz_questions(
  p_study_set_id uuid,
  p_expected_count integer,
  p_questions jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_expected_count < 1 or p_expected_count > 40 then
    raise exception 'Expected count must be between 1 and 40';
  end if;

  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Questions payload must be an array';
  end if;

  v_input_count := jsonb_array_length(p_questions);
  if v_input_count <> p_expected_count then
    raise exception 'Expected % questions, received %',
      p_expected_count, v_input_count;
  end if;

  if not exists (
    select 1
    from public.study_sets
    where id = p_study_set_id
      and user_id = v_user_id
  ) then
    raise exception 'Study set not found';
  end if;

  delete from public.approved_questions
  where study_set_id = p_study_set_id
    and user_id = v_user_id;

  insert into public.approved_questions (
    id,
    user_id,
    study_set_id,
    prompt,
    choices,
    correct_index,
    explanation,
    tags,
    source
  )
  select
    q.id,
    v_user_id,
    p_study_set_id,
    q.prompt,
    q.choices,
    q.correct_index,
    q.explanation,
    coalesce(q.tags, '{}'::text[]),
    coalesce(q.source, '{}'::jsonb)
  from jsonb_to_recordset(p_questions) as q(
    id uuid,
    user_id uuid,
    study_set_id uuid,
    prompt text,
    choices text[],
    correct_index smallint,
    explanation text,
    tags text[],
    source jsonb
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_count, v_inserted_count;
  end if;

  update public.study_sets
  set pipeline_stage = 'quiz',
      content_kind = 'quiz'
  where id = p_study_set_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Study set update failed';
  end if;

  return v_inserted_count;
end;
$$;

create or replace function public.replace_canonical_content(
  p_study_set_id uuid,
  p_canonical_markdown text,
  p_metadata jsonb,
  p_title text,
  p_expected_section_count integer,
  p_sections jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document_id uuid;
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_expected_section_count < 1 then
    raise exception 'Expected section count must be positive';
  end if;
  if jsonb_typeof(p_sections) <> 'array' then
    raise exception 'Sections payload must be an array';
  end if;

  v_input_count := jsonb_array_length(p_sections);
  if v_input_count <> p_expected_section_count then
    raise exception 'Expected % sections, received %',
      p_expected_section_count, v_input_count;
  end if;

  update public.canonical_documents
  set canonical_markdown = p_canonical_markdown,
      metadata = p_metadata
  where study_set_id = p_study_set_id
    and user_id = v_user_id
  returning id into v_document_id;

  if v_document_id is null then
    raise exception 'Canonical document not found';
  end if;

  delete from public.canonical_sections
  where canonical_document_id = v_document_id
    and user_id = v_user_id;

  insert into public.canonical_sections (
    user_id,
    canonical_document_id,
    ordinal,
    heading,
    body_markdown,
    section_type,
    section_key
  )
  select
    v_user_id,
    v_document_id,
    section.ordinal,
    section.heading,
    section.body_markdown,
    section.section_type,
    section.section_key
  from jsonb_to_recordset(p_sections) as section(
    ordinal integer,
    heading text,
    body_markdown text,
    section_type text,
    section_key text
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_section_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_section_count, v_inserted_count;
  end if;

  update public.study_sets
  set pipeline_stage = 'canonical',
      title = p_title
  where id = p_study_set_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Study set update failed';
  end if;

  return v_inserted_count;
end;
$$;

create or replace function public.quota_week_start_ict()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('week', timezone('Asia/Ho_Chi_Minh', now()))::date)::timestamp
         at time zone 'Asia/Ho_Chi_Minh';
$$;

create or replace function public.reclaim_expired_generation_reservations(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  refunded_bonus_count integer;
begin
  with released_bonus as (
    update public.quota_consumptions
    set state = 'released',
        released_at = now(),
        release_reason = 'expired',
        reservation_token = null
    where user_id = p_user_id
      and state = 'reserved'
      and reservation_expires_at <= now()
      and used_bonus
    returning 1
  )
  select count(*) into refunded_bonus_count from released_bonus;

  if refunded_bonus_count > 0 then
    update public.user_quota_wallet
    set bonus_credits = bonus_credits + refunded_bonus_count,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  update public.quota_consumptions
  set state = 'released',
      released_at = now(),
      release_reason = 'expired',
      reservation_token = null
  where user_id = p_user_id
    and state = 'reserved'
    and reservation_expires_at <= now();
end;
$$;

create or replace function public.reserve_generation_quota(p_study_set_id uuid, p_content_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  existing public.quota_consumptions%rowtype;
  weekly_slots integer;
  bonus_available boolean;
  token uuid := gen_random_uuid();
  expiry timestamptz := now() + interval '7 minutes';
begin
  if caller_id is null then
    raise exception 'authentication_required';
  end if;
  if p_content_kind not in ('quiz', 'flashcards') then
    raise exception 'invalid_content_kind';
  end if;
  if not exists (select 1 from public.study_sets where id = p_study_set_id and user_id = caller_id) then
    raise exception 'study_set_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  perform public.reclaim_expired_generation_reservations(caller_id);

  select * into existing
  from public.quota_consumptions
  where user_id = caller_id and study_set_id = p_study_set_id;

  if found and existing.state = 'committed' then
    return jsonb_build_object('status', 'already_committed', 'usedBonus', existing.used_bonus);
  end if;
  if found and existing.state = 'reserved' then
    return jsonb_build_object('status', 'generation_in_progress', 'reservationExpiresAt', existing.reservation_expires_at);
  end if;

  select count(*) into weekly_slots
  from public.quota_consumptions
  where user_id = caller_id
    and state in ('reserved', 'committed')
    and consumed_at >= public.quota_week_start_ict();

  if weekly_slots < 10 then
    insert into public.quota_consumptions (
      user_id, study_set_id, content_kind, state, reservation_token, reserved_at, reservation_expires_at, used_bonus
    ) values (
      caller_id, p_study_set_id, p_content_kind, 'reserved', token, now(), expiry, false
    )
    on conflict (user_id, study_set_id) do update
      set content_kind = excluded.content_kind,
          state = excluded.state,
          reservation_token = excluded.reservation_token,
          reserved_at = excluded.reserved_at,
          reservation_expires_at = excluded.reservation_expires_at,
          released_at = null,
          release_reason = null,
          used_bonus = false;
    return jsonb_build_object('status', 'reserved', 'reservationToken', token, 'usedBonus', false, 'reservationExpiresAt', expiry);
  end if;

  update public.user_quota_wallet
  set bonus_credits = bonus_credits - 1,
      updated_at = now()
  where user_id = caller_id and bonus_credits > 0
  returning true into bonus_available;

  if not coalesce(bonus_available, false) then
    return jsonb_build_object(
      'status', 'quota_exceeded',
      'weeklyUsed', (select count(*) from public.quota_consumptions where user_id = caller_id and state = 'committed' and consumed_at >= public.quota_week_start_ict()),
      'weeklyLimit', 10,
      'bonusCredits', 0,
      'weekResetsAt', public.quota_week_start_ict() + interval '7 days'
    );
  end if;

  insert into public.quota_consumptions (
    user_id, study_set_id, content_kind, state, reservation_token, reserved_at, reservation_expires_at, used_bonus
  ) values (
    caller_id, p_study_set_id, p_content_kind, 'reserved', token, now(), expiry, true
  )
  on conflict (user_id, study_set_id) do update
    set content_kind = excluded.content_kind,
        state = excluded.state,
        reservation_token = excluded.reservation_token,
        reserved_at = excluded.reserved_at,
        reservation_expires_at = excluded.reservation_expires_at,
        released_at = null,
        release_reason = null,
        used_bonus = true;

  return jsonb_build_object('status', 'reserved', 'reservationToken', token, 'usedBonus', true, 'reservationExpiresAt', expiry);
end;
$$;

create or replace function public.commit_generation_quota(p_reservation_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  reservation public.quota_consumptions%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  perform public.reclaim_expired_generation_reservations(caller_id);

  select * into reservation
  from public.quota_consumptions
  where user_id = caller_id and reservation_token = p_reservation_token;

  if not found then
    return jsonb_build_object('status', 'reservation_not_found');
  end if;
  if reservation.state <> 'reserved' then
    return jsonb_build_object('status', reservation.state);
  end if;

  update public.quota_consumptions
  set state = 'committed', committed_at = now(), reservation_expires_at = null
  where id = reservation.id;
  return jsonb_build_object('status', 'committed', 'usedBonus', reservation.used_bonus);
end;
$$;

create or replace function public.release_generation_quota(p_reservation_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  reservation public.quota_consumptions%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication_required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  select * into reservation
  from public.quota_consumptions
  where user_id = caller_id and reservation_token = p_reservation_token;

  if not found then
    return jsonb_build_object('status', 'already_released');
  end if;
  if reservation.state = 'committed' then
    return jsonb_build_object('status', 'already_committed');
  end if;
  if reservation.state = 'released' then
    return jsonb_build_object('status', 'already_released');
  end if;

  update public.quota_consumptions
  set state = 'released', released_at = now(), release_reason = 'released', reservation_token = null
  where id = reservation.id and state = 'reserved';
  if reservation.used_bonus then
    insert into public.user_quota_wallet (user_id, bonus_credits)
    values (caller_id, 1)
    on conflict (user_id) do update
      set bonus_credits = public.user_quota_wallet.bonus_credits + 1,
          updated_at = now();
  end if;
  return jsonb_build_object('status', 'released', 'usedBonus', reservation.used_bonus);
end;
$$;

create or replace function public.get_generation_quota_availability(p_study_set_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  existing public.quota_consumptions%rowtype;
  weekly_used integer;
  wallet_bonus_credits integer;
begin
  if caller_id is null then
    raise exception 'authentication_required';
  end if;
  if not exists (select 1 from public.study_sets where id = p_study_set_id and user_id = caller_id) then
    raise exception 'study_set_not_found';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  perform public.reclaim_expired_generation_reservations(caller_id);

  select * into existing from public.quota_consumptions where user_id = caller_id and study_set_id = p_study_set_id;
  if found and existing.state = 'committed' then
    return jsonb_build_object('status', 'already_committed', 'canGenerate', true);
  end if;
  if found and existing.state = 'reserved' then
    return jsonb_build_object('status', 'generation_in_progress', 'canGenerate', false, 'reservationExpiresAt', existing.reservation_expires_at);
  end if;

  select count(*) into weekly_used from public.quota_consumptions
  where user_id = caller_id and state = 'committed' and consumed_at >= public.quota_week_start_ict();
  select coalesce(wallet.bonus_credits, 0) into wallet_bonus_credits
  from public.user_quota_wallet as wallet
  where wallet.user_id = caller_id;

  return jsonb_build_object(
    'status', case when weekly_used < 10 or coalesce(wallet_bonus_credits, 0) > 0 then 'available' else 'quota_exceeded' end,
    'canGenerate', weekly_used < 10 or coalesce(wallet_bonus_credits, 0) > 0,
    'weeklyUsed', weekly_used,
    'weeklyLimit', 10,
    'bonusCredits', coalesce(wallet_bonus_credits, 0),
    'weekResetsAt', public.quota_week_start_ict() + interval '7 days'
  );
end;
$$;

create or replace function public.sync_profile_username_normalized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is null then
    new.username_normalized := null;
  else
    new.username_normalized := lower(btrim(new.username));
    new.username := new.username_normalized;
  end if;
  return new;
end;
$$;

create or replace function private.normalize_username(p_username text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(p_username));
$$;

create or replace function private.social_users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;

create or replace function private.social_raise_rate_limited(p_sender_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_retry_seconds integer;
begin
  select count(*)
  into v_count
  from private.social_friend_request_events e
  where e.sender_id = p_sender_id
    and e.created_at > now() - interval '1 hour';

  if v_count < 10 then
    return;
  end if;

  select ceil(extract(epoch from (min(e.created_at) + interval '1 hour' - now())))::integer
  into v_retry_seconds
  from private.social_friend_request_events e
  where e.sender_id = p_sender_id
    and e.created_at > now() - interval '1 hour';

  raise exception 'rate_limited'
    using detail = greatest(coalesce(v_retry_seconds, 1), 1)::text;
end;
$$;

create or replace function private.social_validate_username(p_username text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_normalized text := private.normalize_username(p_username);
begin
  if v_normalized is null or char_length(v_normalized) < 3 or char_length(v_normalized) > 30 then
    raise exception 'username_invalid';
  end if;
  if v_normalized !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'username_invalid';
  end if;
  return v_normalized;
end;
$$;

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

create or replace function public.block_user(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare v_uid uuid:=auth.uid(); begin
 if v_uid is null or p_user_id is null or p_user_id=v_uid then raise exception 'request_unavailable'; end if;
 insert into public.user_blocks(blocker_id,blocked_id) values(v_uid,p_user_id) on conflict do nothing;
 update public.friend_requests set status='cancelled',responded_at=now() where status in ('pending','accepted') and ((sender_id=v_uid and recipient_id=p_user_id) or (sender_id=p_user_id and recipient_id=v_uid));
 perform private.cancel_study_sessions_for_block(v_uid,p_user_id);
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.unblock_user(p_user_id uuid)
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
  if p_user_id is null then
    raise exception 'request_unavailable';
  end if;

  delete from public.user_blocks
  where blocker_id = v_user_id
    and blocked_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.report_user(
  p_reported_user_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if p_reported_user_id is null
     or p_reported_user_id = v_user_id
     or v_reason is null
     or char_length(v_reason) > 120
     or (v_details is not null and char_length(v_details) > 500) then
    raise exception 'request_unavailable';
  end if;

  insert into public.user_reports (
    reporter_id,
    reported_user_id,
    reason,
    details
  )
  values (v_user_id, p_reported_user_id, v_reason, v_details);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.purge_expired_user_reports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  with deleted as (
    delete from public.user_reports
    where created_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

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

create or replace function private.sha256_utf8_hex(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(digest(convert_to(coalesce(p_text, ''), 'UTF8'), 'sha256'::text), 'hex');
$$;

create or replace function private.can_workspace(
  p_workspace_id uuid,
  p_required_role text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_have integer;
  v_need integer;
begin
  v_role := private.workspace_role(p_workspace_id);
  if v_role is null then
    return false;
  end if;
  if p_required_role is null or p_required_role not in ('viewer', 'editor', 'owner') then
    return false;
  end if;

  v_have := case v_role
    when 'viewer' then 1
    when 'editor' then 2
    when 'owner' then 3
    else 0
  end;
  v_need := case p_required_role
    when 'viewer' then 1
    when 'editor' then 2
    when 'owner' then 3
    else 99
  end;

  return v_have >= v_need;
end;
$$;

create or replace function public.resolve_learning_output_bridge(
  p_study_set_id uuid,
  p_route_kind text
)
returns table (
  output_id uuid,
  workspace_id uuid,
  bridge_study_set_id uuid,
  legacy_parent_study_set_id uuid,
  kind text,
  resolution_mode text,
  history_study_set_id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_bridge public.learning_outputs%rowtype;
  v_parent public.learning_outputs%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_study_set_id is null then
    raise exception 'Study set id required';
  end if;

  if p_route_kind in ('quiz') then
    v_kind := 'quiz';
  elsif p_route_kind in ('flashcard', 'flashcards') then
    v_kind := 'flashcards';
  else
    raise exception 'Route kind must be quiz or flashcards';
  end if;

  select *
  into v_bridge
  from public.learning_outputs lo
  where lo.legacy_study_set_id = p_study_set_id
    and lo.deleted_at is null
    and (select private.can_view_workspace(lo.workspace_id))
  limit 1;

  if found then
    output_id := v_bridge.id;
    workspace_id := v_bridge.workspace_id;
    bridge_study_set_id := v_bridge.legacy_study_set_id;
    legacy_parent_study_set_id := v_bridge.legacy_parent_study_set_id;
    kind := v_bridge.kind;
    resolution_mode := 'bridge';
    history_study_set_id := v_bridge.legacy_study_set_id;
    return next;
    return;
  end if;

  select *
  into v_parent
  from public.learning_outputs lo
  where lo.legacy_parent_study_set_id = p_study_set_id
    and lo.kind = v_kind
    and lo.deleted_at is null
    and (select private.can_view_workspace(lo.workspace_id))
  limit 1;

  if found then
    output_id := v_parent.id;
    workspace_id := v_parent.workspace_id;
    bridge_study_set_id := v_parent.legacy_study_set_id;
    legacy_parent_study_set_id := v_parent.legacy_parent_study_set_id;
    kind := v_parent.kind;
    resolution_mode := 'parent';
    history_study_set_id := v_parent.legacy_parent_study_set_id;
    return next;
  end if;
end;
$$;

create or replace function private.backfill_legacy_study_set(p_study_set_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  r record;
  v_workspace_id uuid;
  v_document_id uuid;
  v_document_version_id uuid;
  v_canonical_version_id uuid;
  v_has_quiz boolean;
  v_has_flashcards boolean;
  v_bridge_id uuid;
  v_output_id uuid;
  v_canonical_checksum text;
  v_sections_checksum text;
  v_sections_json jsonb;
begin
  if exists (
    select 1
    from public.learning_outputs lo
    where lo.legacy_parent_study_set_id = p_study_set_id
       or lo.legacy_study_set_id = p_study_set_id
  ) or exists (
    select 1
    from public.document_versions dv
    where dv.conversion_provenance ->> 'study_set_id' = p_study_set_id::text
  ) then
    select d.workspace_id into v_workspace_id
    from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    where dv.conversion_provenance ->> 'study_set_id' = p_study_set_id::text
    limit 1;
    return v_workspace_id;
  end if;

  select
    ss.id as study_set_id,
    ss.user_id,
    ss.title,
    ss.subtitle,
    ss.pipeline_stage,
    ss.content_kind,
    ss.created_at,
    ss.updated_at,
    cd.id as canonical_document_id,
    cd.original_storage_path,
    cd.original_filename,
    cd.original_mime_type,
    cd.raw_markdown,
    cd.canonical_markdown,
    cd.metadata
  into r
  from public.study_sets ss
  left join public.canonical_documents cd on cd.study_set_id = ss.id
  where ss.id = p_study_set_id;

  if not found then
    raise exception 'Study set not found for backfill';
  end if;

  insert into public.workspaces (owner_id, title, subtitle, created_at, updated_at)
  values (r.user_id, r.title, r.subtitle, r.created_at, r.updated_at)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, created_at)
  values (v_workspace_id, r.user_id, 'owner', r.created_at);

  insert into public.documents (workspace_id, title, description, created_at, updated_at)
  values (v_workspace_id, r.title, r.subtitle, r.created_at, r.updated_at)
  returning id into v_document_id;

  insert into public.document_versions (
    document_id,
    version_number,
    source_kind,
    original_storage_path,
    original_filename,
    original_mime_type,
    raw_markdown,
    raw_markdown_checksum,
    conversion_provenance,
    created_by,
    created_at
  )
  values (
    v_document_id,
    1,
    case when r.original_storage_path is not null then 'upload' else 'legacy' end,
    r.original_storage_path,
    r.original_filename,
    r.original_mime_type,
    coalesce(r.raw_markdown, ''),
    case
      when coalesce(r.raw_markdown, '') = '' then null
      else private.sha256_utf8_hex(
        replace(replace(r.raw_markdown, E'\r\n', E'\n'), E'\r', E'\n')
      )
    end,
    jsonb_build_object('migrated_from', 'canonical_documents', 'study_set_id', r.study_set_id),
    r.user_id,
    r.created_at
  )
  returning id into v_document_version_id;

  v_canonical_version_id := null;
  v_sections_json := '[]'::jsonb;

  if r.canonical_document_id is not null
     and nullif(btrim(coalesce(r.canonical_markdown, '')), '') is not null then
    v_canonical_checksum := private.sha256_utf8_hex(
      replace(replace(r.canonical_markdown, E'\r\n', E'\n'), E'\r', E'\n')
    );

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ordinal', cs.ordinal,
          'section_key', cs.section_key,
          'heading', cs.heading,
          'section_type', cs.section_type,
          'body_markdown', cs.body_markdown
        )
        order by cs.ordinal
      ),
      '[]'::jsonb
    )
    into v_sections_json
    from public.canonical_sections cs
    where cs.canonical_document_id = r.canonical_document_id;

    select private.sha256_utf8_hex(coalesce(v_sections_json::text, '[]'))
    into v_sections_checksum;

    insert into public.canonical_versions (
      document_version_id,
      version_number,
      status,
      canonical_markdown,
      canonical_content_checksum,
      sections_checksum,
      provenance,
      metadata,
      created_by,
      created_at
    )
    values (
      v_document_version_id,
      1,
      'completed',
      r.canonical_markdown,
      v_canonical_checksum,
      coalesce(v_sections_checksum, private.sha256_utf8_hex('[]')),
      jsonb_build_object(
        'migrated_from', 'canonical_documents',
        'study_set_id', r.study_set_id,
        'mode', 'legacy_backfill'
      ),
      coalesce(r.metadata, '{}'::jsonb),
      r.user_id,
      r.created_at
    )
    returning id into v_canonical_version_id;

    insert into public.canonical_version_sections (
      canonical_version_id,
      ordinal,
      section_key,
      heading,
      body_markdown,
      section_type,
      created_at
    )
    select
      v_canonical_version_id,
      cs.ordinal,
      cs.section_key,
      cs.heading,
      cs.body_markdown,
      cs.section_type,
      cs.created_at
    from public.canonical_sections cs
    where cs.canonical_document_id = r.canonical_document_id
    order by cs.ordinal;
  end if;

  select exists(
    select 1 from public.approved_questions aq where aq.study_set_id = r.study_set_id
  ) into v_has_quiz;
  select exists(
    select 1 from public.approved_flashcards af where af.study_set_id = r.study_set_id
  ) into v_has_flashcards;

  if v_has_quiz then
    insert into public.study_sets (
      user_id, title, subtitle, pipeline_stage, content_kind, created_at, updated_at
    )
    values (
      r.user_id, r.title || ' (quiz)', r.subtitle, 'quiz', 'quiz', r.created_at, r.updated_at
    )
    returning id into v_bridge_id;

    insert into public.learning_outputs (
      workspace_id, legacy_study_set_id, legacy_parent_study_set_id, kind, title, status,
      generation_provenance, created_by, created_at, updated_at
    )
    values (
      v_workspace_id, v_bridge_id, r.study_set_id, 'quiz', r.title, 'ready',
      jsonb_build_object('migrated_from', 'approved_questions', 'parent_study_set_id', r.study_set_id),
      r.user_id, r.created_at, r.updated_at
    )
    returning id into v_output_id;

    update public.approved_questions
    set study_set_id = v_bridge_id, output_id = v_output_id
    where study_set_id = r.study_set_id;

    insert into public.output_source_snapshots (
      output_id, canonical_version_id, ordinal, canonical_content_checksum, sections_checksum,
      canonical_markdown, sections, canonical_metadata, source_provenance
    )
    values (
      v_output_id, v_canonical_version_id, 1,
      case when v_canonical_version_id is null then null else v_canonical_checksum end,
      case when v_canonical_version_id is null then null else v_sections_checksum end,
      coalesce(r.canonical_markdown, ''),
      coalesce(v_sections_json, '[]'::jsonb),
      coalesce(r.metadata, '{}'::jsonb),
      case
        when v_canonical_version_id is null then
          jsonb_build_object(
            'migration_exception', true,
            'reason', 'canonical_source_absent',
            'parent_study_set_id', r.study_set_id
          )
        else
          jsonb_build_object(
            'migrated_from', 'canonical_documents',
            'parent_study_set_id', r.study_set_id
          )
      end
    );
  end if;

  if v_has_flashcards then
    insert into public.study_sets (
      user_id, title, subtitle, pipeline_stage, content_kind, created_at, updated_at
    )
    values (
      r.user_id, r.title || ' (flashcards)', r.subtitle, 'flashcards', 'flashcards',
      r.created_at, r.updated_at
    )
    returning id into v_bridge_id;

    insert into public.learning_outputs (
      workspace_id, legacy_study_set_id, legacy_parent_study_set_id, kind, title, status,
      generation_provenance, created_by, created_at, updated_at
    )
    values (
      v_workspace_id, v_bridge_id, r.study_set_id, 'flashcards', r.title, 'ready',
      jsonb_build_object('migrated_from', 'approved_flashcards', 'parent_study_set_id', r.study_set_id),
      r.user_id, r.created_at, r.updated_at
    )
    returning id into v_output_id;

    update public.approved_flashcards
    set study_set_id = v_bridge_id, output_id = v_output_id
    where study_set_id = r.study_set_id;

    insert into public.output_source_snapshots (
      output_id, canonical_version_id, ordinal, canonical_content_checksum, sections_checksum,
      canonical_markdown, sections, canonical_metadata, source_provenance
    )
    values (
      v_output_id, v_canonical_version_id, 1,
      case when v_canonical_version_id is null then null else v_canonical_checksum end,
      case when v_canonical_version_id is null then null else v_sections_checksum end,
      coalesce(r.canonical_markdown, ''),
      coalesce(v_sections_json, '[]'::jsonb),
      coalesce(r.metadata, '{}'::jsonb),
      case
        when v_canonical_version_id is null then
          jsonb_build_object(
            'migration_exception', true,
            'reason', 'canonical_source_absent',
            'parent_study_set_id', r.study_set_id
          )
        else
          jsonb_build_object(
            'migrated_from', 'canonical_documents',
            'parent_study_set_id', r.study_set_id
          )
      end
    );
  end if;

  return v_workspace_id;
end;
$$;

create or replace function public.create_workspace_document_version(
  p_workspace_id uuid,
  p_document_id uuid,
  p_workspace_title text,
  p_document_title text,
  p_source_kind text,
  p_original_storage_path text,
  p_original_filename text,
  p_original_mime_type text,
  p_source_url text,
  p_raw_markdown text,
  p_raw_markdown_checksum text,
  p_conversion_provenance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid := p_workspace_id;
  v_document_id uuid := p_document_id;
  v_version_id uuid;
  v_version_number integer;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_title := nullif(btrim(coalesce(p_document_title, p_workspace_title, '')), '');
  if v_title is null then
    raise exception 'Document title required';
  end if;

  if p_source_kind is null or p_source_kind not in ('upload', 'paste', 'url', 'legacy') then
    raise exception 'Invalid source_kind';
  end if;

  if v_workspace_id is null then
    if v_document_id is not null then
      raise exception 'document_id requires workspace_id';
    end if;

    insert into public.workspaces (owner_id, title, subtitle)
    values (
      v_user_id,
      coalesce(nullif(btrim(coalesce(p_workspace_title, '')), ''), v_title),
      null
    )
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'owner');

    insert into public.documents (workspace_id, title)
    values (v_workspace_id, v_title)
    returning id into v_document_id;

    v_version_number := 1;
  else
    if not (select private.can_edit_workspace(v_workspace_id)) then
      raise exception 'Workspace editor access required';
    end if;

    if v_document_id is null then
      insert into public.documents (workspace_id, title)
      values (v_workspace_id, v_title)
      returning id into v_document_id;
      v_version_number := 1;
    else
      if not exists (
        select 1
        from public.documents d
        where d.id = v_document_id
          and d.workspace_id = v_workspace_id
          and d.deleted_at is null
      ) then
        raise exception 'Document not found in workspace';
      end if;

      select coalesce(max(dv.version_number), 0) + 1
      into v_version_number
      from public.document_versions dv
      where dv.document_id = v_document_id;
    end if;
  end if;

  insert into public.document_versions (
    document_id,
    version_number,
    source_kind,
    original_storage_path,
    original_filename,
    original_mime_type,
    source_url,
    raw_markdown,
    raw_markdown_checksum,
    conversion_provenance,
    created_by
  )
  values (
    v_document_id,
    v_version_number,
    p_source_kind,
    p_original_storage_path,
    p_original_filename,
    p_original_mime_type,
    p_source_url,
    coalesce(p_raw_markdown, ''),
    p_raw_markdown_checksum,
    coalesce(p_conversion_provenance, '{}'::jsonb),
    v_user_id
  )
  returning id into v_version_id;

  return jsonb_build_object(
    'workspaceId', v_workspace_id,
    'documentId', v_document_id,
    'documentVersionId', v_version_id,
    'versionNumber', v_version_number
  );
end;
$$;

create or replace function public.persist_canonical_version(
  p_document_version_id uuid,
  p_canonical_markdown text,
  p_canonical_content_checksum text,
  p_sections_checksum text,
  p_model text,
  p_prompt_version text,
  p_parser_version text,
  p_generator_settings jsonb,
  p_provenance jsonb,
  p_metadata jsonb,
  p_expected_section_count integer,
  p_sections jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_version_number integer;
  v_canonical_version_id uuid;
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_document_version_id is null then
    raise exception 'document_version_id required';
  end if;
  if p_expected_section_count < 1 then
    raise exception 'Expected section count must be positive';
  end if;
  if jsonb_typeof(p_sections) <> 'array' then
    raise exception 'Sections payload must be an array';
  end if;
  if nullif(btrim(coalesce(p_canonical_content_checksum, '')), '') is null then
    raise exception 'canonical_content_checksum required';
  end if;
  if nullif(btrim(coalesce(p_sections_checksum, '')), '') is null then
    raise exception 'sections_checksum required';
  end if;

  v_input_count := jsonb_array_length(p_sections);
  if v_input_count <> p_expected_section_count then
    raise exception 'Expected % sections, received %',
      p_expected_section_count, v_input_count;
  end if;

  select d.workspace_id
  into v_workspace_id
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  where dv.id = p_document_version_id
    and dv.deleted_at is null
    and d.deleted_at is null;

  if v_workspace_id is null then
    raise exception 'Document version not found';
  end if;
  if not (select private.can_edit_workspace(v_workspace_id)) then
    raise exception 'Workspace editor access required';
  end if;

  select coalesce(max(cv.version_number), 0) + 1
  into v_version_number
  from public.canonical_versions cv
  where cv.document_version_id = p_document_version_id;

  insert into public.canonical_versions (
    document_version_id,
    version_number,
    status,
    canonical_markdown,
    canonical_content_checksum,
    sections_checksum,
    model,
    prompt_version,
    parser_version,
    generator_settings,
    provenance,
    metadata,
    created_by
  )
  values (
    p_document_version_id,
    v_version_number,
    'completed',
    coalesce(p_canonical_markdown, ''),
    lower(p_canonical_content_checksum),
    lower(p_sections_checksum),
    p_model,
    p_prompt_version,
    p_parser_version,
    coalesce(p_generator_settings, '{}'::jsonb),
    coalesce(p_provenance, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    v_user_id
  )
  returning id into v_canonical_version_id;

  insert into public.canonical_version_sections (
    canonical_version_id,
    ordinal,
    section_key,
    heading,
    body_markdown,
    section_type,
    checksum
  )
  select
    v_canonical_version_id,
    section.ordinal,
    section.section_key,
    section.heading,
    coalesce(section.body_markdown, ''),
    section.section_type,
    section.checksum
  from jsonb_to_recordset(p_sections) as section(
    ordinal integer,
    section_key text,
    heading text,
    body_markdown text,
    section_type text,
    checksum text
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_section_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_section_count, v_inserted_count;
  end if;

  return jsonb_build_object(
    'canonicalVersionId', v_canonical_version_id,
    'versionNumber', v_version_number,
    'sectionCount', v_inserted_count
  );
end;
$$;

create or replace function public.create_learning_output(
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_generation_provenance jsonb,
  p_snapshots jsonb,
  p_expected_item_count integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bridge_id uuid;
  v_output_id uuid;
  v_snapshot_count integer;
  v_inserted_snapshots integer;
  v_item_count integer;
  v_inserted_items integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_workspace_id is null then
    raise exception 'workspace_id required';
  end if;
  if p_kind is null or p_kind not in ('quiz', 'flashcards') then
    raise exception 'kind must be quiz or flashcards';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'title required';
  end if;
  if not (select private.can_edit_workspace(p_workspace_id)) then
    raise exception 'Workspace editor access required';
  end if;
  if p_expected_item_count < 1 then
    raise exception 'Expected item count must be positive';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items payload must be an array';
  end if;
  if jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'Snapshots payload must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count <> p_expected_item_count then
    raise exception 'Expected % items, received %',
      p_expected_item_count, v_item_count;
  end if;

  v_snapshot_count := jsonb_array_length(p_snapshots);
  if v_snapshot_count < 1 then
    raise exception 'At least one source snapshot required';
  end if;

  if p_kind = 'quiz' then
    if exists (
      select 1
      from jsonb_array_elements(p_items) as elem
      where elem->>'prompt' is null
         or elem->'choices' is null
         or elem->>'correct_index' is null
         or elem->>'front' is not null
         or elem->>'back' is not null
    ) then
      raise exception 'Quiz items must not mix flashcard fields';
    end if;
  else
    if exists (
      select 1
      from jsonb_array_elements(p_items) as elem
      where elem->>'front' is null
         or elem->>'back' is null
         or elem->>'prompt' is not null
         or elem->'choices' is not null
    ) then
      raise exception 'Flashcard items must not mix quiz fields';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshots) as snap
    where snap->>'canonical_version_id' is not null
      and not exists (
        select 1
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = (snap->>'canonical_version_id')::uuid
          and cv.status = 'completed'
          and cv.deleted_at is null
          and dv.deleted_at is null
          and d.deleted_at is null
          and d.workspace_id = p_workspace_id
      )
  ) then
    raise exception 'Snapshot canonical_version_id must be a completed version in workspace';
  end if;

  insert into public.study_sets (
    user_id,
    title,
    pipeline_stage,
    content_kind
  )
  values (
    v_user_id,
    p_title,
    case when p_kind = 'quiz' then 'quiz' else 'flashcards' end,
    p_kind
  )
  returning id into v_bridge_id;

  insert into public.learning_outputs (
    workspace_id,
    legacy_study_set_id,
    legacy_parent_study_set_id,
    kind,
    title,
    status,
    generation_provenance,
    created_by
  )
  values (
    p_workspace_id,
    v_bridge_id,
    null,
    p_kind,
    p_title,
    'ready',
    coalesce(p_generation_provenance, '{}'::jsonb),
    v_user_id
  )
  returning id into v_output_id;

  insert into public.output_source_snapshots (
    output_id,
    canonical_version_id,
    ordinal,
    canonical_content_checksum,
    sections_checksum,
    canonical_markdown,
    sections,
    canonical_metadata,
    source_provenance
  )
  select
    v_output_id,
    snap.canonical_version_id,
    coalesce(snap.ordinal, ord.ordinal::integer),
    snap.canonical_content_checksum,
    snap.sections_checksum,
    coalesce(snap.canonical_markdown, ''),
    coalesce(snap.sections, '[]'::jsonb),
    coalesce(snap.canonical_metadata, '{}'::jsonb),
    coalesce(snap.source_provenance, '{}'::jsonb)
  from jsonb_array_elements(p_snapshots) with ordinality as ord(value, ordinal)
  cross join lateral jsonb_to_record(ord.value) as snap(
    canonical_version_id uuid,
    ordinal integer,
    canonical_content_checksum text,
    sections_checksum text,
    canonical_markdown text,
    sections jsonb,
    canonical_metadata jsonb,
    source_provenance jsonb
  );

  get diagnostics v_inserted_snapshots = row_count;
  if v_inserted_snapshots <> v_snapshot_count then
    raise exception 'Expected to insert % snapshots, inserted %',
      v_snapshot_count, v_inserted_snapshots;
  end if;

  if p_kind = 'quiz' then
    insert into public.approved_questions (
      id,
      user_id,
      study_set_id,
      output_id,
      prompt,
      choices,
      correct_index,
      explanation,
      tags,
      source
    )
    select
      coalesce(q.id, gen_random_uuid()),
      v_user_id,
      v_bridge_id,
      v_output_id,
      q.prompt,
      q.choices,
      q.correct_index,
      q.explanation,
      coalesce(q.tags, '{}'::text[]),
      coalesce(q.source, '{}'::jsonb)
    from jsonb_to_recordset(p_items) as q(
      id uuid,
      prompt text,
      choices text[],
      correct_index smallint,
      explanation text,
      tags text[],
      source jsonb
    );
  else
    insert into public.approved_flashcards (
      id,
      user_id,
      study_set_id,
      output_id,
      front,
      back,
      tags,
      source
    )
    select
      coalesce(c.id, gen_random_uuid()),
      v_user_id,
      v_bridge_id,
      v_output_id,
      c.front,
      c.back,
      coalesce(c.tags, '{}'::text[]),
      coalesce(c.source, '{}'::jsonb)
    from jsonb_to_recordset(p_items) as c(
      id uuid,
      front text,
      back text,
      tags text[],
      source jsonb
    );
  end if;

  get diagnostics v_inserted_items = row_count;
  if v_inserted_items <> p_expected_item_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_item_count, v_inserted_items;
  end if;

  return jsonb_build_object(
    'outputId', v_output_id,
    'bridgeStudySetId', v_bridge_id,
    'legacyParentStudySetId', null,
    'kind', p_kind,
    'itemCount', v_inserted_items,
    'snapshotCount', v_inserted_snapshots
  );
end;
$$;

create or replace function private.workspace_role(p_workspace_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null or p_workspace_id is null then
    return null;
  end if;

  select m.role
  into v_role
  from public.workspace_members as m
  where m.workspace_id = p_workspace_id
    and m.user_id = v_uid;

  return v_role;
end;
$$;

create or replace function private.can_view_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) in ('owner', 'editor', 'viewer');
$$;

create or replace function private.can_edit_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) in ('owner', 'editor');
$$;

create or replace function private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) = 'owner';
$$;

create or replace function private.storage_object_workspace_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function private.assert_workspace_share_target(
  p_workspace_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_permission text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_target_kind = 'workspace' then
    if p_target_id <> p_workspace_id then
      raise exception 'forbidden';
    end if;
    if p_permission <> 'view' then
      raise exception 'invalid';
    end if;
    if not exists (
      select 1 from public.workspaces w
      where w.id = p_workspace_id and w.deleted_at is null
    ) then
      raise exception 'not_found';
    end if;
    return;
  end if;

  if p_target_kind in ('quiz', 'flashcard') then
    if p_permission <> 'study' then
      raise exception 'invalid';
    end if;
    if not exists (
      select 1
      from public.learning_outputs lo
      where lo.id = p_target_id
        and lo.workspace_id = p_workspace_id
        and lo.deleted_at is null
        and lo.kind = case p_target_kind
          when 'quiz' then 'quiz'
          when 'flashcard' then 'flashcards'
        end
    ) then
      raise exception 'not_found';
    end if;
    return;
  end if;

  raise exception 'invalid';
end;
$$;

create or replace function public.create_workspace_invitation(
  p_workspace_id uuid,
  p_recipient_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_recipient_user_id is null or p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;
  if p_recipient_user_id = v_uid then
    raise exception 'invalid';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.deleted_at is null
  ) then
    raise exception 'not_found';
  end if;

  insert into public.workspace_invitations (
    workspace_id, recipient_user_id, role, created_by, expires_at
  )
  values (
    p_workspace_id,
    p_recipient_user_id,
    p_role,
    v_uid,
    now() + interval '14 days'
  )
  returning * into v_invitation;

  return jsonb_build_object(
    'id', v_invitation.id,
    'workspaceId', v_invitation.workspace_id,
    'recipientUserId', v_invitation.recipient_user_id,
    'role', v_invitation.role,
    'expiresAt', v_invitation.expires_at,
    'createdAt', v_invitation.created_at
  );
exception
  when unique_violation then
    raise exception 'invitation_exists';
end;
$$;

create or replace function public.list_workspace_invitations(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'recipientUserId', i.recipient_user_id,
        'role', i.role,
        'expiresAt', i.expires_at,
        'acceptedAt', i.accepted_at,
        'revokedAt', i.revoked_at,
        'createdAt', i.created_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_invitations i
  where i.workspace_id = p_workspace_id
    and i.revoked_at is null
    and i.accepted_at is null;

  return jsonb_build_object('invitations', v_rows);
end;
$$;

create or replace function public.revoke_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_invitation
  from public.workspace_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if not (select private.is_workspace_owner(v_invitation.workspace_id)) then
    raise exception 'forbidden';
  end if;
  if v_invitation.accepted_at is not null or v_invitation.revoked_at is not null then
    raise exception 'not_found';
  end if;

  update public.workspace_invitations
  set revoked_at = now()
  where id = p_invitation_id;

  return jsonb_build_object('id', p_invitation_id, 'revoked', true);
end;
$$;

create or replace function public.accept_workspace_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invitation public.workspace_invitations%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_invitation
  from public.workspace_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_invitation.recipient_user_id <> v_uid then
    raise exception 'forbidden';
  end if;
  if v_invitation.revoked_at is not null then
    raise exception 'not_found';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'expired';
  end if;
  if v_invitation.role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;

  if v_invitation.accepted_at is not null then
    select m.role into v_role
    from public.workspace_members m
    where m.workspace_id = v_invitation.workspace_id
      and m.user_id = v_uid;
    return jsonb_build_object(
      'workspaceId', v_invitation.workspace_id,
      'role', coalesce(v_role, v_invitation.role),
      'alreadyAccepted', true
    );
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invitation.workspace_id, v_uid, v_invitation.role)
  on conflict (workspace_id, user_id) do update
  set role = excluded.role;

  update public.workspace_invitations
  set accepted_at = now()
  where id = p_invitation_id;

  return jsonb_build_object(
    'workspaceId', v_invitation.workspace_id,
    'role', v_invitation.role,
    'alreadyAccepted', false
  );
end;
$$;

create or replace function public.list_workspace_members(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', m.user_id,
        'role', m.role,
        'joinedAt', m.created_at
      )
      order by m.created_at
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_members m
  where m.workspace_id = p_workspace_id;

  return jsonb_build_object('members', v_rows);
end;
$$;

create or replace function public.change_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.workspace_members%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'invalid';
  end if;
  if p_user_id is null then
    raise exception 'invalid';
  end if;

  select * into v_member
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'forbidden';
  end if;

  update public.workspace_members
  set role = p_role
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'role', p_role);
end;
$$;

create or replace function public.revoke_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.workspace_members%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_user_id is null then
    raise exception 'invalid';
  end if;

  select * into v_member
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'forbidden';
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id;

  return jsonb_build_object('userId', p_user_id, 'revoked', true);
end;
$$;

create or replace function public.create_workspace_share(
  p_workspace_id uuid,
  p_target_kind text,
  p_target_id uuid,
  p_token_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_share public.workspace_shares%rowtype;
  v_permission text;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;
  if p_token_digest is null or length(p_token_digest) <> 32 then
    raise exception 'invalid';
  end if;

  v_permission := case p_target_kind
    when 'workspace' then 'view'
    when 'quiz' then 'study'
    when 'flashcard' then 'study'
    else null
  end;
  if v_permission is null then
    raise exception 'invalid';
  end if;

  perform private.assert_workspace_share_target(
    p_workspace_id, p_target_kind, p_target_id, v_permission
  );

  insert into public.workspace_shares (
    workspace_id, target_kind, target_id, token_digest, permission, created_by
  )
  values (
    p_workspace_id, p_target_kind, p_target_id, p_token_digest, v_permission, v_uid
  )
  returning * into v_share;

  return jsonb_build_object(
    'id', v_share.id,
    'workspaceId', v_share.workspace_id,
    'targetKind', v_share.target_kind,
    'targetId', v_share.target_id,
    'permission', v_share.permission,
    'createdAt', v_share.created_at
  );
end;
$$;

create or replace function public.list_workspace_shares(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if not (select private.is_workspace_owner(p_workspace_id)) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'targetKind', s.target_kind,
        'targetId', s.target_id,
        'permission', s.permission,
        'expiresAt', s.expires_at,
        'revokedAt', s.revoked_at,
        'createdAt', s.created_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.workspace_shares s
  where s.workspace_id = p_workspace_id
    and s.revoked_at is null;

  return jsonb_build_object('shares', v_rows);
end;
$$;

create or replace function public.revoke_workspace_share(p_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_share public.workspace_shares%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_share
  from public.workspace_shares s
  where s.id = p_share_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if not (select private.is_workspace_owner(v_share.workspace_id)) then
    raise exception 'forbidden';
  end if;
  if v_share.revoked_at is not null then
    raise exception 'not_found';
  end if;

  update public.workspace_shares
  set revoked_at = now()
  where id = p_share_id;

  return jsonb_build_object('id', p_share_id, 'revoked', true);
end;
$$;

create or replace function public.resolve_public_share_by_digest(p_token_digest bytea)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.workspace_shares%rowtype;
  v_title text;
begin
  if p_token_digest is null or length(p_token_digest) <> 32 then
    raise exception 'not_found';
  end if;

  select * into v_share
  from public.workspace_shares s
  where s.token_digest = p_token_digest
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());

  if not found then
    raise exception 'not_found';
  end if;

  perform private.assert_workspace_share_target(
    v_share.workspace_id,
    v_share.target_kind,
    v_share.target_id,
    v_share.permission
  );

  if v_share.target_kind = 'workspace' then
    select w.title into v_title
    from public.workspaces w
    where w.id = v_share.workspace_id
      and w.deleted_at is null;

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'workspace',
        'title', v_title,
        'outputs', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', lo.id,
                'kind', case lo.kind
                  when 'quiz' then 'quiz'
                  when 'flashcards' then 'flashcard'
                end,
                'title', lo.title
              )
              order by lo.kind, lo.title
            )
            from public.learning_outputs lo
            where lo.workspace_id = v_share.workspace_id
              and lo.deleted_at is null
              and lo.status = 'ready'
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  if v_share.target_kind = 'quiz' then
    select lo.title into v_title
    from public.learning_outputs lo
    where lo.id = v_share.target_id
      and lo.workspace_id = v_share.workspace_id
      and lo.deleted_at is null
      and lo.kind = 'quiz'
      and lo.status = 'ready';

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'quiz',
        'outputId', v_share.target_id,
        'title', v_title,
        'questions', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', aq.id,
                'prompt', aq.prompt,
                'choices', to_jsonb(aq.choices),
                'correctIndex', aq.correct_index,
                'explanation', aq.explanation
              )
              order by aq.created_at, aq.id
            )
            from public.approved_questions aq
            where aq.output_id = v_share.target_id
              and length(trim(aq.prompt)) > 0
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  if v_share.target_kind = 'flashcard' then
    select lo.title into v_title
    from public.learning_outputs lo
    where lo.id = v_share.target_id
      and lo.workspace_id = v_share.workspace_id
      and lo.deleted_at is null
      and lo.kind = 'flashcards'
      and lo.status = 'ready';

    if not found then
      raise exception 'not_found';
    end if;

    return jsonb_build_object(
      'shareId', v_share.id,
      'permission', v_share.permission,
      'target', jsonb_build_object(
        'kind', 'flashcard',
        'title', v_title,
        'cards', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', af.id,
                'front', af.front,
                'back', af.back
              )
              order by af.created_at, af.id
            )
            from public.approved_flashcards af
            where af.output_id = v_share.target_id
              and length(trim(af.front)) > 0
              and length(trim(af.back)) > 0
          ),
          '[]'::jsonb
        )
      )
    );
  end if;

  raise exception 'not_found';
exception
  when others then
    if sqlerrm in ('not_found', 'forbidden', 'invalid') then
      raise exception 'not_found';
    end if;
    raise;
end;
$$;

create or replace function public.import_anonymous_quiz_attempts(p_attempts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_entry jsonb;
  v_client_attempt_id uuid;
  v_share_id uuid;
  v_output_id uuid;
  v_completed_at timestamptz;
  v_answers jsonb;
  v_attempt jsonb;
  v_share public.workspace_shares%rowtype;
  v_answer jsonb;
  v_question_id uuid;
  v_selected_index integer;
  v_answer_count integer;
  v_valid_question_count integer;
  v_acknowledged uuid[] := '{}';
  v_inserted uuid;
  v_i integer;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array' then
    raise exception 'invalid';
  end if;

  if jsonb_array_length(p_attempts) = 0 then
    return jsonb_build_object('acknowledgedIds', '[]'::jsonb);
  end if;

  if jsonb_array_length(p_attempts) > 20 then
    raise exception 'invalid';
  end if;

  if octet_length(p_attempts::text) > 262144 then
    raise exception 'invalid';
  end if;

  for v_i in 0 .. jsonb_array_length(p_attempts) - 1 loop
    begin
      v_entry := p_attempts -> v_i;

      v_client_attempt_id := nullif(v_entry ->> 'clientAttemptId', '')::uuid;
      v_share_id := nullif(v_entry ->> 'shareId', '')::uuid;
      v_output_id := nullif(v_entry ->> 'outputId', '')::uuid;
      v_completed_at := nullif(v_entry ->> 'completedAt', '')::timestamptz;
      v_answers := v_entry -> 'answers';

      if v_client_attempt_id is null
        or v_share_id is null
        or v_output_id is null
        or v_completed_at is null
        or jsonb_typeof(v_answers) <> 'array'
      then
        continue;
      end if;

      if v_completed_at > now() + interval '5 minutes'
        or v_completed_at < now() - interval '365 days'
      then
        continue;
      end if;

      v_answer_count := jsonb_array_length(v_answers);
      if v_answer_count = 0 or v_answer_count > 500 then
        continue;
      end if;

      v_attempt := jsonb_build_object(
        'answers', v_answers,
        'correctCount', coalesce((v_entry ->> 'correctCount')::integer, 0),
        'totalQuestions', coalesce((v_entry ->> 'totalQuestions')::integer, 0)
      );

      if octet_length(v_attempt::text) > 32768 then
        continue;
      end if;

      for v_answer in select value from jsonb_array_elements(v_answers) loop
        v_question_id := nullif(v_answer ->> 'questionId', '')::uuid;
        v_selected_index := (v_answer ->> 'selectedIndex')::integer;

        if v_question_id is null
          or v_selected_index is null
          or v_selected_index < 0
          or v_selected_index > 25
        then
          raise exception 'skip_entry';
        end if;
      end loop;

      select * into v_share
      from public.workspace_shares s
      where s.id = v_share_id
        and s.revoked_at is null
        and (s.expires_at is null or s.expires_at > now())
        and s.target_kind = 'quiz'
        and s.target_id = v_output_id
        and s.permission = 'study';

      if not found then
        continue;
      end if;

      if not exists (
        select 1
        from public.learning_outputs lo
        where lo.id = v_output_id
          and lo.workspace_id = v_share.workspace_id
          and lo.deleted_at is null
          and lo.kind = 'quiz'
          and lo.status = 'ready'
      ) then
        continue;
      end if;

      select count(*) into v_valid_question_count
      from public.approved_questions aq
      where aq.output_id = v_output_id
        and aq.id in (
          select nullif(value ->> 'questionId', '')::uuid
          from jsonb_array_elements(v_answers)
        );

      if v_valid_question_count <> v_answer_count then
        continue;
      end if;

      insert into public.anonymous_quiz_attempt_imports (
        user_id,
        client_attempt_id,
        share_id,
        output_id,
        attempt,
        completed_at
      )
      values (
        v_uid,
        v_client_attempt_id,
        v_share_id,
        v_output_id,
        v_attempt,
        v_completed_at
      )
      on conflict (user_id, client_attempt_id) do nothing
      returning client_attempt_id into v_inserted;

      if v_inserted is not null then
        v_acknowledged := array_append(v_acknowledged, v_inserted);
      elsif exists (
        select 1
        from public.anonymous_quiz_attempt_imports i
        where i.user_id = v_uid
          and i.client_attempt_id = v_client_attempt_id
      ) then
        v_acknowledged := array_append(v_acknowledged, v_client_attempt_id);
      end if;
    exception
      when others then
        if sqlerrm = 'skip_entry' then
          continue;
        end if;
        continue;
    end;
  end loop;

  return jsonb_build_object(
    'acknowledgedIds',
    coalesce(
      (
        select jsonb_agg(to_jsonb(id))
        from unnest(v_acknowledged) as id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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

create or replace function public.resolve_profile_user(p_username text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('userId', p.id)
  from public.profiles p
  where p.username_normalized = private.normalize_username(p_username)
$$;

create or replace function public.resolve_friend_user(p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_other_user_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select p.id into v_other_user_id from public.profiles p where p.username_normalized = private.normalize_username(p_username);
  if not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  return jsonb_build_object('userId', v_other_user_id);
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
  insert into public.direct_conversation_participants (conversation_id, user_id)
  values (v_id, v_user_id), (v_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;
  return jsonb_build_object('conversationId', v_id);
end;
$$;

create or replace function public.authorize_direct_message_upload(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid;
begin
  if v_user_id is null or p_conversation_id is null then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.register_direct_message_upload(p_attachment_id uuid, p_conversation_id uuid, p_name text, p_mime_type text, p_size_bytes bigint, p_extension text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_path text; v_expected_extension text;
begin
  if v_user_id is null or p_attachment_id is null or p_conversation_id is null or p_name !~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$' or p_size_bytes not between 0 and 20971520 or p_mime_type not in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime') or p_extension not in ('jpg','png','webp','gif','mp4','webm','mov') then raise exception 'social_unavailable'; end if;
  v_expected_extension := case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'image/gif' then 'gif' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' when 'video/quicktime' then 'mov' end;
  if p_extension <> v_expected_extension then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  v_path := format('%s/messages/%s/%s.%s', v_user_id, p_conversation_id, p_attachment_id, p_extension);
  if not exists (select 1 from storage.objects where bucket_id = 'doc2quiz' and name = v_path) then raise exception 'social_unavailable'; end if;
  insert into public.direct_message_attachments(id,uploader_id,conversation_id,path,name,mime_type,size_bytes,extension) values(p_attachment_id,v_user_id,p_conversation_id,v_path,p_name,p_mime_type,p_size_bytes,p_extension);
  return jsonb_build_object('id',p_attachment_id,'name',p_name,'mimeType',p_mime_type,'sizeBytes',p_size_bytes);
exception when others then raise exception 'social_unavailable';
end;
$$;

create or replace function public.discard_direct_message_uploads(p_conversation_id uuid, p_attachment_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_paths jsonb;
begin
  if v_user_id is null or p_conversation_id is null or p_attachment_ids is null or cardinality(p_attachment_ids) not between 1 and 5 then raise exception 'social_unavailable'; end if;
  if (select count(*) from (select distinct unnest(p_attachment_ids)) ids) <> cardinality(p_attachment_ids) then raise exception 'social_unavailable'; end if;
  if (select count(*) from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids)) <> cardinality(p_attachment_ids) then raise exception 'social_unavailable'; end if;
  select coalesce(jsonb_agg(a.path),'[]'::jsonb) into v_paths from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids);
  delete from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids);
  return jsonb_build_object('paths',v_paths);
end;
$$;

create or replace function public.list_direct_messages(p_conversation_id uuid, p_before timestamptz default null, p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_messages jsonb;
begin
  if v_user_id is null or p_conversation_id is null or p_limit not between 1 and 100 then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id = v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id from public.direct_conversations c where c.id = p_conversation_id and v_user_id in (c.user_low_id, c.user_high_id);
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id, v_other_user_id) then raise exception 'social_unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'senderId', sender_id, 'body', body, 'attachments', attachments, 'createdAt', created_at) order by created_at desc), '[]'::jsonb) into v_messages from (select * from public.direct_messages where conversation_id=p_conversation_id and (p_before is null or created_at<p_before) order by created_at desc limit p_limit) m;
  return jsonb_build_object('messages',v_messages);
end;
$$;

create or replace function public.send_direct_message(p_conversation_id uuid, p_body text, p_attachment_ids uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_user_id uuid := auth.uid(); v_other_user_id uuid; v_message_id uuid; v_body text := nullif(btrim(coalesce(p_body,'')), ''); v_attachments jsonb := '[]'::jsonb; v_count integer := coalesce(cardinality(p_attachment_ids), 0);
begin
  if v_user_id is null or p_conversation_id is null or v_count > 5 or (v_body is null and v_count = 0) then raise exception 'social_unavailable'; end if;
  if v_body is not null and char_length(v_body)>2000 then raise exception 'social_unavailable'; end if;
  if v_count > 0 and (select count(*) from (select distinct unnest(p_attachment_ids)) ids) <> v_count then raise exception 'social_unavailable'; end if;
  select case when c.user_low_id=v_user_id then c.user_high_id else c.user_low_id end into v_other_user_id from public.direct_conversations c where c.id=p_conversation_id and v_user_id in(c.user_low_id,c.user_high_id) for update;
  if v_other_user_id is null or not private.social_are_accepted_friends(v_user_id,v_other_user_id) then raise exception 'social_unavailable'; end if;
  if v_count > 0 then
    perform 1 from public.direct_message_attachments a
    where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids)
    for update;
    if (select count(*) from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids)) <> v_count then raise exception 'social_unavailable'; end if;
    if exists (select 1 from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids) and not exists (select 1 from storage.objects o where o.bucket_id='doc2quiz' and o.name=a.path)) then raise exception 'social_unavailable'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mimeType',a.mime_type,'sizeBytes',a.size_bytes,'path',a.path) order by a.created_at),'[]'::jsonb) into v_attachments from public.direct_message_attachments a where a.uploader_id=v_user_id and a.conversation_id=p_conversation_id and a.status='uploaded' and a.id=any(p_attachment_ids);
  end if;
  insert into public.direct_messages(conversation_id,sender_id,body,attachments) values(p_conversation_id,v_user_id,v_body,v_attachments) returning id into v_message_id;
  update public.direct_message_attachments set status='consumed',consumed_at=now() where uploader_id=v_user_id and conversation_id=p_conversation_id and status='uploaded' and id=any(p_attachment_ids);
  update public.direct_conversations set last_message_at=now() where id=p_conversation_id;
  return jsonb_build_object('id',v_message_id,'senderId',v_user_id,'recipientUserId',v_other_user_id,'body',v_body,'attachments',v_attachments,'createdAt',now());
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

create or replace function public.record_learning_streak(p_timezone text)
returns public.learning_streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date;
  v_state public.learning_streaks%rowtype;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then
    raise exception 'invalid_timezone';
  end if;
  begin
    v_today := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then
    raise exception 'invalid_timezone';
  end;

  insert into public.learning_streaks (user_id, last_quiz_date, current_streak)
  values (v_uid, v_today, 1)
  on conflict (user_id) do nothing;

  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if v_state.last_quiz_date <> v_today then
    if v_state.last_quiz_date = v_today - 1 then
      update public.learning_streaks
        set current_streak = v_state.current_streak + 1,
            last_quiz_date = v_today,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    else
      update public.learning_streaks
        set current_streak = 1,
            last_quiz_date = v_today,
            lost_streak = v_state.current_streak,
            lost_at = now(),
            recovery_started_at = null,
            recovery_quiz_count = 0,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    end if;
  end if;

  if v_state.recovery_started_at is not null then
    if v_state.recovery_started_at + interval '48 hours' < now() then
      update public.learning_streaks
        set recovery_started_at = null, recovery_quiz_count = 0, updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    elsif v_state.recovery_quiz_count + 1 >= 2 then
      update public.learning_streaks
        set current_streak = lost_streak,
            lost_streak = 0,
            lost_at = null,
            recovery_started_at = null,
            recovery_quiz_count = 0,
            recoveries_this_month = recoveries_this_month + 1,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    else
      update public.learning_streaks
        set recovery_quiz_count = recovery_quiz_count + 1, updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    end if;
  end if;
  return v_state;
end;
$$;

create or replace function public.get_learning_streak(p_timezone text)
returns public.learning_streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date;
  v_state public.learning_streaks%rowtype;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then raise exception 'invalid_timezone'; end if;
  begin v_today := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then raise exception 'invalid_timezone'; end;
  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if not found then return null; end if;
  if v_state.last_quiz_date < v_today - 1 and v_state.current_streak > 0 then
    update public.learning_streaks
      set current_streak = 0, lost_streak = current_streak, lost_at = now(),
          recovery_started_at = null, recovery_quiz_count = 0, updated_at = now()
      where user_id = v_uid returning * into v_state;
  end if;
  return v_state;
end;
$$;

create or replace function public.start_learning_streak_recovery(p_timezone text)
returns public.learning_streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_state public.learning_streaks%rowtype;
  v_month date;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then raise exception 'invalid_timezone'; end if;
  begin v_month := date_trunc('month', now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then raise exception 'invalid_timezone'; end;
  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if not found or v_state.lost_streak = 0 or v_state.lost_at < now() - interval '48 hours' then raise exception 'recovery_unavailable'; end if;
  if v_state.recovery_month is distinct from v_month then
    update public.learning_streaks set recovery_month = v_month, recoveries_this_month = 0 where user_id = v_uid returning * into v_state;
  end if;
  if v_state.recoveries_this_month >= 2 then raise exception 'recovery_limit'; end if;
  update public.learning_streaks set recovery_started_at = now(), recovery_quiz_count = 0, updated_at = now()
    where user_id = v_uid returning * into v_state;
  return v_state;
end;
$$;

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

  select p.* into v_profile
  from public.profiles p
  where p.id = p_other_user_id;
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
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'displayName', coalesce(p.display_name, p.username, 'Student'),
    'username', p.username,
    'bio', coalesce(p.bio, ''),
    'avatarPath', p.avatar_path
  )
  from public.profiles p
  where p.id = p_user_id
$$;

create or replace function public.set_quiz_friend_share(p_output_id uuid, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.learning_outputs lo
    where lo.id = p_output_id
      and lo.created_by = v_user_id
      and lo.kind = 'quiz'
      and lo.deleted_at is null
  ) then raise exception 'share_unavailable'; end if;

  if p_shared then
    insert into public.learning_output_friend_shares (output_id, owner_id)
    values (p_output_id, v_user_id)
    on conflict (output_id) do update set owner_id = excluded.owner_id;
  else
    delete from public.learning_output_friend_shares
    where output_id = p_output_id and owner_id = v_user_id;
  end if;

  return jsonb_build_object('shared', p_shared);
end;
$$;

create or replace function public.get_friend_shared_quiz(p_other_user_id uuid, p_output_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_title text; v_updated_at timestamptz;
begin
  perform private.social_require_friend(p_other_user_id);

  select lo.title, lo.updated_at into v_title, v_updated_at
  from public.learning_output_friend_shares fs
  join public.learning_outputs lo on lo.id = fs.output_id
  where fs.output_id = p_output_id
    and fs.owner_id = p_other_user_id
    and lo.created_by = p_other_user_id
    and lo.kind = 'quiz'
    and lo.status = 'ready'
    and lo.deleted_at is null;
  if not found then raise exception 'social_unavailable'; end if;

  return jsonb_build_object(
    'id', p_output_id,
    'title', v_title,
    'type', 'quiz',
    'updatedAt', v_updated_at,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', aq.id,
        'prompt', aq.prompt,
        'choices', to_jsonb(aq.choices),
        'correctIndex', aq.correct_index,
        'explanation', aq.explanation
      ) order by aq.created_at)
      from public.approved_questions aq
      where aq.output_id = p_output_id and length(trim(aq.prompt)) > 0
    ), '[]'::jsonb)
  );
end;
$$;

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

create or replace function private.study_unavailable() returns void language plpgsql set search_path = '' as $$ begin raise exception 'social_unavailable'; end $$;

create or replace function public.create_study_challenge(p_recipient_id uuid,p_output_id uuid,p_mode text default 'score',p_deadline_at timestamptz default null,p_message text default null,p_reveal_policy text default 'after_both_complete') returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid:=auth.uid(); v_output public.learning_outputs%rowtype; v_questions jsonb; v_session uuid; v_snapshot jsonb;
begin
 if v_uid is null or p_recipient_id is null or p_recipient_id=v_uid or p_mode not in ('practice','score') or p_reveal_policy not in ('immediate','after_both_complete','after_deadline') or char_length(coalesce(p_message,''))>500 or (p_deadline_at is not null and p_deadline_at<=now()) then perform private.study_unavailable(); end if;
 if not private.social_are_accepted_friends(v_uid,p_recipient_id) then perform private.study_unavailable(); end if;
 select * into v_output from public.learning_outputs where id=p_output_id for update;
 if v_output.id is null or v_output.created_by<>v_uid or v_output.kind<>'quiz' or v_output.status<>'ready' or v_output.deleted_at is not null then perform private.study_unavailable(); end if;
 select jsonb_agg(jsonb_build_object('id',row_number::text,'prompt',prompt,'choices',choices,'correctIndex',correct_index,'explanation',explanation) order by created_at,id) into v_questions from (select q.*,row_number() over(order by q.created_at,q.id) from public.approved_questions q where q.output_id=p_output_id) q;
 if coalesce(jsonb_array_length(v_questions),0)=0 then perform private.study_unavailable(); end if;
 v_snapshot:=jsonb_build_object('title',v_output.title,'questions',v_questions,'sourceOutputId',v_output.id,'sourceOwnerId',v_uid,'snapshottedAt',now());
 insert into public.study_together_sessions(creator_id,recipient_id,source_output_id,source_owner_id,source_version,snapshot_hash,snapshot,mode,deadline_at,result_reveal_policy) values(v_uid,p_recipient_id,p_output_id,v_uid,coalesce(v_output.updated_at,v_output.created_at)::text,encode(digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),v_snapshot,p_mode,p_deadline_at,p_reveal_policy) returning id into v_session;
 insert into public.study_together_participants(session_id,user_id,role,status) values(v_session,v_uid,'creator','not_started'),(v_session,p_recipient_id,'recipient','invited');
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,payload,dedupe_key) values(p_recipient_id,v_uid,'study_challenge_received',v_session,jsonb_build_object('title',v_output.title,'message',nullif(btrim(p_message),''),'mode',p_mode,'deadlineAt',p_deadline_at),'challenge:'||v_session||':received');
 return jsonb_build_object('sessionId',v_session,'status','pending','recipientId',p_recipient_id);
end $$;

create or replace function private.study_open_attempt(p_session_id uuid,p_role text,p_accept boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_s public.study_together_sessions%rowtype; v_p public.study_together_participants%rowtype; v_attempt uuid; v_existing boolean;
begin
 select * into v_s from public.study_together_sessions where id=p_session_id for update;
 select * into v_p from public.study_together_participants where session_id=p_session_id and user_id=v_uid and role=p_role for update;
 if v_uid is null or v_s.id is null or v_p.id is null or v_s.status in ('expired','cancelled','completed') or (v_s.deadline_at is not null and v_s.deadline_at<=now()) or (p_accept and v_p.status not in ('invited','in_progress')) or (not p_accept and v_p.status not in ('not_started','in_progress')) then perform private.study_unavailable(); end if;
 select id into v_attempt from public.study_together_attempts where session_id=p_session_id and participant_id=v_p.id and attempt_number=1; v_existing:=v_attempt is not null;
 if v_attempt is null then insert into public.study_together_attempts(session_id,participant_id) values(p_session_id,v_p.id) returning id into v_attempt; end if;
 update public.study_together_participants set status='in_progress' where id=v_p.id;
 update public.study_together_sessions set status='active',updated_at=now() where id=p_session_id and status='pending';
 if p_accept then insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(v_s.creator_id,v_uid,'study_challenge_accepted',p_session_id,'challenge:'||p_session_id||':accepted') on conflict(recipient_id,dedupe_key) do nothing; end if;
 return jsonb_build_object('sessionId',p_session_id,'attemptId',v_attempt,'status','in_progress','resumed',v_existing);
end $$;

create or replace function public.start_study_challenge_attempt(p_session_id uuid) returns jsonb language sql security definer set search_path=public as $$ select private.study_open_attempt(p_session_id,'creator',false) $$;

create or replace function public.accept_study_challenge(p_session_id uuid) returns jsonb language sql security definer set search_path=public as $$ select private.study_open_attempt(p_session_id,'recipient',true) $$;

create or replace function public.get_study_attempt_practice(p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_a public.study_together_attempts%rowtype; v_s public.study_together_sessions%rowtype; v_questions jsonb;
begin
 select a.* into v_a from public.study_together_attempts a join public.study_together_participants p on p.id=a.participant_id where a.id=p_attempt_id and p.user_id=v_uid;
 select * into v_s from public.study_together_sessions where id=v_a.session_id;
 if v_a.id is null or v_s.status='cancelled' then perform private.study_unavailable(); end if;
 select jsonb_agg((q - 'correctIndex' - 'explanation') order by ord) into v_questions from jsonb_array_elements(v_s.snapshot->'questions') with ordinality x(q,ord);
 return jsonb_build_object('sessionId',v_s.id,'attemptId',v_a.id,'title',v_s.snapshot->>'title','mode',v_s.mode,'questions',v_questions,'selectedIndices',v_a.selected_indices);
end $$;

create or replace function public.complete_study_attempt(p_attempt_id uuid,p_selected_indices jsonb,p_duration_seconds integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_a public.study_together_attempts%rowtype; v_p public.study_together_participants%rowtype; v_s public.study_together_sessions%rowtype; v_count int; v_score int; v_visible boolean; v_all_done boolean;
begin
 select * into v_a from public.study_together_attempts where id=p_attempt_id for update;
 select * into v_p from public.study_together_participants where id=v_a.participant_id and user_id=v_uid for update;
 select * into v_s from public.study_together_sessions where id=v_a.session_id for update;
 if v_a.id is null or v_p.id is null or v_s.status='cancelled' or jsonb_typeof(p_selected_indices)<>'array' or p_duration_seconds<0 then perform private.study_unavailable(); end if;
 if v_a.status='completed' then return jsonb_build_object('attemptId',v_a.id,'status','completed','score',v_a.score,'questionCount',v_a.question_count,'accuracy',v_a.accuracy,'durationSeconds',v_a.duration_seconds,'resultsVisible',(v_s.result_reveal_policy='immediate' or v_s.status='completed' or (v_s.result_reveal_policy='after_deadline' and v_s.deadline_at<=now()))); end if;
 v_count:=jsonb_array_length(v_s.snapshot->'questions'); if jsonb_array_length(p_selected_indices)<>v_count then perform private.study_unavailable(); end if;
 select count(*) into v_score from jsonb_array_elements(v_s.snapshot->'questions') with ordinality q(question,ord) where (p_selected_indices->>(ord-1))::int=(question->>'correctIndex')::int;
 update public.study_together_attempts set status='completed',selected_indices=p_selected_indices,score=v_score,question_count=v_count,accuracy=round(v_score*100.0/v_count,2),duration_seconds=p_duration_seconds,completed_at=now(),updated_at=now() where id=v_a.id;
 update public.study_together_participants set status='completed',score=v_score,accuracy=round(v_score*100.0/v_count,2),duration_seconds=p_duration_seconds,completed_at=now() where id=v_p.id;
 select bool_and(status='completed') into v_all_done from public.study_together_participants where session_id=v_s.id;
 if v_all_done then update public.study_together_sessions set status='completed',completed_at=now(),updated_at=now() where id=v_s.id; end if;
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(case when v_uid=v_s.creator_id then v_s.recipient_id else v_s.creator_id end,v_uid,'study_challenge_completed',v_s.id,'challenge:'||v_s.id||':completed:'||v_uid) on conflict(recipient_id,dedupe_key) do nothing;
 if v_all_done then insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(v_s.creator_id,null,'study_challenge_result_ready',v_s.id,'challenge:'||v_s.id||':result:'||v_s.creator_id),(v_s.recipient_id,null,'study_challenge_result_ready',v_s.id,'challenge:'||v_s.id||':result:'||v_s.recipient_id) on conflict(recipient_id,dedupe_key) do nothing; end if;
 v_visible:=v_s.result_reveal_policy='immediate' or v_all_done or (v_s.result_reveal_policy='after_deadline' and v_s.deadline_at<=now());
 return jsonb_build_object('attemptId',v_a.id,'status','completed','score',v_score,'questionCount',v_count,'accuracy',round(v_score*100.0/v_count,2),'durationSeconds',p_duration_seconds,'resultsVisible',v_visible);
end $$;

create or replace function public.list_study_challenges(p_limit integer default 20,p_before timestamptz default null) returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('challenges',coalesce(jsonb_agg(jsonb_build_object('sessionId',s.id,'status',s.status,'recipientId',s.recipient_id,'creatorId',s.creator_id,'title',s.snapshot->>'title','mode',s.mode,'deadlineAt',s.deadline_at,'createdAt',s.created_at) order by s.created_at desc),'[]'::jsonb)) from (select * from public.study_together_sessions where auth.uid() in (creator_id,recipient_id) and (p_before is null or created_at<p_before) order by created_at desc limit least(greatest(p_limit,1),50)) s $$;

create or replace function public.get_study_challenge(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare s public.study_together_sessions%rowtype; begin select * into s from public.study_together_sessions where id=p_session_id and auth.uid() in (creator_id,recipient_id); if s.id is null then perform private.study_unavailable(); end if; return jsonb_build_object('sessionId',s.id,'status',s.status,'title',s.snapshot->>'title','mode',s.mode,'deadlineAt',s.deadline_at,'resultsVisible',s.result_reveal_policy='immediate' or s.status='completed' or (s.result_reveal_policy='after_deadline' and s.deadline_at<=now())); end $$;

create or replace function public.decline_study_challenge(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare s public.study_together_sessions%rowtype; begin select * into s from public.study_together_sessions where id=p_session_id for update; if s.id is null or s.recipient_id<>auth.uid() or s.status<>'pending' then perform private.study_unavailable(); end if; update public.study_together_participants set status='declined' where session_id=s.id and role='recipient'; update public.study_together_sessions set status='cancelled',updated_at=now() where id=s.id; insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) values(s.creator_id,auth.uid(),'study_challenge_declined',s.id,'challenge:'||s.id||':declined') on conflict do nothing; return jsonb_build_object('sessionId',s.id,'status','cancelled'); end $$;

create or replace function public.save_study_attempt_progress(p_attempt_id uuid,p_selected_indices jsonb,p_current_question_index integer) returns jsonb language plpgsql security definer set search_path=public as $$ declare a public.study_together_attempts%rowtype; begin select a.* into a from public.study_together_attempts a join public.study_together_participants p on p.id=a.participant_id where a.id=p_attempt_id and p.user_id=auth.uid() for update; if a.id is null or a.status<>'in_progress' or jsonb_typeof(p_selected_indices)<>'array' or jsonb_array_length(p_selected_indices)>500 or p_current_question_index<0 or p_current_question_index>499 then perform private.study_unavailable(); end if; update public.study_together_attempts set selected_indices=p_selected_indices,current_question_index=p_current_question_index,updated_at=now() where id=a.id; return jsonb_build_object('attemptId',a.id,'saved',true); end $$;

create or replace function public.list_social_notifications(p_limit integer default 20,p_before timestamptz default null) returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('notifications',coalesce(jsonb_agg(jsonb_build_object('id',n.id,'type',n.type,'recipientId',n.recipient_id,'actorId',n.actor_id,'entityId',n.entity_id,'payload',n.payload,'createdAt',n.created_at,'readAt',n.read_at,'archivedAt',n.archived_at) order by n.created_at desc),'[]'::jsonb)) from (select * from public.social_notifications where recipient_id=auth.uid() and archived_at is null and (p_before is null or created_at<p_before) order by created_at desc limit least(greatest(p_limit,1),50)) n $$;

create or replace function public.mark_social_notification_read(p_notification_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ begin update public.social_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid() and archived_at is null; if not found then perform private.study_unavailable(); end if; return jsonb_build_object('ok',true); end $$;

create or replace function public.mark_all_social_notifications_read() returns jsonb language sql security definer set search_path=public as $$ with changed as (update public.social_notifications set read_at=coalesce(read_at,now()) where recipient_id=auth.uid() and archived_at is null and read_at is null returning 1) select jsonb_build_object('count',count(*)) from changed $$;

create or replace function public.archive_study_challenge_notification(p_session_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ begin update public.social_notifications set archived_at=coalesce(archived_at,now()) where recipient_id=auth.uid() and entity_id=p_session_id and type='study_challenge_received'; if not found then perform private.study_unavailable(); end if; return jsonb_build_object('ok',true); end $$;

create or replace function public.get_social_notification_unread_count() returns jsonb language sql security definer set search_path=public as $$ select jsonb_build_object('count',count(*)) from public.social_notifications where recipient_id=auth.uid() and read_at is null and archived_at is null $$;

create or replace function public.sweep_study_challenge_reminders() returns integer language plpgsql security definer set search_path=public as $$ declare v_count int; begin
 insert into public.social_notifications(recipient_id,actor_id,type,entity_id,dedupe_key) select recipient_id,creator_id,'study_challenge_expiring',id,'challenge:'||id||':expiring' from public.study_together_sessions where status in ('pending','active') and deadline_at>now() and deadline_at<=now()+interval '24 hours' on conflict(recipient_id,dedupe_key) do nothing; get diagnostics v_count=row_count; return v_count; end $$;

create or replace function public.broadcast_social_notification() returns trigger language plpgsql security definer set search_path=public as $$ begin perform realtime.send(jsonb_build_object('notificationId',new.id),'notification','social-notifications:'||new.recipient_id::text,true); return new; exception when others then return new; end $$;

create or replace function public.remove_friend(p_other_user_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare v_uid uuid:=auth.uid(); begin
 if v_uid is null or p_other_user_id is null then perform private.study_unavailable(); end if;
 update public.friend_requests set status='cancelled' where status='accepted' and ((sender_id=v_uid and recipient_id=p_other_user_id) or (sender_id=p_other_user_id and recipient_id=v_uid));
 if not found then perform private.study_unavailable(); end if;
 update public.study_together_sessions set status='cancelled',updated_at=now() where status='pending' and ((creator_id=v_uid and recipient_id=p_other_user_id) or (creator_id=p_other_user_id and recipient_id=v_uid));
 return jsonb_build_object('ok',true);
end $$;

create or replace function private.cancel_study_sessions_for_block(p_user_a uuid,p_user_b uuid) returns void language sql security definer set search_path=public as $$ update public.study_together_sessions set status='cancelled',updated_at=now() where status in ('pending','active') and ((creator_id=p_user_a and recipient_id=p_user_b) or (creator_id=p_user_b and recipient_id=p_user_a)) $$;

create or replace function public.list_social_friends(p_limit integer,p_cursor jsonb default null,p_presence text default 'offline') returns jsonb language sql security definer set search_path=public as $$
with owned as (select case when fr.sender_id=auth.uid() then fr.recipient_id else fr.sender_id end user_id from public.friend_requests fr where auth.uid() is not null and fr.status='accepted' and auth.uid() in(fr.sender_id,fr.recipient_id)), rows as (select o.user_id,p.username,p.avatar_path,case when a.last_active_at>=now()-interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end presence_rank,a.last_active_at from owned o join public.profiles p on p.id=o.user_id left join private.social_activity a on a.user_id=o.user_id where not private.social_users_blocked(auth.uid(),o.user_id) and p_presence in('online','offline') and ((p_presence='online' and case when a.last_active_at>=now()-interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end=0) or (p_presence='offline' and case when a.last_active_at>=now()-interval '5 minutes' then 0 when a.last_active_at is not null then 1 else 2 end in(1,2)))), page as(select * from rows where p_cursor is null or (presence_rank,coalesce(username,''),user_id::text)>((p_cursor->>0)::int,p_cursor->>1,p_cursor->>2) order by presence_rank,coalesce(username,''),user_id limit least(greatest(p_limit,1),51)) select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'username',username,'avatarPath',avatar_path,'presenceRank',presence_rank,'presence',case presence_rank when 0 then 'online' when 1 then 'recently_active' else 'offline' end,'lastActiveAt',last_active_at) order by presence_rank,coalesce(username,''),user_id),'[]'),'totalCount',(select count(*) from rows)) from page $$;

create or replace function public.list_social_friend_requests(p_limit integer,p_cursor jsonb default null,p_direction text default 'incoming') returns jsonb language sql security definer set search_path=public as $$ with rows as (select fr.id request_id,case when p_direction='incoming' then fr.sender_id else fr.recipient_id end other_user_id,p.username,fr.created_at from public.friend_requests fr join public.profiles p on p.id=case when p_direction='incoming' then fr.sender_id else fr.recipient_id end where auth.uid() is not null and p_direction in('incoming','outgoing') and fr.status='pending' and ((p_direction='incoming' and fr.recipient_id=auth.uid()) or (p_direction='outgoing' and fr.sender_id=auth.uid()))),page as(select * from rows where p_cursor is null or (created_at,request_id)<((p_cursor->>0)::timestamptz,(p_cursor->>1)::uuid) order by created_at desc,request_id desc limit least(greatest(p_limit,1),51)) select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('requestId',request_id,'otherUserId',other_user_id,'username',username,'createdAt',created_at) order by created_at desc,request_id desc),'[]'),'totalCount',(select count(*) from rows)) from page $$;

create or replace function public.list_social_invites(p_limit integer,p_cursor jsonb default null) returns jsonb language sql security definer set search_path=public as $$ with rows as(select s.id session_id,s.creator_id,p.username,s.snapshot->>'title' title,s.created_at from public.study_together_sessions s join public.profiles p on p.id=s.creator_id where auth.uid() is not null and s.recipient_id=auth.uid() and s.status='pending'),page as(select * from rows where p_cursor is null or (created_at,session_id)<((p_cursor->>0)::timestamptz,(p_cursor->>1)::uuid) order by created_at desc,session_id desc limit least(greatest(p_limit,1),51)) select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('sessionId',session_id,'creatorId',creator_id,'username',username,'title',title,'createdAt',created_at) order by created_at desc,session_id desc),'[]'),'totalCount',(select count(*) from rows)) from page $$;

create or replace function public.list_social_conversations(p_limit integer,p_cursor jsonb default null) returns jsonb language sql security definer set search_path=public as $$ with rows as(select c.id conversation_id,c.last_message_at,case when c.user_low_id=auth.uid() then c.user_high_id else c.user_low_id end peer_id from public.direct_conversations c where auth.uid() is not null and auth.uid() in(c.user_low_id,c.user_high_id)),page as(select r.*,p.username,(select body from public.direct_messages m where m.conversation_id=r.conversation_id order by created_at desc,id desc limit 1) preview from rows r join public.profiles p on p.id=r.peer_id where p_cursor is null or (coalesce(r.last_message_at,'epoch'),r.conversation_id)<(coalesce((p_cursor->>0)::timestamptz,'epoch'),(p_cursor->>1)::uuid) order by r.last_message_at desc nulls last,r.conversation_id desc limit least(greatest(p_limit,1),51)) select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('conversationId',conversation_id,'peerId',peer_id,'username',username,'lastMessageAt',last_message_at,'preview',preview) order by last_message_at desc nulls last,conversation_id desc),'[]')) from page $$;

create or replace function public.list_social_blocks(p_limit integer,p_cursor jsonb default null) returns jsonb language sql security definer set search_path=public as $$ with rows as(select b.blocked_id user_id,p.username,b.created_at blocked_at from public.user_blocks b join public.profiles p on p.id=b.blocked_id where auth.uid() is not null and b.blocker_id=auth.uid()),page as(select * from rows where p_cursor is null or (blocked_at,user_id)<((p_cursor->>0)::timestamptz,(p_cursor->>1)::uuid) order by blocked_at desc,user_id desc limit least(greatest(p_limit,1),51)) select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'username',username,'blockedAt',blocked_at) order by blocked_at desc,user_id desc),'[]'),'totalCount',(select count(*) from rows)) from page $$;

revoke all on function public.replace_quiz_questions(uuid, integer, jsonb)
  from public;

grant execute on function public.replace_quiz_questions(uuid, integer, jsonb)
  to authenticated;

revoke all on function public.replace_canonical_content(
  uuid, text, jsonb, text, integer, jsonb
) from public;

grant execute on function public.replace_canonical_content(
  uuid, text, jsonb, text, integer, jsonb
) to authenticated;

revoke all on function public.reclaim_expired_generation_reservations(uuid) from public;

revoke all on function public.reserve_generation_quota(uuid, text) from public;

revoke all on function public.commit_generation_quota(uuid) from public;

revoke all on function public.release_generation_quota(uuid) from public;

revoke all on function public.get_generation_quota_availability(uuid) from public;

grant execute on function public.reserve_generation_quota(uuid, text) to authenticated;

grant execute on function public.commit_generation_quota(uuid) to authenticated;

grant execute on function public.release_generation_quota(uuid) to authenticated;

grant execute on function public.get_generation_quota_availability(uuid) to authenticated;

revoke all on function private.normalize_username(text) from public;

revoke all on function private.social_users_blocked(uuid, uuid) from public;

revoke all on function private.social_users_blocked(uuid, uuid) from anon;

revoke all on function private.social_raise_rate_limited(uuid) from public;

revoke all on function private.social_raise_rate_limited(uuid) from anon;

revoke all on function private.social_validate_username(text) from public;

revoke all on function private.social_validate_username(text) from anon;

revoke all on function public.set_profile_username(text) from public;

revoke all on function public.set_profile_username(text) from anon;

grant execute on function public.set_profile_username(text) to authenticated;

revoke all on function public.send_friend_request(text) from public;

revoke all on function public.send_friend_request(text) from anon;

grant execute on function public.send_friend_request(text) to authenticated;

revoke all on function public.block_user(uuid) from public;

revoke all on function public.block_user(uuid) from anon;

revoke all on function public.unblock_user(uuid) from public;

revoke all on function public.unblock_user(uuid) from anon;

grant execute on function public.block_user(uuid) to authenticated;

grant execute on function public.unblock_user(uuid) to authenticated;

revoke all on function public.report_user(uuid, text, text) from public;

revoke all on function public.report_user(uuid, text, text) from anon;

grant execute on function public.report_user(uuid, text, text) to authenticated;

revoke all on function public.purge_expired_user_reports() from public;

revoke all on function public.purge_expired_user_reports() from anon;

revoke all on function public.purge_expired_user_reports() from authenticated;

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

revoke all on function private.sha256_utf8_hex(text) from public;

revoke all on function private.can_workspace(uuid, text) from public;

revoke all on function private.can_workspace(uuid, text) from anon;

grant execute on function private.can_workspace(uuid, text) to authenticated;

revoke all on function public.resolve_learning_output_bridge(uuid, text) from public;

revoke all on function public.resolve_learning_output_bridge(uuid, text) from anon;

grant execute on function public.resolve_learning_output_bridge(uuid, text) to authenticated;

revoke all on function private.backfill_legacy_study_set(uuid) from public;

revoke all on function private.backfill_legacy_study_set(uuid) from anon;

grant execute on function private.backfill_legacy_study_set(uuid) to service_role;

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public;

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from anon;

grant execute on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

revoke all on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) from public;

revoke all on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) from anon;

grant execute on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) to authenticated;

revoke all on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) from public;

revoke all on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) from anon;

grant execute on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) to authenticated;

revoke all on function private.workspace_role(uuid) from public;

revoke all on function private.workspace_role(uuid) from anon;

revoke all on function private.can_view_workspace(uuid) from public;

revoke all on function private.can_view_workspace(uuid) from anon;

revoke all on function private.can_edit_workspace(uuid) from public;

revoke all on function private.can_edit_workspace(uuid) from anon;

revoke all on function private.is_workspace_owner(uuid) from public;

revoke all on function private.is_workspace_owner(uuid) from anon;

grant execute on function private.workspace_role(uuid) to authenticated;

grant execute on function private.can_view_workspace(uuid) to authenticated;

grant execute on function private.can_edit_workspace(uuid) to authenticated;

grant execute on function private.is_workspace_owner(uuid) to authenticated;

revoke all on function private.can_workspace(uuid, text) from public;

revoke all on function private.can_workspace(uuid, text) from anon;

grant execute on function private.can_workspace(uuid, text) to authenticated;

revoke all on function private.storage_object_workspace_id(text) from public;

revoke all on function private.storage_object_workspace_id(text) from anon;

grant execute on function private.storage_object_workspace_id(text) to authenticated;

revoke all on function private.assert_workspace_share_target(uuid, text, uuid, text) from public;

revoke all on function private.assert_workspace_share_target(uuid, text, uuid, text) from anon;

grant execute on function public.create_workspace_invitation(uuid, uuid, text) to authenticated;

grant execute on function public.list_workspace_invitations(uuid) to authenticated;

grant execute on function public.revoke_workspace_invitation(uuid) to authenticated;

grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

grant execute on function public.list_workspace_members(uuid) to authenticated;

grant execute on function public.change_workspace_member_role(uuid, uuid, text) to authenticated;

grant execute on function public.revoke_workspace_member(uuid, uuid) to authenticated;

grant execute on function public.create_workspace_share(uuid, text, uuid, bytea) to authenticated;

grant execute on function public.list_workspace_shares(uuid) to authenticated;

grant execute on function public.revoke_workspace_share(uuid) to authenticated;

revoke all on function public.resolve_public_share_by_digest(bytea) from public;

revoke all on function public.resolve_public_share_by_digest(bytea) from anon;

revoke all on function public.resolve_public_share_by_digest(bytea) from authenticated;

grant execute on function public.resolve_public_share_by_digest(bytea) to service_role;

revoke all on function public.import_anonymous_quiz_attempts(jsonb) from public;

revoke all on function public.import_anonymous_quiz_attempts(jsonb) from anon;

grant execute on function public.import_anonymous_quiz_attempts(jsonb) to authenticated;

revoke all on function public.resolve_public_share_by_digest(bytea) from public;

revoke all on function public.resolve_public_share_by_digest(bytea) from anon;

revoke all on function public.resolve_public_share_by_digest(bytea) from authenticated;

grant execute on function public.resolve_public_share_by_digest(bytea) to service_role;

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public;

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from anon;

grant execute on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

revoke all on function private.social_are_accepted_friends(uuid, uuid) from public, anon;

revoke all on function private.social_require_friend(uuid) from public, anon;

drop function if exists public.send_direct_message(uuid, text);
revoke all on function public.authorize_direct_message_upload(uuid), public.register_direct_message_upload(uuid, uuid, text, text, bigint, text), public.discard_direct_message_uploads(uuid, uuid[]), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text, uuid[]) from public, anon;
grant execute on function public.authorize_direct_message_upload(uuid), public.register_direct_message_upload(uuid, uuid, text, text, bigint, text), public.discard_direct_message_uploads(uuid, uuid[]), public.list_direct_messages(uuid, timestamptz, integer), public.send_direct_message(uuid, text, uuid[]) to authenticated;
revoke all on function public.list_accepted_friends(), public.list_incoming_friend_requests(), public.open_direct_conversation(uuid), public.update_reaction_preferences(boolean, uuid[]), public.send_preset_reaction(uuid, text), public.touch_social_activity() from public, anon;
grant execute on function public.list_accepted_friends(), public.list_incoming_friend_requests(), public.open_direct_conversation(uuid), public.update_reaction_preferences(boolean, uuid[]), public.send_preset_reaction(uuid, text), public.touch_social_activity() to authenticated;

revoke all on function public.record_learning_streak(text) from public;

revoke all on function public.get_learning_streak(text) from public;

revoke all on function public.start_learning_streak_recovery(text) from public;

grant execute on function public.record_learning_streak(text) to authenticated;

grant execute on function public.get_learning_streak(text) to authenticated;

grant execute on function public.start_learning_streak_recovery(text) to authenticated;

revoke all on function public.set_profile_username(text) from public, anon;

grant execute on function public.set_profile_username(text) to authenticated;

revoke all on function public.send_friend_request(text) from public, anon;

grant execute on function public.send_friend_request(text) to authenticated;

alter function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) security definer;

alter function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) set search_path = public, private;

alter function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) security definer;

alter function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) set search_path = public, private;

alter function public.resolve_learning_output_bridge(uuid, text)
  security definer;

alter function public.resolve_learning_output_bridge(uuid, text)
  set search_path = public, private;

revoke all on function public.get_friend_profile(uuid) from public, anon;

grant execute on function public.get_friend_profile(uuid) to authenticated;

revoke all on function public.get_friend_profile(uuid) from public, anon;

revoke all on function public.set_quiz_friend_share(uuid, boolean) from public, anon;

revoke all on function public.get_friend_shared_quiz(uuid, uuid) from public, anon;

grant execute on function public.get_friend_profile(uuid) to authenticated;

grant execute on function public.set_quiz_friend_share(uuid, boolean) to authenticated;

grant execute on function public.get_friend_shared_quiz(uuid, uuid) to authenticated;

revoke all on function private.storage_object_profile_avatar_owner_id(text) from public, anon;

grant execute on function private.storage_object_profile_avatar_owner_id(text) to authenticated;

revoke all on function public.mark_direct_conversation_read(uuid) from public, anon;

grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;

revoke all on function private.study_unavailable() from public, anon, authenticated;

revoke all on function private.study_open_attempt(uuid,text,boolean) from public,anon,authenticated;

revoke all on function private.cancel_study_sessions_for_block(uuid,uuid) from public,anon,authenticated;

revoke all on function public.create_study_challenge(uuid,uuid,text,timestamptz,text,text),public.start_study_challenge_attempt(uuid),public.accept_study_challenge(uuid),public.get_study_attempt_practice(uuid),public.complete_study_attempt(uuid,jsonb,integer),public.list_study_challenges(integer,timestamptz),public.get_study_challenge(uuid),public.decline_study_challenge(uuid),public.save_study_attempt_progress(uuid,jsonb,integer),public.list_social_notifications(integer,timestamptz),public.mark_social_notification_read(uuid),public.mark_all_social_notifications_read(),public.archive_study_challenge_notification(uuid),public.get_social_notification_unread_count(),public.sweep_study_challenge_reminders(),public.remove_friend(uuid) from public,anon;

grant execute on function public.create_study_challenge(uuid,uuid,text,timestamptz,text,text),public.start_study_challenge_attempt(uuid),public.accept_study_challenge(uuid),public.get_study_attempt_practice(uuid),public.complete_study_attempt(uuid,jsonb,integer),public.list_study_challenges(integer,timestamptz),public.get_study_challenge(uuid),public.decline_study_challenge(uuid),public.save_study_attempt_progress(uuid,jsonb,integer),public.list_social_notifications(integer,timestamptz),public.mark_social_notification_read(uuid),public.mark_all_social_notifications_read(),public.archive_study_challenge_notification(uuid),public.get_social_notification_unread_count(),public.sweep_study_challenge_reminders(),public.remove_friend(uuid) to authenticated;

revoke all on function public.resolve_profile_user(text),public.resolve_friend_user(text) from public,anon;

grant execute on function public.resolve_profile_user(text),public.resolve_friend_user(text) to authenticated;

grant execute on function public.get_public_profile(uuid) to authenticated;

revoke all on function public.list_social_friends(integer,jsonb,text),public.list_social_friend_requests(integer,jsonb,text),public.list_social_invites(integer,jsonb),public.list_social_conversations(integer,jsonb),public.list_social_blocks(integer,jsonb) from public,anon;

grant execute on function public.list_social_friends(integer,jsonb,text),public.list_social_friend_requests(integer,jsonb,text),public.list_social_invites(integer,jsonb),public.list_social_conversations(integer,jsonb),public.list_social_blocks(integer,jsonb) to authenticated;

revoke all on function private.storage_object_profile_avatar_owner_id(text) from public, anon;

grant execute on function private.storage_object_profile_avatar_owner_id(text) to authenticated;

create trigger study_sets_set_updated_at
before update on public.study_sets
for each row
execute function public.set_updated_at();

create trigger canonical_documents_set_updated_at
before update on public.canonical_documents
for each row
execute function public.set_updated_at();

create trigger canonical_sections_set_updated_at
before update on public.canonical_sections
for each row
execute function public.set_updated_at();

create trigger approved_questions_set_updated_at
before update on public.approved_questions
for each row
execute function public.set_updated_at();

create trigger approved_flashcards_set_updated_at
before update on public.approved_flashcards
for each row
execute function public.set_updated_at();

create trigger profiles_sync_username_normalized
before insert or update of username on public.profiles
for each row
execute function public.sync_profile_username_normalized();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

create trigger learning_outputs_set_updated_at
before update on public.learning_outputs
for each row
execute function public.set_updated_at();

create trigger social_notifications_broadcast after insert on public.social_notifications for each row execute function public.broadcast_social_notification();
