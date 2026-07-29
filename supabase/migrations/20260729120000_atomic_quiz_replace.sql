create or replace function public.replace_quiz_questions(
  p_study_set_id uuid,
  p_expected_count integer,
  p_questions jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_expected_count < 1 or p_expected_count > 40 then
    raise exception 'Expected count must be between 1 and 40';
  end if;

  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Questions payload must be an array';
  end if;

  v_input_count := jsonb_array_length(p_questions);
  if v_input_count <> p_expected_count then
    raise exception 'Expected % questions, received %',
      p_expected_count, v_input_count;
  end if;

  if not exists (
    select 1
    from public.study_sets
    where id = p_study_set_id
      and user_id = v_user_id
  ) then
    raise exception 'Study set not found';
  end if;

  delete from public.approved_questions
  where study_set_id = p_study_set_id
    and user_id = v_user_id;

  insert into public.approved_questions (
    id,
    user_id,
    study_set_id,
    prompt,
    choices,
    correct_index,
    explanation,
    tags,
    source
  )
  select
    q.id,
    v_user_id,
    p_study_set_id,
    q.prompt,
    q.choices,
    q.correct_index,
    q.explanation,
    coalesce(q.tags, '{}'::text[]),
    coalesce(q.source, '{}'::jsonb)
  from jsonb_to_recordset(p_questions) as q(
    id uuid,
    user_id uuid,
    study_set_id uuid,
    prompt text,
    choices text[],
    correct_index smallint,
    explanation text,
    tags text[],
    source jsonb
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_count, v_inserted_count;
  end if;

  update public.study_sets
  set pipeline_stage = 'quiz',
      content_kind = 'quiz'
  where id = p_study_set_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Study set update failed';
  end if;

  return v_inserted_count;
end;
$$;

revoke all on function public.replace_quiz_questions(uuid, integer, jsonb)
  from public;
grant execute on function public.replace_quiz_questions(uuid, integer, jsonb)
  to authenticated;
