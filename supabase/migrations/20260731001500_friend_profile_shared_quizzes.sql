begin;

create table if not exists public.learning_output_friend_shares (
  output_id uuid primary key references public.learning_outputs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.learning_output_friend_shares enable row level security;
revoke all on table public.learning_output_friend_shares from anon, authenticated;

create or replace function public.get_friend_profile(p_other_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  perform private.social_require_friend(p_other_user_id);

  select p.* into v_profile
  from public.profiles p
  where p.id = p_other_user_id;
  if not found then raise exception 'social_unavailable'; end if;

  return jsonb_build_object(
    'displayName', coalesce(v_profile.display_name, v_profile.username, 'Student'),
    'username', v_profile.username,
    'bio', coalesce(v_profile.bio, ''),
    'avatarPath', v_profile.avatar_path,
    'currentStreak', coalesce((select ls.current_streak from public.learning_streaks ls where ls.user_id = p_other_user_id), 0),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lo.id,
        'title', lo.title,
        'type', 'quiz',
        'questionCount', (select count(*) from public.approved_questions aq where aq.output_id = lo.id),
        'updatedAt', lo.updated_at
      ) order by lo.updated_at desc)
      from public.learning_output_friend_shares fs
      join public.learning_outputs lo on lo.id = fs.output_id
      where fs.owner_id = p_other_user_id
        and lo.created_by = p_other_user_id
        and lo.kind = 'quiz'
        and lo.status = 'ready'
        and lo.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.set_quiz_friend_share(p_output_id uuid, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.learning_outputs lo
    where lo.id = p_output_id
      and lo.created_by = v_user_id
      and lo.kind = 'quiz'
      and lo.deleted_at is null
  ) then raise exception 'share_unavailable'; end if;

  if p_shared then
    insert into public.learning_output_friend_shares (output_id, owner_id)
    values (p_output_id, v_user_id)
    on conflict (output_id) do update set owner_id = excluded.owner_id;
  else
    delete from public.learning_output_friend_shares
    where output_id = p_output_id and owner_id = v_user_id;
  end if;

  return jsonb_build_object('shared', p_shared);
end;
$$;

create or replace function public.get_friend_shared_quiz(p_other_user_id uuid, p_output_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_title text; v_updated_at timestamptz;
begin
  perform private.social_require_friend(p_other_user_id);

  select lo.title, lo.updated_at into v_title, v_updated_at
  from public.learning_output_friend_shares fs
  join public.learning_outputs lo on lo.id = fs.output_id
  where fs.output_id = p_output_id
    and fs.owner_id = p_other_user_id
    and lo.created_by = p_other_user_id
    and lo.kind = 'quiz'
    and lo.status = 'ready'
    and lo.deleted_at is null;
  if not found then raise exception 'social_unavailable'; end if;

  return jsonb_build_object(
    'id', p_output_id,
    'title', v_title,
    'type', 'quiz',
    'updatedAt', v_updated_at,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', aq.id,
        'prompt', aq.prompt,
        'choices', to_jsonb(aq.choices),
        'correctIndex', aq.correct_index,
        'explanation', aq.explanation
      ) order by aq.created_at)
      from public.approved_questions aq
      where aq.output_id = p_output_id and length(trim(aq.prompt)) > 0
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
revoke all on function public.set_quiz_friend_share(uuid, boolean) from public, anon;
revoke all on function public.get_friend_shared_quiz(uuid, uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
grant execute on function public.set_quiz_friend_share(uuid, boolean) to authenticated;
grant execute on function public.get_friend_shared_quiz(uuid, uuid) to authenticated;

commit;
