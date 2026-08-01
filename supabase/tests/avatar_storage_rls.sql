\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text) returns void language plpgsql as $$ begin if not coalesce(p_condition, false) then raise exception 'assertion failed: %', p_message; end if; end; $$;
create or replace function pg_temp.as_user(p_user_id uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end; $$;
create or replace function pg_temp.expect_error(p_sql text) returns void language plpgsql as $$ begin begin execute p_sql; raise exception 'expected failure'; exception when others then if position('expected failure' in sqlerrm) > 0 then raise; end if; end; end; $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at) values
('a1300000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','avatar-a@example.com',crypt('pw',gen_salt('bf')),now()),
('a1300000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','avatar-b@example.com',crypt('pw',gen_salt('bf')),now()) on conflict (id) do nothing;

select pg_temp.assert_true(not (select public from storage.buckets where id = 'doc2quiz'), 'avatar bucket remains private');
select pg_temp.as_user('a1300000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name, owner_id, metadata) values ('doc2quiz', 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg', auth.uid(), '{}'::jsonb);
update storage.objects set metadata = '{"version":2}'::jsonb where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg';
select pg_temp.assert_true(exists (select 1 from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg'), 'owner reads own avatar');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('doc2quiz', 'a1300000-0000-0000-0000-000000000001/profile/avatar.svg', auth.uid(), '{}'::jsonb)$$);
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('doc2quiz', 'a1300000-0000-0000-0000-000000000001/other/avatar.jpg', auth.uid(), '{}'::jsonb)$$);

select pg_temp.as_user('a1300000-0000-0000-0000-000000000002');
select pg_temp.assert_true(not exists (select 1 from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg'), 'other user cannot read owner avatar');
update storage.objects set metadata = '{}'::jsonb where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg';
delete from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg';
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('doc2quiz', 'a1300000-0000-0000-0000-000000000001/profile/avatar.gif', auth.uid(), '{}'::jsonb)$$);

select pg_temp.as_user('a1300000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select metadata->>'version' from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg') = '2', 'other user cannot overwrite owner avatar');
select pg_temp.assert_true(exists (select 1 from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg'), 'other user cannot delete owner avatar');
delete from storage.objects where bucket_id = 'doc2quiz' and name = 'a1300000-0000-0000-0000-000000000001/profile/avatar.jpg';
commit;
