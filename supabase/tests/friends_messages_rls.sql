-- Phase 11 social authority matrix.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text) returns void language plpgsql as $$ begin if not coalesce(p_condition, false) then raise exception 'assertion failed: %', p_message; end if; end; $$;
create or replace function pg_temp.as_user(p_user_id uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end; $$;
create or replace function pg_temp.expect_error(p_sql text) returns void language plpgsql as $$ begin begin execute p_sql; raise exception 'expected failure'; exception when others then if position('expected failure' in sqlerrm) > 0 then raise; end if; end; end; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at) values
('e1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','friend-a@example.com',crypt('pw',gen_salt('bf')),now()),
('e1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','friend-b@example.com',crypt('pw',gen_salt('bf')),now()),
('e1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stranger@example.com',crypt('pw',gen_salt('bf')),now()) on conflict (id) do nothing;
insert into public.profiles(id, username) values
('e1000000-0000-0000-0000-000000000001','friend_a'),('e1000000-0000-0000-0000-000000000002','friend_b'),('e1000000-0000-0000-0000-000000000003','stranger') on conflict (id) do update set username = excluded.username;
insert into public.friend_requests(sender_id, recipient_id, status, responded_at) values ('e1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002','accepted',now());

select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((public.list_accepted_friends()->'friends') @> jsonb_build_array(jsonb_build_object('userId','e1000000-0000-0000-0000-000000000002')), 'accepted friends list is symmetric source');
select pg_temp.expect_error('select public.open_direct_conversation(''e1000000-0000-0000-0000-000000000003'')');
select pg_temp.expect_error('select public.open_direct_conversation(''e1000000-0000-0000-0000-000000000001'')');
select pg_temp.expect_error('select count(*) from public.direct_conversations');
select public.open_direct_conversation('e1000000-0000-0000-0000-000000000002') ->> 'conversationId' as conversation_id \gset
select pg_temp.assert_true((public.send_direct_message(:'conversation_id', 'hello', '{}'::uuid[])->>'senderId') = 'e1000000-0000-0000-0000-000000000001', 'sender derives from auth uid');
select pg_temp.assert_true((public.list_direct_messages(:'conversation_id')->'messages') @> jsonb_build_array(jsonb_build_object('body','hello')), 'friend can read conversation');
select pg_temp.expect_error('select public.send_preset_reaction(''e1000000-0000-0000-0000-000000000002'', ''free_text'')');

select pg_temp.as_user('e1000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((public.list_accepted_friends()->'friends') @> jsonb_build_array(jsonb_build_object('userId','e1000000-0000-0000-0000-000000000001','unreadCount',1)), 'unread count belongs to recipient friend summary');
select pg_temp.assert_true((public.mark_direct_conversation_read(:'conversation_id')->>'ok') = 'true', 'participant can mark own conversation read');
select pg_temp.assert_true((public.list_accepted_friends()->'friends') @> jsonb_build_array(jsonb_build_object('userId','e1000000-0000-0000-0000-000000000001','unreadCount',0)), 'read timestamp clears own unread count');
select pg_temp.assert_true((public.update_reaction_preferences(false, '{}'::uuid[])->>'ok') = 'true', 'global opt-out updates');

select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select pg_temp.expect_error('select public.send_preset_reaction(''e1000000-0000-0000-0000-000000000002'', ''xin_chao'')');

select pg_temp.as_user('e1000000-0000-0000-0000-000000000002');
select public.update_reaction_preferences(true, array['e1000000-0000-0000-0000-000000000001'::uuid]);
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select pg_temp.expect_error('select public.send_preset_reaction(''e1000000-0000-0000-0000-000000000002'', ''xin_chao'')');
select pg_temp.expect_error('select count(*) from private.social_activity');

-- Message media fixtures stand in for authenticated server-side Storage uploads.
reset role;
set local role service_role;
insert into storage.objects (bucket_id, name, owner_id, metadata) values
('doc2quiz', 'e1000000-0000-0000-0000-000000000001/messages/' || :'conversation_id' || '/e1000000-0000-0000-0000-000000000101.png', 'e1000000-0000-0000-0000-000000000001', '{"mimetype":"image/png"}'::jsonb),
('doc2quiz', 'e1000000-0000-0000-0000-000000000001/messages/' || :'conversation_id' || '/e1000000-0000-0000-0000-000000000102.mp4', 'e1000000-0000-0000-0000-000000000001', '{"mimetype":"video/mp4"}'::jsonb);
select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((public.authorize_direct_message_upload(:'conversation_id') ->> 'ok') = 'true', 'accepted participant can authorize media upload');
select pg_temp.assert_true((public.register_direct_message_upload('e1000000-0000-0000-0000-000000000101', :'conversation_id', 'photo.png', 'image/png', 8, 'png') ->> 'id') = 'e1000000-0000-0000-0000-000000000101', 'accepted participant can register image metadata');
select pg_temp.assert_true((public.register_direct_message_upload('e1000000-0000-0000-0000-000000000102', :'conversation_id', 'clip.mp4', 'video/mp4', 8, 'mp4') ->> 'id') = 'e1000000-0000-0000-0000-000000000102', 'accepted participant can register video metadata');
select pg_temp.assert_true(
  (public.send_direct_message(:'conversation_id', null, array['e1000000-0000-0000-0000-000000000101'::uuid, 'e1000000-0000-0000-0000-000000000102'::uuid]) ->> 'body') is null,
  'attachment-only message allows null body'
);
select pg_temp.assert_true(
  jsonb_array_length((public.list_direct_messages(:'conversation_id')->'messages')->0->'attachments') = 2,
  'multiple attachments survive authenticated list round-trip'
);
select pg_temp.assert_true(
  ((public.list_direct_messages(:'conversation_id')->'messages')->0->'attachments') @> jsonb_build_array(jsonb_build_object('name', 'photo.png', 'mimeType', 'image/png')),
  'list returns attachment display metadata'
);
select pg_temp.assert_true((public.send_direct_message(:'conversation_id', 'text remains valid', '{}'::uuid[])->>'body') = 'text remains valid', 'text-only message remains valid');
select pg_temp.expect_error(format('select public.send_direct_message(%L::uuid, null, %L::uuid[])', :'conversation_id', array['e1000000-0000-0000-0000-000000000101'::uuid]));
select pg_temp.expect_error(format('select public.send_direct_message(%L::uuid, null, ''{}''::uuid[])', :'conversation_id'));

-- Caller identity, direct-table denial, signatures, and grants stay RPC-only.
select pg_temp.assert_true((select has_table_privilege('authenticated', 'public.direct_messages', 'select')) = false, 'direct message table remains denied');
select pg_temp.assert_true((to_regprocedure('public.send_direct_message(uuid,text)')) is null, 'obsolete two-argument send signature is absent');
select pg_temp.assert_true((to_regprocedure('public.list_direct_messages(uuid,timestamptz,integer)')) is not null, 'list RPC has cursor and limit signature');
select pg_temp.assert_true(has_function_privilege('authenticated', 'public.send_direct_message(uuid,text,uuid[])', 'execute'), 'authenticated receives only new send RPC');
select pg_temp.assert_true(has_function_privilege('authenticated', 'public.authorize_direct_message_upload(uuid)', 'execute'), 'authenticated receives upload authorization RPC');
select pg_temp.assert_true(has_function_privilege('authenticated', 'public.register_direct_message_upload(uuid,uuid,text,text,bigint,text)', 'execute'), 'authenticated receives upload registration RPC');
select pg_temp.assert_true(has_function_privilege('authenticated', 'public.discard_direct_message_uploads(uuid,uuid[])', 'execute'), 'authenticated receives upload discard RPC');
select pg_temp.assert_true((select has_table_privilege('authenticated', 'public.direct_message_attachments', 'select')) = false, 'attachment registry remains denied');

select pg_temp.as_user('e1000000-0000-0000-0000-000000000003');
select pg_temp.expect_error(format('select public.authorize_direct_message_upload(%L::uuid)', :'conversation_id'));
select pg_temp.expect_error(format('select public.list_direct_messages(%L::uuid)', :'conversation_id'));
select pg_temp.expect_error(format('select public.send_direct_message(%L::uuid, %L)', :'conversation_id', 'stranger cannot send'));

select pg_temp.as_user('e1000000-0000-0000-0000-000000000002');
select pg_temp.expect_error(format('select public.send_direct_message(%L::uuid, null, %L::uuid[])', :'conversation_id', array['e1000000-0000-0000-0000-000000000101'::uuid]));
select pg_temp.expect_error(format('select public.discard_direct_message_uploads(%L::uuid, %L::uuid[])', :'conversation_id', array['e1000000-0000-0000-0000-000000000101'::uuid]));

select pg_temp.as_user('e1000000-0000-0000-0000-000000000001');
select public.block_user('e1000000-0000-0000-0000-000000000002');
select pg_temp.expect_error(format('select public.authorize_direct_message_upload(%L::uuid)', :'conversation_id'));
select pg_temp.expect_error(format('select public.list_direct_messages(%L::uuid)', :'conversation_id'));
select pg_temp.expect_error(format('select public.send_direct_message(%L::uuid, %L)', :'conversation_id', 'blocked cannot send'));
commit;
