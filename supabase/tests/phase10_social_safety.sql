-- Phase 10 social safety matrix.
-- Run: supabase db reset && supabase test db --file supabase/tests/phase10_social_safety.sql

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.social_assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.social_as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.social_expect_exception(
  p_sql text,
  p_message_contains text
)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    raise exception 'expected exception containing %, but statement succeeded', p_message_contains;
  exception
    when others then
      if position(p_message_contains in sqlerrm) = 0 then
        raise exception 'expected exception containing %, got %', p_message_contains, sqlerrm;
      end if;
  end;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-sender@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-recipient@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-blocked@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-sender@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-10@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-11@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-12@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-13@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-14@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-15@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-16@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-17@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-18@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-19@example.com', crypt('pw', gen_salt('bf')), now()),
  ('d2000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'social-rate-20@example.com', crypt('pw', gen_salt('bf')), now())
on conflict (id) do nothing;

-- Username normalization and collision
select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000001');
select pg_temp.social_assert_true(
  (select public.set_profile_username('  Alice  ') = jsonb_build_object('username', 'alice')),
  'username RPC normalizes with lower(btrim())'
);

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000002');
select pg_temp.social_expect_exception(
  'select public.set_profile_username(''ALICE'')',
  'username_taken'
);

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000001');
select public.set_profile_username('social_sender');

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000002');
select public.set_profile_username('social_recipient');

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000003');
select public.set_profile_username('social_blocked');

-- Self, unknown, pending, reverse, and blocked paths stay generic
select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000001');
select pg_temp.social_expect_exception(
  'select public.send_friend_request(''social_sender'')',
  'request_unavailable'
);

select pg_temp.social_expect_exception(
  'select public.send_friend_request(''missing_user'')',
  'request_unavailable'
);

select pg_temp.social_assert_true(
  (
    select (public.send_friend_request('social_recipient') ->> 'ok') = 'true'
      and exists (
        select 1
        from public.friend_requests fr
        where fr.sender_id = 'd1000000-0000-0000-0000-000000000001'
          and fr.recipient_id = 'd1000000-0000-0000-0000-000000000002'
          and fr.status = 'pending'
      )
  ),
  'pending friend request can be created once'
);

select pg_temp.social_expect_exception(
  'select public.send_friend_request(''social_recipient'')',
  'request_unavailable'
);

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000002');
select pg_temp.social_expect_exception(
  'select public.send_friend_request(''social_sender'')',
  'request_unavailable'
);

select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000001');
select pg_temp.social_assert_true(
  (select public.block_user('d1000000-0000-0000-0000-000000000003') = jsonb_build_object('ok', true)),
  'block_user succeeds'
);

select pg_temp.social_expect_exception(
  'select public.send_friend_request(''social_blocked'')',
  'request_unavailable'
);

-- Rolling hour cap: tenth succeeds, eleventh typed retry
reset role;
insert into public.profiles (id, username)
values
  ('d2000000-0000-0000-0000-000000000010', 'rate_target_01'),
  ('d2000000-0000-0000-0000-000000000011', 'rate_target_02'),
  ('d2000000-0000-0000-0000-000000000012', 'rate_target_03'),
  ('d2000000-0000-0000-0000-000000000013', 'rate_target_04'),
  ('d2000000-0000-0000-0000-000000000014', 'rate_target_05'),
  ('d2000000-0000-0000-0000-000000000015', 'rate_target_06'),
  ('d2000000-0000-0000-0000-000000000016', 'rate_target_07'),
  ('d2000000-0000-0000-0000-000000000017', 'rate_target_08'),
  ('d2000000-0000-0000-0000-000000000018', 'rate_target_09'),
  ('d2000000-0000-0000-0000-000000000019', 'rate_target_10'),
  ('d2000000-0000-0000-0000-000000000020', 'rate_target_11')
on conflict (id) do update set username = excluded.username;

select pg_temp.social_as_user('d2000000-0000-0000-0000-000000000001');
select pg_temp.social_assert_true(
  (select public.send_friend_request('rate_target_01') ->> 'ok') = 'true',
  'rate window first send succeeds'
);

do $$
declare
  v_idx integer;
begin
  for v_idx in 2..10 loop
    perform public.send_friend_request('rate_target_' || lpad(v_idx::text, 2, '0'));
  end loop;
end;
$$;

select pg_temp.social_assert_true(
  (
    select count(*) = 10
    from private.social_friend_request_events
    where sender_id = 'd2000000-0000-0000-0000-000000000001'
  ),
  'rolling hour allows exactly ten sends'
);

do $$
begin
  begin
    perform public.send_friend_request('rate_target_11');
    raise exception 'expected rate_limited on eleventh send';
  exception
    when others then
      if position('rate_limited' in sqlerrm) = 0 then
        raise exception 'expected rate_limited, got %', sqlerrm;
      end if;
      if pg_exception_detail() is null or pg_exception_detail() !~ '^[0-9]+$' then
        raise exception 'rate_limited missing retry detail';
      end if;
  end;
end;
$$;

-- Reports are private to callers; acknowledgement has no report payload
select pg_temp.social_as_user('d1000000-0000-0000-0000-000000000001');
select pg_temp.social_assert_true(
  (
    select public.report_user(
      'd1000000-0000-0000-0000-000000000003',
      'spam',
      'details'
    ) = jsonb_build_object('ok', true)
  ),
  'report_user returns acknowledgement only'
);

select pg_temp.social_assert_true(
  (select count(*) = 0 from public.user_reports),
  'authenticated caller cannot read user_reports directly'
);

reset role;
insert into public.user_reports (
  reporter_id,
  reported_user_id,
  reason,
  created_at
)
values (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000003',
  'old',
  now() - interval '91 days'
);

select pg_temp.social_assert_true(
  public.purge_expired_user_reports() >= 1,
  'purge_expired_user_reports deletes reports older than 90 days'
);

commit;
