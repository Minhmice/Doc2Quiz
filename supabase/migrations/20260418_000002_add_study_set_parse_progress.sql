begin;

alter table public.study_sets
  add column if not exists parse_progress jsonb not null default '{}'::jsonb;

commit;
