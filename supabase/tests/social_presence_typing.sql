\set ON_ERROR_STOP on

create temporary table pg_temp.assertions(ok boolean, message text);
create or replace function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$ begin if not value then raise exception '%', message; end if; end $$;

select pg_temp.assert_true(
  to_regprocedure('public.authorize_conversation_typing(uuid)') is not null,
  'typing authorization function exists'
);
select pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.authorize_conversation_typing(uuid)', 'execute'),
  'authenticated receives typing authorization only through guarded function'
);
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.authorize_conversation_typing(uuid)', 'execute'),
  'anonymous callers cannot authorize typing'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'private.social_activity', 'select'),
  'typing has no durable social activity table access'
);
