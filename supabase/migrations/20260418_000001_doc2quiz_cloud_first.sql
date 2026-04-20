begin;

-- Extensions
create extension if not exists "pgcrypto";

-- Shared trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_asset_kind' and typnamespace = 'public'::regnamespace) then
    create type public.media_asset_kind as enum ('page_image', 'attachment');
  end if;
end
$$;

-- Core tables
create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  subtitle text null,
  status text not null,
  content_kind text null,
  source_file_name text null,
  page_count integer null,
  ocr_provider text null,
  ocr_status text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_sets_status_check check (status in ('draft', 'ready')),
  constraint study_sets_content_kind_check check (content_kind is null or content_kind in ('quiz', 'flashcards')),
  constraint study_sets_id_user_id_unique unique (id, user_id)
);

create trigger study_sets_set_updated_at
before update on public.study_sets
for each row
execute function public.set_updated_at();

create table if not exists public.study_set_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  extracted_text text not null default '',
  page_count integer null,
  source_file_name text null,
  source_pdf_asset_id uuid null,
  extracted_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint study_set_documents_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint study_set_documents_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint study_set_documents_user_id_study_set_id_unique unique (user_id, study_set_id),
  constraint study_set_documents_id_user_id_unique unique (id, user_id)
);

create trigger study_set_documents_set_updated_at
before update on public.study_set_documents
for each row
execute function public.set_updated_at();

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  study_set_id uuid not null,
  document_id uuid null,
  kind public.media_asset_kind not null,
  bucket text not null,
  object_path text not null,
  mime_type text null,
  byte_size bigint null,
  sha256 text null,
  page_number integer null,
  width integer null,
  height integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint media_assets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint media_assets_study_set_fk foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id) on delete cascade,
  constraint media_assets_document_fk foreign key (document_id, user_id)
    references public.study_set_documents (id, user_id) on delete set null,
  constraint media_assets_bucket_object_path_unique unique (bucket, object_path),
  constraint media_assets_id_user_id_unique unique (id, user_id)
);

alter table public.study_set_documents
  add constraint study_set_documents_source_pdf_asset_fk foreign key (source_pdf_asset_id, user_id)
    references public.media_assets (id, user_id) on delete set null;

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  asset_id uuid not null,
  engine text null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint ocr_results_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint ocr_results_asset_fk foreign key (asset_id, user_id)
    references public.media_assets (id, user_id) on delete cascade
);

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

-- RLS
alter table public.study_sets enable row level security;
alter table public.study_set_documents enable row level security;
alter table public.media_assets enable row level security;
alter table public.ocr_results enable row level security;
alter table public.approved_questions enable row level security;
alter table public.approved_flashcards enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.study_wrong_history enable row level security;

-- Policies: each user can access only their own rows
do $$
begin
  -- study_sets
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_select_own') then
    create policy study_sets_select_own on public.study_sets
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_insert_own') then
    create policy study_sets_insert_own on public.study_sets
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_update_own') then
    create policy study_sets_update_own on public.study_sets
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_sets' and policyname='study_sets_delete_own') then
    create policy study_sets_delete_own on public.study_sets
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- study_set_documents
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_set_documents' and policyname='study_set_documents_select_own') then
    create policy study_set_documents_select_own on public.study_set_documents
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_set_documents' and policyname='study_set_documents_insert_own') then
    create policy study_set_documents_insert_own on public.study_set_documents
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_set_documents' and policyname='study_set_documents_update_own') then
    create policy study_set_documents_update_own on public.study_set_documents
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_set_documents' and policyname='study_set_documents_delete_own') then
    create policy study_set_documents_delete_own on public.study_set_documents
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- media_assets
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='media_assets' and policyname='media_assets_select_own') then
    create policy media_assets_select_own on public.media_assets
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='media_assets' and policyname='media_assets_insert_own') then
    create policy media_assets_insert_own on public.media_assets
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='media_assets' and policyname='media_assets_update_own') then
    create policy media_assets_update_own on public.media_assets
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='media_assets' and policyname='media_assets_delete_own') then
    create policy media_assets_delete_own on public.media_assets
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- ocr_results
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ocr_results' and policyname='ocr_results_select_own') then
    create policy ocr_results_select_own on public.ocr_results
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ocr_results' and policyname='ocr_results_insert_own') then
    create policy ocr_results_insert_own on public.ocr_results
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ocr_results' and policyname='ocr_results_update_own') then
    create policy ocr_results_update_own on public.ocr_results
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ocr_results' and policyname='ocr_results_delete_own') then
    create policy ocr_results_delete_own on public.ocr_results
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- approved_questions
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_select_own') then
    create policy approved_questions_select_own on public.approved_questions
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_insert_own') then
    create policy approved_questions_insert_own on public.approved_questions
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_update_own') then
    create policy approved_questions_update_own on public.approved_questions
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_questions' and policyname='approved_questions_delete_own') then
    create policy approved_questions_delete_own on public.approved_questions
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- approved_flashcards
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_select_own') then
    create policy approved_flashcards_select_own on public.approved_flashcards
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_insert_own') then
    create policy approved_flashcards_insert_own on public.approved_flashcards
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_update_own') then
    create policy approved_flashcards_update_own on public.approved_flashcards
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_flashcards' and policyname='approved_flashcards_delete_own') then
    create policy approved_flashcards_delete_own on public.approved_flashcards
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- quiz_sessions
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_select_own') then
    create policy quiz_sessions_select_own on public.quiz_sessions
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_insert_own') then
    create policy quiz_sessions_insert_own on public.quiz_sessions
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_update_own') then
    create policy quiz_sessions_update_own on public.quiz_sessions
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_sessions' and policyname='quiz_sessions_delete_own') then
    create policy quiz_sessions_delete_own on public.quiz_sessions
      for delete to authenticated
      using (user_id = auth.uid());
  end if;

  -- study_wrong_history
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_select_own') then
    create policy study_wrong_history_select_own on public.study_wrong_history
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_insert_own') then
    create policy study_wrong_history_insert_own on public.study_wrong_history
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_update_own') then
    create policy study_wrong_history_update_own on public.study_wrong_history
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='study_wrong_history' and policyname='study_wrong_history_delete_own') then
    create policy study_wrong_history_delete_own on public.study_wrong_history
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

-- Storage policies for doc2quiz bucket (authenticated users, owner = auth.uid())
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
