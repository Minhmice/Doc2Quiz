begin;

-- Cached validated generation results (per user) — key = hash(file|kind|tier|model|schemaVersion)
create table if not exists public.generation_output_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  cache_key text not null,
  generation_schema_version integer not null,
  content_kind text not null,
  tier text not null,
  model_fingerprint text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint generation_output_cache_user_key unique (user_id, cache_key)
);

create index if not exists generation_output_cache_user_idx
  on public.generation_output_cache (user_id, created_at desc);

alter table public.generation_output_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generation_output_cache'
      and policyname = 'generation_output_cache_select_own'
  ) then
    create policy generation_output_cache_select_own
      on public.generation_output_cache
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generation_output_cache'
      and policyname = 'generation_output_cache_insert_own'
  ) then
    create policy generation_output_cache_insert_own
      on public.generation_output_cache
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generation_output_cache'
      and policyname = 'generation_output_cache_update_own'
  ) then
    create policy generation_output_cache_update_own
      on public.generation_output_cache
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'generation_output_cache'
      and policyname = 'generation_output_cache_delete_own'
  ) then
    create policy generation_output_cache_delete_own
      on public.generation_output_cache
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

commit;
