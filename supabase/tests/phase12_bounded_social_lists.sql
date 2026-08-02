-- Static/runtime-safe proof contract for bounded participant-scoped social lists.
begin;
select has_function('public','list_social_friends',array['integer','jsonb','text']);
select
  position('p_presence' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('p_presence = ''online''' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('p_presence = ''offline''' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('case when a.last_active_at' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('p_cursor is null' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('limit least(greatest(p_limit,1),51)' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('auth.uid() is not null' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0
  and position('private.social_users_blocked' in pg_get_functiondef('public.list_social_friends(integer,jsonb,text)'::regprocedure)) > 0;
select has_function('public','list_social_friend_requests',array['integer','jsonb','text']);
select has_function('public','list_social_invites',array['integer','jsonb']);
select has_function('public','list_social_conversations',array['integer','jsonb']);
select has_function('public','list_social_blocks',array['integer','jsonb']);
select function_privs_are('public','list_social_friends',array['integer','jsonb','text'],'authenticated',array['EXECUTE']);
rollback;
