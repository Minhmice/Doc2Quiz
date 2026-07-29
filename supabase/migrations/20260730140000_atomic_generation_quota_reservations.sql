-- Reservation TTL exceeds API route maxDuration (300s) by two minutes.
alter table public.quota_consumptions
  add column if not exists state text not null default 'committed',
  add column if not exists reservation_token uuid,
  add column if not exists reserved_at timestamptz,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists committed_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists release_reason text;

alter table public.quota_consumptions
  drop constraint if exists quota_consumptions_state_check,
  add constraint quota_consumptions_state_check check (state in ('reserved', 'committed', 'released'));

update public.quota_consumptions
set state = 'committed',
    committed_at = coalesce(committed_at, consumed_at)
where state is null or state <> 'committed';

create unique index if not exists quota_consumptions_reservation_token_unique
  on public.quota_consumptions (reservation_token)
  where reservation_token is not null;

create index if not exists quota_consumptions_user_state_consumed_at_idx
  on public.quota_consumptions (user_id, state, consumed_at);

create index if not exists quota_consumptions_active_expiry_idx
  on public.quota_consumptions (reservation_expires_at)
  where state = 'reserved';

-- Direct client writes bypass lifecycle validation and wallet accounting.
drop policy if exists "Users can create own quota wallet" on public.user_quota_wallet;
drop policy if exists "Users can update own quota wallet" on public.user_quota_wallet;
drop policy if exists "Users can create own quota consumptions" on public.quota_consumptions;

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

revoke all on function public.reclaim_expired_generation_reservations(uuid) from public;
revoke all on function public.reserve_generation_quota(uuid, text) from public;
revoke all on function public.commit_generation_quota(uuid) from public;
revoke all on function public.release_generation_quota(uuid) from public;
revoke all on function public.get_generation_quota_availability(uuid) from public;
grant execute on function public.reserve_generation_quota(uuid, text) to authenticated;
grant execute on function public.commit_generation_quota(uuid) to authenticated;
grant execute on function public.release_generation_quota(uuid) to authenticated;
grant execute on function public.get_generation_quota_availability(uuid) to authenticated;
