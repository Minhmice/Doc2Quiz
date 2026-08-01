begin;

create or replace function public.record_learning_streak(p_timezone text)
returns public.learning_streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date;
  v_state public.learning_streaks%rowtype;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then
    raise exception 'invalid_timezone';
  end if;
  begin
    v_today := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then
    raise exception 'invalid_timezone';
  end;

  insert into public.learning_streaks (user_id, last_quiz_date, current_streak)
  values (v_uid, v_today, 1)
  on conflict (user_id) do nothing;

  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if v_state.last_quiz_date <> v_today then
    if v_state.last_quiz_date = v_today - 1 then
      update public.learning_streaks
        set current_streak = v_state.current_streak + 1,
            last_quiz_date = v_today,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    else
      update public.learning_streaks
        set current_streak = 1,
            last_quiz_date = v_today,
            lost_streak = v_state.current_streak,
            lost_at = now(),
            recovery_started_at = null,
            recovery_quiz_count = 0,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    end if;
  end if;

  if v_state.recovery_started_at is not null then
    if v_state.recovery_started_at + interval '48 hours' < now() then
      update public.learning_streaks
        set recovery_started_at = null, recovery_quiz_count = 0, updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    elsif v_state.recovery_quiz_count + 1 >= 2 then
      update public.learning_streaks
        set current_streak = lost_streak,
            lost_streak = 0,
            lost_at = null,
            recovery_started_at = null,
            recovery_quiz_count = 0,
            recoveries_this_month = recoveries_this_month + 1,
            updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    else
      update public.learning_streaks
        set recovery_quiz_count = recovery_quiz_count + 1, updated_at = now()
        where user_id = v_uid
        returning * into v_state;
    end if;
  end if;
  return v_state;
end;
$$;

commit;
