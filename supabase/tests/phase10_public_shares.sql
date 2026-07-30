-- Phase 10 public share authority matrix.
-- Run: supabase db reset && supabase test db --file supabase/tests/phase10_public_shares.sql

\set ON_ERROR_STOP on

begin;

\ir fixtures/phase10_workspace_roles.sql

create or replace function pg_temp.share_assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.share_expect_exception(
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

create temp table if not exists share_fixture (
  quiz_digest bytea not null,
  flashcard_digest bytea not null,
  workspace_digest bytea not null,
  revoked_digest bytea not null,
  expired_digest bytea not null,
  quiz_share_id uuid null,
  flashcard_share_id uuid null,
  workspace_share_id uuid null,
  revoked_share_id uuid null,
  expired_share_id uuid null
) on commit drop;

truncate share_fixture;

insert into share_fixture (quiz_digest, flashcard_digest, workspace_digest, revoked_digest, expired_digest)
values (
  decode(repeat('11', 32), 'hex'),
  decode(repeat('22', 32), 'hex'),
  decode(repeat('33', 32), 'hex'),
  decode(repeat('44', 32), 'hex'),
  decode(repeat('55', 32), 'hex')
);

-- Owner creates shares for valid targets.
select pg_temp.phase10_as_user(owner_id) from phase10_fixture;

select pg_temp.share_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'quiz',
      f.quiz_output_id,
      (select quiz_digest from share_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create quiz share'
);

select pg_temp.share_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'flashcard',
      f.flashcards_output_id,
      (select flashcard_digest from share_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create flashcard share'
);

select pg_temp.share_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'workspace',
      f.workspace_id,
      (select workspace_digest from share_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create workspace share'
);

update share_fixture sf
set
  quiz_share_id = s.id
from public.workspace_shares s, phase10_fixture f
where s.token_digest = sf.quiz_digest
  and s.workspace_id = f.workspace_id
  and s.target_kind = 'quiz';

update share_fixture sf
set
  flashcard_share_id = s.id
from public.workspace_shares s, phase10_fixture f
where s.token_digest = sf.flashcard_digest
  and s.workspace_id = f.workspace_id
  and s.target_kind = 'flashcard';

update share_fixture sf
set
  workspace_share_id = s.id
from public.workspace_shares s, phase10_fixture f
where s.token_digest = sf.workspace_digest
  and s.workspace_id = f.workspace_id
  and s.target_kind = 'workspace';

-- Cross-workspace / invalid target denied at create time.
select pg_temp.share_expect_exception(
  $sql$
    select public.create_workspace_share(
      (select workspace_id from phase10_fixture),
      'quiz',
      '00000000-0000-0000-0000-000000000099',
      decode(repeat('66', 32), 'hex')
    );
  $sql$,
  'not_found'
);

select pg_temp.share_expect_exception(
  $sql$
    select public.create_workspace_share(
      (select workspace_id from phase10_fixture),
      'flashcard',
      (select quiz_output_id from phase10_fixture),
      decode(repeat('77', 32), 'hex')
    );
  $sql$,
  'not_found'
);

-- Revoked and expired shares for resolver denial.
select pg_temp.share_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'quiz',
      f.quiz_output_id,
      (select revoked_digest from share_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create share to revoke'
);

update share_fixture sf
set revoked_share_id = s.id
from public.workspace_shares s
where s.token_digest = sf.revoked_digest;

select pg_temp.share_assert_true(
  (select public.revoke_workspace_share((select revoked_share_id from share_fixture)) ->> 'revoked' = 'true'),
  'owner can revoke share'
);

select pg_temp.share_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'quiz',
      f.quiz_output_id,
      (select expired_digest from share_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create share to expire'
);

update share_fixture sf
set expired_share_id = s.id
from public.workspace_shares s
where s.token_digest = sf.expired_digest;

reset role;
set local role service_role;

update public.workspace_shares
set expires_at = now() - interval '1 minute'
where id = (select expired_share_id from share_fixture);

select pg_temp.phase10_as_user(owner_id) from phase10_fixture;

-- Members and outsiders cannot read share rows directly.
select pg_temp.phase10_as_user(editor_id) from phase10_fixture;

select pg_temp.share_assert_true(
  (select count(*) = 0 from public.workspace_shares),
  'editor cannot select workspace_shares'
);

select pg_temp.phase10_as_user(viewer_id) from phase10_fixture;

select pg_temp.share_assert_true(
  (select count(*) = 0 from public.workspace_shares),
  'viewer cannot select workspace_shares'
);

select pg_temp.phase10_as_user(outsider_id) from phase10_fixture;

select pg_temp.share_assert_true(
  (select count(*) = 0 from public.workspace_shares),
  'outsider cannot select workspace_shares'
);

reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.share_assert_true(
  (select count(*) = 0 from public.workspace_shares),
  'anon cannot select workspace_shares'
);

select pg_temp.share_assert_true(
  (
    select count(*) = 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_shares'
      and 'anon' = any (roles)
  ),
  'workspace_shares has no anon policy'
);

-- Resolver is service-role only and returns locked study projection.
reset role;
set local role service_role;

select pg_temp.share_assert_true(
  (
    select public.resolve_public_share_by_digest((select quiz_digest from share_fixture))
      -> 'target' ->> 'kind' = 'quiz'
  ),
  'resolver returns quiz share kind'
);

select pg_temp.share_assert_true(
  (
    select jsonb_array_length(
      public.resolve_public_share_by_digest((select quiz_digest from share_fixture))
        -> 'target' -> 'questions'
    ) >= 1
  ),
  'resolver returns quiz questions'
);

select pg_temp.share_assert_true(
  (
    select public.resolve_public_share_by_digest((select quiz_digest from share_fixture))
      -> 'target' -> 'questions' -> 0 ?& array['id', 'prompt', 'choices', 'correctIndex', 'explanation']
  ),
  'quiz projection includes study fields only'
);

select pg_temp.share_assert_true(
  (
    select not (
      public.resolve_public_share_by_digest((select quiz_digest from share_fixture))::text
        ~* 'user_id|workspace_id|study_set_id|source|token_digest|created_by|generation_provenance|storage'
    )
  ),
  'quiz projection excludes private fields'
);

select pg_temp.share_assert_true(
  (
    select public.resolve_public_share_by_digest((select flashcard_digest from share_fixture))
      -> 'target' ->> 'kind' = 'flashcard'
  ),
  'resolver returns flashcard share kind'
);

select pg_temp.share_assert_true(
  (
    select public.resolve_public_share_by_digest((select workspace_digest from share_fixture))
      -> 'target' ->> 'kind' = 'workspace'
  ),
  'resolver returns workspace share kind'
);

select pg_temp.share_expect_exception(
  $sql$
    select public.resolve_public_share_by_digest((select revoked_digest from share_fixture));
  $sql$,
  'not_found'
);

select pg_temp.share_expect_exception(
  $sql$
    select public.resolve_public_share_by_digest((select expired_digest from share_fixture));
  $sql$,
  'not_found'
);

select pg_temp.share_expect_exception(
  $sql$
    select public.resolve_public_share_by_digest(decode(repeat('99', 32), 'hex'));
  $sql$,
  'not_found'
);

reset role;
select pg_temp.phase10_as_user(owner_id) from phase10_fixture;

select pg_temp.share_expect_exception(
  $sql$
    select public.resolve_public_share_by_digest((select quiz_digest from share_fixture));
  $sql$,
  'permission denied'
);

rollback;
