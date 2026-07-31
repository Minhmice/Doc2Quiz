-- Static/runtime-safe proof contract for bounded participant-scoped social lists.
begin;
select has_function('public','list_social_friends',array['integer','jsonb']);
select has_function('public','list_social_friend_requests',array['integer','jsonb','text']);
select has_function('public','list_social_invites',array['integer','jsonb']);
select has_function('public','list_social_conversations',array['integer','jsonb']);
select has_function('public','list_social_blocks',array['integer','jsonb']);
select function_privs_are('public','list_social_friends',array['integer','jsonb'],'authenticated',array['EXECUTE']);
rollback;
