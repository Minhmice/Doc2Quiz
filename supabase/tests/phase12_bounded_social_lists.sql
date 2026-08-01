-- Static/runtime-safe proof contract for bounded participant-scoped social lists.
begin;
select has_function('public','list_social_friends',array['integer','jsonb','text']);
select
  position('p_presence' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('presence_rank = 0' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('presence_rank in (1,2)' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('p_cursor is null' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('limit least(greatest(p_limit,1),51)' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('auth.uid() is not null' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('private.social_users_blocked' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0;
select has_function('public','list_social_friend_requests',array['integer','jsonb','text']);
select has_function('public','list_social_invites',array['integer','jsonb']);
select has_function('public','list_social_conversations',array['integer','jsonb']);
select has_function('public','list_social_blocks',array['integer','jsonb']);
select function_privs_are('public','list_social_friends',array['integer','jsonb'],'authenticated',array['EXECUTE']);
rollback;
