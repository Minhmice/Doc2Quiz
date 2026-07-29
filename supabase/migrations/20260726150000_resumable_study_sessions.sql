begin;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  mode text not null,
  practice text not null default 'standard',
  item_ids uuid[] not null,
  current_item_id uuid null,
  next_item_id uuid null,
  interaction_state jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint study_sessions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sessions_study_set_fk foreign key (study_set_id, user_id) references public.study_sets (id, user_id) on delete cascade,
  constraint study_sessions_mode_check check (mode in ('quiz', 'flashcard')),
  constraint study_sessions_practice_check check (practice in ('standard', 'mistakes')),
  constraint study_sessions_revision_check check (revision >= 0),
  constraint study_sessions_items_bound_check check (cardinality(item_ids) between 1 and 2000),
  constraint study_sessions_interaction_object_check check (jsonb_typeof(interaction_state) = 'object')
);

create index if not exists study_sessions_owner_unfinished_updated_idx
  on public.study_sessions (user_id, updated_at desc)
  where completed_at is null;
create index if not exists study_sessions_owner_set_mode_practice_idx
  on public.study_sessions (user_id, study_set_id, mode, practice, updated_at desc);

create table if not exists public.study_mistakes (
  user_id uuid not null,
  study_set_id uuid not null,
  item_id uuid not null,
  mode text not null,
  unresolved boolean not null default true,
  mistake_count integer not null default 1,
  first_mistake_at timestamptz not null default now(),
  last_mistake_at timestamptz not null default now(),
  last_practiced_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint study_mistakes_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_mistakes_study_set_fk foreign key (study_set_id, user_id) references public.study_sets (id, user_id) on delete cascade,
  constraint study_mistakes_mode_check check (mode in ('quiz', 'flashcard')),
  constraint study_mistakes_count_check check (mistake_count > 0),
  constraint study_mistakes_resolution_check check ((unresolved and resolved_at is null) or not unresolved),
  constraint study_mistakes_owner_set_mode_item_unique unique (user_id, study_set_id, mode, item_id)
);

create index if not exists study_mistakes_owner_unresolved_mode_order_idx
  on public.study_mistakes (user_id, mode, mistake_count desc, last_practiced_at desc)
  where unresolved;
create index if not exists study_mistakes_owner_unresolved_set_idx
  on public.study_mistakes (user_id, study_set_id, mode)
  where unresolved;

alter table public.study_sessions enable row level security;
alter table public.study_mistakes enable row level security;

create policy study_sessions_select_own on public.study_sessions for select to authenticated using (user_id = auth.uid());
create policy study_sessions_insert_own on public.study_sessions for insert to authenticated with check (user_id = auth.uid());
create policy study_sessions_update_own on public.study_sessions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy study_sessions_delete_own on public.study_sessions for delete to authenticated using (user_id = auth.uid());
create policy study_mistakes_select_own on public.study_mistakes for select to authenticated using (user_id = auth.uid());
create policy study_mistakes_insert_own on public.study_mistakes for insert to authenticated with check (user_id = auth.uid());
create policy study_mistakes_update_own on public.study_mistakes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy study_mistakes_delete_own on public.study_mistakes for delete to authenticated using (user_id = auth.uid());

create or replace function public.record_study_mistake(
  target_set_id uuid, target_item_id uuid, target_mode text, practiced_at timestamptz default now()
) returns public.study_mistakes language plpgsql security invoker as $$
declare result public.study_mistakes;
begin
  if target_mode not in ('quiz', 'flashcard') then raise exception 'invalid study mode'; end if;
  insert into public.study_mistakes (user_id, study_set_id, item_id, mode, last_practiced_at)
  values (auth.uid(), target_set_id, target_item_id, target_mode, practiced_at)
  on conflict (user_id, study_set_id, mode, item_id) do update set
    unresolved = true,
    mistake_count = public.study_mistakes.mistake_count + 1,
    last_mistake_at = practiced_at,
    last_practiced_at = practiced_at,
    resolved_at = null
  returning * into result;
  return result;
end $$;

create or replace function public.resolve_study_mistake(
  target_set_id uuid, target_item_id uuid, target_mode text, practiced_at timestamptz default now()
) returns public.study_mistakes language plpgsql security invoker as $$
declare result public.study_mistakes;
begin
  update public.study_mistakes set unresolved = false, resolved_at = practiced_at, last_practiced_at = practiced_at
  where user_id = auth.uid() and study_set_id = target_set_id and item_id = target_item_id and mode = target_mode
  returning * into result;
  return result;
end $$;

commit;
