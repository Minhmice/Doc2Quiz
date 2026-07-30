-- Phase 10 anonymous quiz attempt import matrix.
-- Run: supabase db reset && supabase test db --file supabase/tests/phase10_anonymous_quiz_attempts.sql

\set ON_ERROR_STOP on

begin;

\ir fixtures/phase10_workspace_roles.sql

create or replace function pg_temp.attempt_assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create temp table if not exists attempt_fixture (
  quiz_digest bytea not null,
  quiz_share_id uuid null,
  revoked_digest bytea not null,
  revoked_share_id uuid null,
  foreign_output_id uuid not null,
  client_attempt_id uuid not null
) on commit drop;

truncate attempt_fixture;

insert into attempt_fixture (quiz_digest, revoked_digest, foreign_output_id, client_attempt_id)
values (
  decode(repeat('aa', 32), 'hex'),
  decode(repeat('bb', 32), 'hex'),
  'e1000000-0000-0000-0000-000000000099',
  'f1000000-0000-0000-0000-000000000001'
);

select pg_temp.phase10_as_user(owner_id) from phase10_fixture;

select pg_temp.attempt_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'quiz',
      f.quiz_output_id,
      (select quiz_digest from attempt_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create quiz share for import tests'
);

update attempt_fixture
set quiz_share_id = (
  select id
  from public.workspace_shares
  where token_digest = (select quiz_digest from attempt_fixture)
  limit 1
);

select pg_temp.attempt_assert_true(
  (
    select (public.create_workspace_share(
      f.workspace_id,
      'quiz',
      f.quiz_output_id,
      (select revoked_digest from attempt_fixture)
    ) ->> 'id') is not null
    from phase10_fixture f
  ),
  'owner can create revoked quiz share fixture'
);

update attempt_fixture
set revoked_share_id = (
  select id
  from public.workspace_shares
  where token_digest = (select revoked_digest from attempt_fixture)
  limit 1
);

update public.workspace_shares
set revoked_at = now()
where id = (select revoked_share_id from attempt_fixture);

select pg_temp.phase10_as_user(outsider_id) from phase10_fixture;

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', (select client_attempt_id from attempt_fixture),
            'shareId', (select quiz_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 1
    from phase10_fixture
  ),
  'outsider can import active shared quiz attempt once'
);

select pg_temp.attempt_assert_true(
  (
    select count(*) = 1
    from public.anonymous_quiz_attempt_imports i
    where i.user_id = (select outsider_id from phase10_fixture)
      and i.client_attempt_id = (select client_attempt_id from attempt_fixture)
  ),
  'import marker persisted for outsider'
);

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', (select client_attempt_id from attempt_fixture),
            'shareId', (select quiz_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 1
    from phase10_fixture
  ),
  'duplicate client attempt id is idempotent and acknowledged'
);

select pg_temp.attempt_assert_true(
  (
    select count(*) = 1
    from public.anonymous_quiz_attempt_imports i
    where i.user_id = (select outsider_id from phase10_fixture)
      and i.client_attempt_id = (select client_attempt_id from attempt_fixture)
  ),
  'duplicate import does not create second history row'
);

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', 'f1000000-0000-0000-0000-000000000002',
            'shareId', (select revoked_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 0
    from phase10_fixture
  ),
  'revoked share attempts are not acknowledged'
);

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', 'f1000000-0000-0000-0000-000000000003',
            'shareId', (select quiz_share_id from attempt_fixture),
            'outputId', (select foreign_output_id from attempt_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 0
    from phase10_fixture
  ),
  'cross-output attempts are not acknowledged'
);

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', 'f1000000-0000-0000-0000-000000000004',
            'shareId', (select quiz_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', 'f2000000-0000-0000-0000-000000000099',
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 0
    from phase10_fixture
  ),
  'foreign item attempts are not acknowledged'
);

select pg_temp.attempt_assert_true(
  (
    select jsonb_array_length(
      public.import_anonymous_quiz_attempts(
        jsonb_build_array(
          jsonb_build_object(
            'clientAttemptId', 'f1000000-0000-0000-0000-000000000005',
            'shareId', (select quiz_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          ),
          jsonb_build_object(
            'clientAttemptId', 'f1000000-0000-0000-0000-000000000006',
            'shareId', (select revoked_share_id from attempt_fixture),
            'outputId', (select quiz_output_id from phase10_fixture),
            'completedAt', now(),
            'correctCount', 1,
            'totalQuestions', 1,
            'answers', jsonb_build_array(
              jsonb_build_object(
                'questionId', (select quiz_item_id from phase10_fixture),
                'selectedIndex', 0
              )
            )
          )
        )
      ) -> 'acknowledgedIds'
    ) = 1
    from phase10_fixture
  ),
  'partial batch acknowledges only committed ids'
);

select pg_temp.attempt_assert_true(
  (
    select count(*) = 1
    from public.anonymous_quiz_attempt_imports i
    where i.client_attempt_id = 'f1000000-0000-0000-0000-000000000005'
  ),
  'partial batch committed only valid attempt row'
);

rollback;
