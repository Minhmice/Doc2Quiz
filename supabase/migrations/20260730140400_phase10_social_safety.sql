-- Phase 10 social safety: normalized usernames, friend requests, blocks, reports, RPC authority.
begin;

-- ---------------------------------------------------------------------------
-- Profile username columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text null,
  add column if not exists username_normalized text null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    username is null
    or (
      char_length(username) between 3 and 30
      and username_normalized = lower(btrim(username))
      and username_normalized ~ '^[a-z0-9_]{3,30}$'
    )
  );

create unique index if not exists profiles_username_normalized_unique
  on public.profiles (username_normalized)
  where username_normalized is not null;

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

drop trigger if exists profiles_sync_username_normalized on public.profiles;
create trigger profiles_sync_username_normalized
before insert or update of username on public.profiles
for each row
execute function public.sync_profile_username_normalized();

-- ---------------------------------------------------------------------------
-- Social tables
-- ---------------------------------------------------------------------------

create table if not exists private.social_friend_request_events (
  id bigserial primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists social_friend_request_events_sender_created_idx
  on private.social_friend_request_events (sender_id, created_at desc);

revoke all on table private.social_friend_request_events from public;
revoke all on table private.social_friend_request_events from anon;
revoke all on table private.social_friend_request_events from authenticated;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint friend_requests_no_self check (sender_id <> recipient_id)
);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);

create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);

create unique index if not exists friend_requests_pending_pair_unique
  on public.friend_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  )
  where status = 'pending';

alter table public.friend_requests enable row level security;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text null,
  created_at timestamptz not null default now(),
  constraint user_reports_reason_len check (char_length(reason) between 1 and 120),
  constraint user_reports_details_len check (details is null or char_length(details) <= 500),
  constraint user_reports_no_self check (reporter_id <> reported_user_id)
);

alter table public.user_reports enable row level security;

revoke all on table public.friend_requests from anon, authenticated;
revoke all on table public.user_blocks from anon, authenticated;
revoke all on table public.user_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.normalize_username(p_username text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(p_username));
$$;

revoke all on function private.normalize_username(text) from public;

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

revoke all on function private.social_users_blocked(uuid, uuid) from public;
revoke all on function private.social_users_blocked(uuid, uuid) from anon;

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

revoke all on function private.social_raise_rate_limited(uuid) from public;
revoke all on function private.social_raise_rate_limited(uuid) from anon;

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

revoke all on function private.social_validate_username(text) from public;
revoke all on function private.social_validate_username(text) from anon;

-- ---------------------------------------------------------------------------
-- Username RPC
-- ---------------------------------------------------------------------------

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
      updated_at = now()
  where id = v_user_id;

  if not found then
    insert into public.profiles (id, username)
    values (v_user_id, v_normalized);
  end if;

  return jsonb_build_object('username', v_normalized);
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

revoke all on function public.set_profile_username(text) from public;
revoke all on function public.set_profile_username(text) from anon;
grant execute on function public.set_profile_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Friend request RPC
-- ---------------------------------------------------------------------------

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
  where p.username_normalized = v_normalized;

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

revoke all on function public.send_friend_request(text) from public;
revoke all on function public.send_friend_request(text) from anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Block RPCs
-- ---------------------------------------------------------------------------

create or replace function public.block_user(p_user_id uuid)
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
  if p_user_id is null or p_user_id = v_user_id then
    raise exception 'request_unavailable';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_user_id, p_user_id)
  on conflict do nothing;

  update public.friend_requests fr
  set status = 'cancelled',
      responded_at = now()
  where fr.status = 'pending'
    and (
      (fr.sender_id = v_user_id and fr.recipient_id = p_user_id)
      or (fr.sender_id = p_user_id and fr.recipient_id = v_user_id)
    );

  return jsonb_build_object('ok', true);
end;
$$;

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

revoke all on function public.block_user(uuid) from public;
revoke all on function public.block_user(uuid) from anon;
revoke all on function public.unblock_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Report RPC
-- ---------------------------------------------------------------------------

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

revoke all on function public.report_user(uuid, text, text) from public;
revoke all on function public.report_user(uuid, text, text) from anon;
grant execute on function public.report_user(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Report retention purge (admin/service only)
-- ---------------------------------------------------------------------------

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

revoke all on function public.purge_expired_user_reports() from public;
revoke all on function public.purge_expired_user_reports() from anon;
revoke all on function public.purge_expired_user_reports() from authenticated;

commit;
