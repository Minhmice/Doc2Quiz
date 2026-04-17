-- Doc2Quiz cloud-first schema (public) + RLS
-- Multi-tenant rule: every table has user_id, enforced by RLS + composite FKs.

begin;

create extension if not exists pgcrypto;

-- ---------- Types ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'media_asset_kind') then
    create type public.media_asset_kind as enum ('page_image', 'attachment');
  end if;
end $$;

-- ---------- Study sets ----------

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  description text,
  slug text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Enables composite FK references
  constraint study_sets_id_user_unique unique (id, user_id),
  constraint study_sets_title_nonempty check (char_length(btrim(title)) > 0),
  constraint study_sets_slug_nonempty check (slug is null or char_length(btrim(slug)) > 0)
);

create unique index if not exists study_sets_user_slug_unique
  on public.study_sets (user_id, slug)
  where slug is not null;

create index if not exists study_sets_user_created_at_idx
  on public.study_sets (user_id, created_at desc);

-- ---------- Study set document (extractedText) ----------

create table if not exists public.study_set_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null,

  source_file_name text,
  page_count integer,
  extracted_text text not null,
  extracted_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint study_set_documents_id_user_unique unique (id, user_id),
  constraint study_set_documents_one_per_set unique (user_id, study_set_id),
  constraint study_set_documents_study_set_fk
    foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id)
    on delete cascade,
  constraint study_set_documents_page_count_nonneg check (page_count is null or page_count >= 0)
);

create index if not exists study_set_documents_user_study_set_idx
  on public.study_set_documents (user_id, study_set_id);

-- ---------- Approved questions (MCQ) ----------

create table if not exists public.approved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null,

  prompt text not null,
  choices text[] not null,
  correct_index smallint not null,
  explanation text,

  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint approved_questions_id_user_unique unique (id, user_id),
  constraint approved_questions_study_set_fk
    foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id)
    on delete cascade,
  constraint approved_questions_prompt_nonempty check (char_length(btrim(prompt)) > 0),
  constraint approved_questions_choices_len_4 check (array_length(choices, 1) = 4),
  constraint approved_questions_correct_index_range check (correct_index between 0 and 3)
);

create index if not exists approved_questions_user_study_set_idx
  on public.approved_questions (user_id, study_set_id);

-- ---------- Approved flashcards ----------

create table if not exists public.approved_flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null,

  front text not null,
  back text not null,
  tags text[] not null default '{}'::text[],
  source jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint approved_flashcards_id_user_unique unique (id, user_id),
  constraint approved_flashcards_study_set_fk
    foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id)
    on delete cascade,
  constraint approved_flashcards_front_nonempty check (char_length(btrim(front)) > 0),
  constraint approved_flashcards_back_nonempty check (char_length(btrim(back)) > 0)
);

create index if not exists approved_flashcards_user_study_set_idx
  on public.approved_flashcards (user_id, study_set_id);

-- ---------- Media assets (Storage-backed) ----------

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null,
  document_id uuid,

  kind public.media_asset_kind not null,

  -- Supabase Storage reference
  bucket text not null,
  object_path text not null,

  original_file_name text,
  mime_type text,
  byte_size bigint,
  sha256 text,

  -- For page images
  page_number integer,
  width integer,
  height integer,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint media_assets_id_user_unique unique (id, user_id),
  constraint media_assets_study_set_fk
    foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id)
    on delete cascade,
  constraint media_assets_document_fk
    foreign key (document_id, user_id)
    references public.study_set_documents (id, user_id)
    on delete cascade,
  constraint media_assets_bucket_nonempty check (char_length(btrim(bucket)) > 0),
  constraint media_assets_object_path_nonempty check (char_length(btrim(object_path)) > 0),
  constraint media_assets_kind_page_fields check (
    (kind <> 'page_image')
    or (page_number is not null and page_number >= 1)
  ),
  constraint media_assets_byte_size_nonneg check (byte_size is null or byte_size >= 0),
  constraint media_assets_dimensions_nonneg check (
    (width is null or width >= 0) and (height is null or height >= 0)
  )
);

create unique index if not exists media_assets_bucket_path_unique
  on public.media_assets (bucket, object_path);

create index if not exists media_assets_user_study_set_idx
  on public.media_assets (user_id, study_set_id);

create index if not exists media_assets_user_document_idx
  on public.media_assets (user_id, document_id);

create index if not exists media_assets_user_kind_idx
  on public.media_assets (user_id, kind);

-- ---------- OCR results (JSON) ----------

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null,

  engine text,
  result jsonb not null,

  created_at timestamptz not null default now(),

  constraint ocr_results_id_user_unique unique (id, user_id),
  constraint ocr_results_asset_fk
    foreign key (asset_id, user_id)
    references public.media_assets (id, user_id)
    on delete cascade
);

create index if not exists ocr_results_user_asset_idx
  on public.ocr_results (user_id, asset_id);

-- ---------- Quiz sessions ----------

create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_set_id uuid not null,

  mode text not null default 'mcq',
  settings jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  created_at timestamptz not null default now(),

  constraint quiz_sessions_id_user_unique unique (id, user_id),
  constraint quiz_sessions_study_set_fk
    foreign key (study_set_id, user_id)
    references public.study_sets (id, user_id)
    on delete cascade,
  constraint quiz_sessions_mode_nonempty check (char_length(btrim(mode)) > 0),
  constraint quiz_sessions_time_order check (ended_at is null or ended_at >= started_at)
);

create index if not exists quiz_sessions_user_study_set_started_idx
  on public.quiz_sessions (user_id, study_set_id, started_at desc);

-- Each item is an asked question (immutable history of attempts within a session)
create table if not exists public.quiz_session_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  question_id uuid not null,

  ordinal integer not null,
  chosen_index smallint,
  correct boolean,
  answered_at timestamptz,

  created_at timestamptz not null default now(),

  constraint quiz_session_items_id_user_unique unique (id, user_id),
  constraint quiz_session_items_session_fk
    foreign key (session_id, user_id)
    references public.quiz_sessions (id, user_id)
    on delete cascade,
  constraint quiz_session_items_question_fk
    foreign key (question_id, user_id)
    references public.approved_questions (id, user_id)
    on delete cascade,
  constraint quiz_session_items_ordinal_nonneg check (ordinal >= 0),
  constraint quiz_session_items_chosen_index_range check (chosen_index is null or chosen_index between 0 and 3),
  constraint quiz_session_items_answered_fields check (
    (answered_at is null and chosen_index is null and correct is null)
    or (answered_at is not null and chosen_index is not null and correct is not null)
  )
);

create unique index if not exists quiz_session_items_session_ordinal_unique
  on public.quiz_session_items (user_id, session_id, ordinal);

create index if not exists quiz_session_items_user_question_idx
  on public.quiz_session_items (user_id, question_id);

-- ---------- Wrong history ----------

create table if not exists public.wrong_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null,
  session_id uuid,
  session_item_id uuid,

  chosen_index smallint,
  correct_index smallint,

  occurred_at timestamptz not null default now(),

  constraint wrong_history_id_user_unique unique (id, user_id),
  constraint wrong_history_question_fk
    foreign key (question_id, user_id)
    references public.approved_questions (id, user_id)
    on delete cascade,
  constraint wrong_history_session_fk
    foreign key (session_id, user_id)
    references public.quiz_sessions (id, user_id)
    on delete set null,
  constraint wrong_history_session_item_fk
    foreign key (session_item_id, user_id)
    references public.quiz_session_items (id, user_id)
    on delete set null,
  constraint wrong_history_chosen_index_range check (chosen_index is null or chosen_index between 0 and 3),
  constraint wrong_history_correct_index_range check (correct_index is null or correct_index between 0 and 3)
);

create index if not exists wrong_history_user_question_occurred_idx
  on public.wrong_history (user_id, question_id, occurred_at desc);

create index if not exists wrong_history_user_occurred_idx
  on public.wrong_history (user_id, occurred_at desc);

-- ---------- RLS ----------

alter table public.study_sets enable row level security;
alter table public.study_set_documents enable row level security;
alter table public.approved_questions enable row level security;
alter table public.approved_flashcards enable row level security;
alter table public.media_assets enable row level security;
alter table public.ocr_results enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_session_items enable row level security;
alter table public.wrong_history enable row level security;

-- Study sets
drop policy if exists "study_sets_select_own" on public.study_sets;
create policy "study_sets_select_own" on public.study_sets
  for select using (user_id = auth.uid());

drop policy if exists "study_sets_insert_own" on public.study_sets;
create policy "study_sets_insert_own" on public.study_sets
  for insert with check (user_id = auth.uid());

drop policy if exists "study_sets_update_own" on public.study_sets;
create policy "study_sets_update_own" on public.study_sets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_sets_delete_own" on public.study_sets;
create policy "study_sets_delete_own" on public.study_sets
  for delete using (user_id = auth.uid());

-- Study set documents
drop policy if exists "study_set_documents_select_own" on public.study_set_documents;
create policy "study_set_documents_select_own" on public.study_set_documents
  for select using (user_id = auth.uid());

drop policy if exists "study_set_documents_insert_own" on public.study_set_documents;
create policy "study_set_documents_insert_own" on public.study_set_documents
  for insert with check (user_id = auth.uid());

drop policy if exists "study_set_documents_update_own" on public.study_set_documents;
create policy "study_set_documents_update_own" on public.study_set_documents
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_set_documents_delete_own" on public.study_set_documents;
create policy "study_set_documents_delete_own" on public.study_set_documents
  for delete using (user_id = auth.uid());

-- Approved questions
drop policy if exists "approved_questions_select_own" on public.approved_questions;
create policy "approved_questions_select_own" on public.approved_questions
  for select using (user_id = auth.uid());

drop policy if exists "approved_questions_insert_own" on public.approved_questions;
create policy "approved_questions_insert_own" on public.approved_questions
  for insert with check (user_id = auth.uid());

drop policy if exists "approved_questions_update_own" on public.approved_questions;
create policy "approved_questions_update_own" on public.approved_questions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "approved_questions_delete_own" on public.approved_questions;
create policy "approved_questions_delete_own" on public.approved_questions
  for delete using (user_id = auth.uid());

-- Approved flashcards
drop policy if exists "approved_flashcards_select_own" on public.approved_flashcards;
create policy "approved_flashcards_select_own" on public.approved_flashcards
  for select using (user_id = auth.uid());

drop policy if exists "approved_flashcards_insert_own" on public.approved_flashcards;
create policy "approved_flashcards_insert_own" on public.approved_flashcards
  for insert with check (user_id = auth.uid());

drop policy if exists "approved_flashcards_update_own" on public.approved_flashcards;
create policy "approved_flashcards_update_own" on public.approved_flashcards
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "approved_flashcards_delete_own" on public.approved_flashcards;
create policy "approved_flashcards_delete_own" on public.approved_flashcards
  for delete using (user_id = auth.uid());

-- Media assets
drop policy if exists "media_assets_select_own" on public.media_assets;
create policy "media_assets_select_own" on public.media_assets
  for select using (user_id = auth.uid());

drop policy if exists "media_assets_insert_own" on public.media_assets;
create policy "media_assets_insert_own" on public.media_assets
  for insert with check (user_id = auth.uid());

drop policy if exists "media_assets_update_own" on public.media_assets;
create policy "media_assets_update_own" on public.media_assets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "media_assets_delete_own" on public.media_assets;
create policy "media_assets_delete_own" on public.media_assets
  for delete using (user_id = auth.uid());

-- OCR results
drop policy if exists "ocr_results_select_own" on public.ocr_results;
create policy "ocr_results_select_own" on public.ocr_results
  for select using (user_id = auth.uid());

drop policy if exists "ocr_results_insert_own" on public.ocr_results;
create policy "ocr_results_insert_own" on public.ocr_results
  for insert with check (user_id = auth.uid());

drop policy if exists "ocr_results_update_own" on public.ocr_results;
create policy "ocr_results_update_own" on public.ocr_results
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ocr_results_delete_own" on public.ocr_results;
create policy "ocr_results_delete_own" on public.ocr_results
  for delete using (user_id = auth.uid());

-- Quiz sessions
drop policy if exists "quiz_sessions_select_own" on public.quiz_sessions;
create policy "quiz_sessions_select_own" on public.quiz_sessions
  for select using (user_id = auth.uid());

drop policy if exists "quiz_sessions_insert_own" on public.quiz_sessions;
create policy "quiz_sessions_insert_own" on public.quiz_sessions
  for insert with check (user_id = auth.uid());

drop policy if exists "quiz_sessions_update_own" on public.quiz_sessions;
create policy "quiz_sessions_update_own" on public.quiz_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "quiz_sessions_delete_own" on public.quiz_sessions;
create policy "quiz_sessions_delete_own" on public.quiz_sessions
  for delete using (user_id = auth.uid());

-- Quiz session items
drop policy if exists "quiz_session_items_select_own" on public.quiz_session_items;
create policy "quiz_session_items_select_own" on public.quiz_session_items
  for select using (user_id = auth.uid());

drop policy if exists "quiz_session_items_insert_own" on public.quiz_session_items;
create policy "quiz_session_items_insert_own" on public.quiz_session_items
  for insert with check (user_id = auth.uid());

drop policy if exists "quiz_session_items_update_own" on public.quiz_session_items;
create policy "quiz_session_items_update_own" on public.quiz_session_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "quiz_session_items_delete_own" on public.quiz_session_items;
create policy "quiz_session_items_delete_own" on public.quiz_session_items
  for delete using (user_id = auth.uid());

-- Wrong history
drop policy if exists "wrong_history_select_own" on public.wrong_history;
create policy "wrong_history_select_own" on public.wrong_history
  for select using (user_id = auth.uid());

drop policy if exists "wrong_history_insert_own" on public.wrong_history;
create policy "wrong_history_insert_own" on public.wrong_history
  for insert with check (user_id = auth.uid());

drop policy if exists "wrong_history_update_own" on public.wrong_history;
create policy "wrong_history_update_own" on public.wrong_history
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "wrong_history_delete_own" on public.wrong_history;
create policy "wrong_history_delete_own" on public.wrong_history
  for delete using (user_id = auth.uid());

commit;

