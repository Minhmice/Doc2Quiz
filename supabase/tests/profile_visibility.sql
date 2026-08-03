\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then raise exception 'assertion failed: %', p_message; end if;
end;
$$;

create or replace function pg_temp.as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('f1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-alice@example.com', crypt('DemoAlice123!', gen_salt('bf')), now()),
  ('f1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-bob@example.com', crypt('DemoBob123!', gen_salt('bf')), now()),
  ('f1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-viewer@example.com', crypt('DemoViewer123!', gen_salt('bf')), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, username, bio, avatar_path)
values
  ('f1000000-0000-0000-0000-000000000001', 'Demo Alice', 'demo_alice', 'Alice public bio', 'f1000000-0000-0000-0000-000000000001/profile/avatar.jpg'),
  ('f1000000-0000-0000-0000-000000000002', 'Demo Bob', 'demo_bob', 'Bob public bio', null),
  ('f1000000-0000-0000-0000-000000000003', 'Demo Viewer', 'demo_viewer', 'Viewer public bio', null)
on conflict (id) do update set display_name = excluded.display_name, username = excluded.username, bio = excluded.bio, avatar_path = excluded.avatar_path;

insert into public.friend_requests (sender_id, recipient_id, status, responded_at)
values ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'accepted', now())
on conflict do nothing;

select pg_temp.as_user('f1000000-0000-0000-0000-000000000001');
select pg_temp.assert_true(
  (public.resolve_friend_user('demo_bob')->>'userId') = 'f1000000-0000-0000-0000-000000000002',
  'demo Alice resolves demo Bob as accepted friend'
);
select pg_temp.assert_true(
  (public.get_public_profile('f1000000-0000-0000-0000-000000000002') @> jsonb_build_object('displayName', 'Demo Bob', 'username', 'demo_bob', 'bio', 'Bob public bio'))
  and not (public.get_public_profile('f1000000-0000-0000-0000-000000000002') ? 'currentStreak')
  and not (public.get_public_profile('f1000000-0000-0000-0000-000000000002') ? 'quizzes'),
  'demo Alice sees only demo Bob public identity'
);

select pg_temp.as_user('f1000000-0000-0000-0000-000000000003');
select pg_temp.assert_true(
  (public.resolve_profile_user('demo_alice')->>'userId') = 'f1000000-0000-0000-0000-000000000001',
  'non-friend viewer resolves public profile username'
);
select pg_temp.assert_true(
  (public.get_public_profile('f1000000-0000-0000-0000-000000000001') @> jsonb_build_object('displayName', 'Demo Alice', 'username', 'demo_alice', 'bio', 'Alice public bio'))
  and not (public.get_public_profile('f1000000-0000-0000-0000-000000000001') ? 'currentStreak')
  and not (public.get_public_profile('f1000000-0000-0000-0000-000000000001') ? 'quizzes'),
  'non-friend viewer sees only demo Alice public identity'
);

commit;
