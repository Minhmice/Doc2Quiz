begin;

-- =============================================================================
-- Doc2Quiz v2.1 — single-file Postgres baseline
-- =============================================================================
-- Canonical knowledge (1:1 study_sets ↔ canonical_documents), practice tables,
-- private doc2quiz storage bucket, user-scoped RLS on all tables.
-- No v1 tables: media_assets, ocr_results, study_set_documents, etc.
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- study_sets
-- ---------------------------------------------------------------------------

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  subtitle text null,
  pipeline_stage text not null default 'input',
  content_kind text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sets_pipeline_stage_check check (
    pipeline_stage in ('input', 'raw', 'canonical', 'mode_selected', 'quiz', 'flashcards')
  ),
  constraint study_sets_content_kind_check check (
    content_kind is null or content_kind in ('quiz', 'flashcards')
  ),
  constraint study_sets_id_user_id_unique unique (id, user_id)
);

create trigger study_sets_set_updated_at
before update on public.study_sets
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- canonical_documents (1:1 with study_sets)
-- ---------------------------------------------------------------------------

create table if not exists public.canonical_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  original_storage_path text null,
  original_filename text null,
  original_mime_type text null,
  raw_markdown text not null default '',
  canonical_markdown text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_documents_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint canonical_documents_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint canonical_documents_study_set_id_unique unique (study_set_id),
  constraint canonical_documents_id_user_id_unique unique (id, user_id)
);

create trigger canonical_documents_set_updated_at
before update on public.canonical_documents
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- canonical_sections
-- ---------------------------------------------------------------------------

create table if not exists public.canonical_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  canonical_document_id uuid not null,
  ordinal integer not null,
  heading text null,
  body_markdown text not null default '',
  section_type text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_sections_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint canonical_sections_document_fk foreign key (canonical_document_id, user_id)
    references public.canonical_documents (id, user_id) on delete cascade,
  constraint canonical_sections_id_user_id_unique unique (id, user_id),
  constraint canonical_sections_document_ordinal_unique unique (canonical_document_id, ordinal)
);

create trigger canonical_sections_set_updated_at
before update on public.canonical_sections
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Practice tables (v1 shapes, v2.1 FKs)
-- ---------------------------------------------------------------------------

create table if not exists public.approved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  prompt text not null,
  choices text[] not null,
  correct_index smallint not null,
  explanation text null,
  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_questions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint approved_questions_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint approved_questions_choices_len_check check (array_length(choices, 1) = 4),
  constraint approved_questions_correct_index_check check (correct_index between 0 and 3)
);

create trigger approved_questions_set_updated_at
before update on public.approved_questions
for each row
execute function public.set_updated_at();

create table if not exists public.approved_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  front text not null,
  back text not null,
  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_flashcards_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint approved_flashcards_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade
);

create trigger approved_flashcards_set_updated_at
before update on public.approved_flashcards
for each row
execute function public.set_updated_at();

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  completed_at timestamptz not null default now(),
  total_questions integer not null,
  correct_count integer not null,
  constraint quiz_sessions_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint quiz_sessions_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade
);

create table if not exists public.study_wrong_history (
  user_id uuid not null,
  study_set_id uuid not null,
  question_ids uuid[] not null,
  updated_at timestamptz not null default now(),
  constraint study_wrong_history_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_wrong_history_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint study_wrong_history_user_id_study_set_id_pk primary key (user_id, study_set_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.study_sets enable row level security;
alter table public.canonical_documents enable row level security;
alter table public.canonical_sections enable row level security;
alter table public.approved_questions enable row level security;
alter table public.approved_flashcards enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.study_wrong_history enable row level security;

do $$
begin
  -- study_sets
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_select_own') then
    create policy study_sets_select_own on public.study_sets
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_insert_own') then
    create policy study_sets_insert_own on public.study_sets
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_update_own') then
    create policy study_sets_update_own on public.study_sets
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_delete_own') then
    create policy study_sets_delete_own on public.study_sets
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- canonical_documents
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_documents' and policyname='canonical_documents_select_own') then
    create policy canonical_documents_select_own on public.canonical_documents
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_documents' and policyname='canonical_documents_insert_own') then
    create policy canonical_documents_insert_own on public.canonical_documents
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_documents' and policyname='canonical_documents_update_own') then
    create policy canonical_documents_update_own on public.canonical_documents
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_documents' and policyname='canonical_documents_delete_own') then
    create policy canonical_documents_delete_own on public.canonical_documents
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- canonical_sections
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_sections' and policyname='canonical_sections_select_own') then
    create policy canonical_sections_select_own on public.canonical_sections
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_sections' and policyname='canonical_sections_insert_own') then
    create policy canonical_sections_insert_own on public.canonical_sections
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_sections' and policyname='canonical_sections_update_own') then
    create policy canonical_sections_update_own on public.canonical_sections
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='canonical_sections' and policyname='canonical_sections_delete_own') then
    create policy canonical_sections_delete_own on public.canonical_sections
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- approved_questions
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_select_own') then
    create policy approved_questions_select_own on public.approved_questions
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_insert_own') then
    create policy approved_questions_insert_own on public.approved_questions
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_update_own') then
    create policy approved_questions_update_own on public.approved_questions
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_delete_own') then
    create policy approved_questions_delete_own on public.approved_questions
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- approved_flashcards
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_select_own') then
    create policy approved_flashcards_select_own on public.approved_flashcards
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_insert_own') then
    create policy approved_flashcards_insert_own on public.approved_flashcards
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_update_own') then
    create policy approved_flashcards_update_own on public.approved_flashcards
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_delete_own') then
    create policy approved_flashcards_delete_own on public.approved_flashcards
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- quiz_sessions
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_select_own') then
    create policy quiz_sessions_select_own on public.quiz_sessions
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_insert_own') then
    create policy quiz_sessions_insert_own on public.quiz_sessions
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_update_own') then
    create policy quiz_sessions_update_own on public.quiz_sessions
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_delete_own') then
    create policy quiz_sessions_delete_own on public.quiz_sessions
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- study_wrong_history
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_select_own') then
    create policy study_wrong_history_select_own on public.study_wrong_history
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_insert_own') then
    create policy study_wrong_history_insert_own on public.study_wrong_history
      for insert to authenticated with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_update_own') then
    create policy study_wrong_history_update_own on public.study_wrong_history
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_delete_own') then
    create policy study_wrong_history_delete_own on public.study_wrong_history
      for delete to authenticated using (user_id = auth.uid());
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('doc2quiz', 'doc2quiz', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='doc2quiz_storage_select_own') then
    create policy doc2quiz_storage_select_own on storage.objects
      for select to authenticated
      using (bucket_id = 'doc2quiz' and owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='doc2quiz_storage_insert_own') then
    create policy doc2quiz_storage_insert_own on storage.objects
      for insert to authenticated
      with check (bucket_id = 'doc2quiz' and owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='doc2quiz_storage_update_own') then
    create policy doc2quiz_storage_update_own on storage.objects
      for update to authenticated
      using (bucket_id = 'doc2quiz' and owner = auth.uid())
      with check (bucket_id = 'doc2quiz' and owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='doc2quiz_storage_delete_own') then
    create policy doc2quiz_storage_delete_own on storage.objects
      for delete to authenticated
      using (bucket_id = 'doc2quiz' and owner = auth.uid());
  end if;
end
$$;

commit;
