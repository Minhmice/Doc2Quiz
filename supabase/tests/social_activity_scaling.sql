\set ON_ERROR_STOP on

create temporary table pg_temp.assertions(ok boolean, message text);
create or replace function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$ begin if not value then raise exception '%', message; end if; end $$;

select pg_temp.assert_true(
  to_regprocedure('public.apply_social_activity_batch(jsonb)') is not null,
  'service-role activity batch RPC exists'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.apply_social_activity_batch(jsonb)', 'execute'),
  'service role can write durable activity'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.apply_social_activity_batch(jsonb)', 'execute'),
  'authenticated cannot write durable activity'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'private.social_activity', 'select'),
  'durable activity remains private'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'private.social_activity_events', 'select'),
  'event dedupe table remains private'
);
