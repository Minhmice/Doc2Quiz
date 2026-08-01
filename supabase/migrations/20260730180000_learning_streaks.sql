begin;

create table if not exists public.learning_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  last_quiz_date date,
  lost_streak integer not null default 0 check (lost_streak >= 0),
  lost_at timestamptz,
  recovery_started_at timestamptz,
  recovery_quiz_count integer not null default 0 check (recovery_quiz_count between 0 and 2),
  recovery_month date,
  recoveries_this_month integer not null default 0 check (recoveries_this_month between 0 and 2),
  updated_at timestamptz not null default now()
);

alter table public.learning_streaks enable row level security;

create policy learning_streaks_select_own
  on public.learning_streaks for select to authenticated
  using (user_id = (select auth.uid()));

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
  if v_state.last_quiz_date = v_today then return v_state; end if;

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

  if v_state.recovery_started_at is not null then
    if v_state.recovery_started_at + interval '48 hours' < now() then
      update public.learning_streaks set recovery_started_at = null, recovery_quiz_count = 0, updated_at = now()
        where user_id = v_uid returning * into v_state;
    elsif v_state.recovery_quiz_count + 1 >= 2 then
      update public.learning_streaks
        set current_streak = lost_streak,
            lost_streak = 0,
            lost_at = null,
            recovery_started_at = null,
            recovery_quiz_count = 0,
            recoveries_this_month = recoveries_this_month + 1,
            updated_at = now()
        where user_id = v_uid returning * into v_state;
    else
      update public.learning_streaks set recovery_quiz_count = recovery_quiz_count + 1, updated_at = now()
        where user_id = v_uid returning * into v_state;
    end if;
  end if;
  return v_state;
end;
$$;

create or replace function public.get_learning_streak(p_timezone text)
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
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then raise exception 'invalid_timezone'; end if;
  begin v_today := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then raise exception 'invalid_timezone'; end;
  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if not found then return null; end if;
  if v_state.last_quiz_date < v_today - 1 and v_state.current_streak > 0 then
    update public.learning_streaks
      set current_streak = 0, lost_streak = current_streak, lost_at = now(),
          recovery_started_at = null, recovery_quiz_count = 0, updated_at = now()
      where user_id = v_uid returning * into v_state;
  end if;
  return v_state;
end;
$$;

create or replace function public.start_learning_streak_recovery(p_timezone text)
returns public.learning_streaks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_state public.learning_streaks%rowtype;
  v_month date;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_timezone is null or p_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' then raise exception 'invalid_timezone'; end if;
  begin v_month := date_trunc('month', now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then raise exception 'invalid_timezone'; end;
  select * into v_state from public.learning_streaks where user_id = v_uid for update;
  if not found or v_state.lost_streak = 0 or v_state.lost_at < now() - interval '48 hours' then raise exception 'recovery_unavailable'; end if;
  if v_state.recovery_month is distinct from v_month then
    update public.learning_streaks set recovery_month = v_month, recoveries_this_month = 0 where user_id = v_uid returning * into v_state;
  end if;
  if v_state.recoveries_this_month >= 2 then raise exception 'recovery_limit'; end if;
  update public.learning_streaks set recovery_started_at = now(), recovery_quiz_count = 0, updated_at = now()
    where user_id = v_uid returning * into v_state;
  return v_state;
end;
$$;

revoke all on function public.record_learning_streak(text) from public;
revoke all on function public.get_learning_streak(text) from public;
revoke all on function public.start_learning_streak_recovery(text) from public;
grant execute on function public.record_learning_streak(text) to authenticated;
grant execute on function public.get_learning_streak(text) to authenticated;
grant execute on function public.start_learning_streak_recovery(text) to authenticated;

commit;
