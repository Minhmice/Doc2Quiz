-- Run after `supabase db reset`:
--   psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/quota_reservation_concurrency.sql
-- This script uses authenticated JWT claims and public RPCs only. It rolls back all fixtures.

\set ON_ERROR_STOP on

begin;

create temp table quota_test_context (
  user_id uuid primary key,
  study_set_ids uuid[] not null
) on commit drop;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '80000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'quota-reservation-test@example.com',
  crypt('test-password', gen_salt('bf')),
  now()
);

insert into public.study_sets (id, user_id, title, pipeline_stage, content_kind)
select
  ('81000000-0000-0000-0000-' || lpad(series::text, 12, '0'))::uuid,
  '80000000-0000-0000-0000-000000000001'::uuid,
  'Quota reservation test ' || series,
  'input',
  'quiz'
from generate_series(1, 15) as series;

insert into quota_test_context (user_id, study_set_ids)
select
  '80000000-0000-0000-0000-000000000001'::uuid,
  array_agg(id order by id)
from public.study_sets
where user_id = '80000000-0000-0000-0000-000000000001'::uuid;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
  true
)
from quota_test_context;
set local role authenticated;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

-- Ten sequential reservations fill weekly capacity, then commit each generation.
do $$
declare
  ids uuid[];
  result jsonb;
  index integer;
begin
  select study_set_ids into ids from quota_test_context;
  for index in 1..10 loop
    result := public.reserve_generation_quota(ids[index], 'quiz');
    perform pg_temp.assert_true(result->>'status' = 'reserved', 'weekly reserve succeeds');
    perform pg_temp.assert_true((result->>'usedBonus')::boolean is false, 'weekly reservation does not spend bonus');
    result := public.commit_generation_quota((result->>'reservationToken')::uuid);
    perform pg_temp.assert_true(result->>'status' = 'committed', 'weekly reservation commits');
  end loop;
end;
$$;

select pg_temp.assert_true(
  (select count(*) = 10 from public.quota_consumptions where user_id = (select user_id from quota_test_context) and state = 'committed'),
  'ten committed quota rows exist'
);

-- Boundary denial returns stable quota DTO and writes no row.
do $$
declare
  ids uuid[];
  result jsonb;
begin
  select study_set_ids into ids from quota_test_context;
  result := public.reserve_generation_quota(ids[11], 'quiz');
  perform pg_temp.assert_true(result->>'status' = 'quota_exceeded', 'eleventh reserve denied');
  perform pg_temp.assert_true((result->>'weeklyUsed')::integer = 10, 'denial reports committed weekly usage');
  perform pg_temp.assert_true((result->>'bonusCredits')::integer = 0, 'denial reports empty wallet');
end;
$$;

select pg_temp.assert_true(
  (select count(*) = 10 from public.quota_consumptions where user_id = (select user_id from quota_test_context)),
  'denial creates no reservation'
);

reset role;
update public.user_quota_wallet
set bonus_credits = 1
where user_id = (select user_id from quota_test_context);
insert into public.user_quota_wallet (user_id, bonus_credits)
select user_id, 1 from quota_test_context
on conflict (user_id) do update set bonus_credits = excluded.bonus_credits;
set local role authenticated;

-- One remaining bonus credit reserves exactly one distinct set. The second call sees zero.
do $$
declare
  ids uuid[];
  first_result jsonb;
  second_result jsonb;
begin
  select study_set_ids into ids from quota_test_context;
  first_result := public.reserve_generation_quota(ids[11], 'quiz');
  second_result := public.reserve_generation_quota(ids[12], 'flashcards');
  perform pg_temp.assert_true(first_result->>'status' = 'reserved', 'first bonus reservation succeeds');
  perform pg_temp.assert_true((first_result->>'usedBonus')::boolean, 'first reservation spends bonus');
  perform pg_temp.assert_true(second_result->>'status' = 'quota_exceeded', 'second bonus reservation denied');
  perform pg_temp.assert_true((select bonus_credits = 0 from public.user_quota_wallet where user_id = (select user_id from quota_test_context)), 'wallet decremented once');

  perform pg_temp.assert_true(
    public.release_generation_quota((first_result->>'reservationToken')::uuid)->>'status' = 'released',
    'bonus reservation releases'
  );
  perform pg_temp.assert_true(
    public.release_generation_quota((first_result->>'reservationToken')::uuid)->>'status' = 'already_released',
    'repeat release is idempotent'
  );
end;
$$;

select pg_temp.assert_true(
  (select bonus_credits = 1 from public.user_quota_wallet where user_id = (select user_id from quota_test_context)),
  'release refunds bonus exactly once'
);

-- Same-set committed and active responses are idempotent and prevent duplicate work.
do $$
declare
  ids uuid[];
  committed_result jsonb;
  active_result jsonb;
  duplicate_result jsonb;
begin
  select study_set_ids into ids from quota_test_context;
  committed_result := public.reserve_generation_quota(ids[1], 'quiz');
  perform pg_temp.assert_true(committed_result->>'status' = 'already_committed', 'committed set is free');

  active_result := public.reserve_generation_quota(ids[11], 'quiz');
  duplicate_result := public.reserve_generation_quota(ids[11], 'quiz');
  perform pg_temp.assert_true(active_result->>'status' = 'reserved', 'released slot can reserve again');
  perform pg_temp.assert_true(duplicate_result->>'status' = 'generation_in_progress', 'active set blocks duplicate work');
  perform pg_temp.assert_true(
    public.release_generation_quota((active_result->>'reservationToken')::uuid)->>'status' = 'released',
    'weekly reservation releases capacity'
  );
end;
$$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role', 'authenticated', 'doc2quiz_ai_tier', 'pro')::text, true)
from quota_test_context;
set local role authenticated;

-- RPC has no Pro input. Application callers bypass quota RPC for Pro users; availability remains read-only.
select pg_temp.assert_true(
  public.get_generation_quota_availability((select study_set_ids[13] from quota_test_context))->>'status' = 'available',
  'availability RPC remains read-only for callers'
);

reset role;
rollback;
