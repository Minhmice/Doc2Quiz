begin;

alter table public.study_set_documents
  add column if not exists source_content_sha256 text null;

alter table public.study_set_documents
  add column if not exists canonical_units jsonb null;

alter table public.study_set_documents
  add column if not exists canonical_extraction_schema_version integer null;

alter table public.study_set_documents
  add column if not exists canonical_model_fingerprint text null;

alter table public.study_set_documents
  add column if not exists generation_coverage jsonb null;

alter table public.study_set_documents
  add column if not exists last_generation_seed integer null;

alter table public.study_set_documents
  add column if not exists generation_schema_version integer null;

create table if not exists public.canonical_document_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_sha256 text not null,
  extraction_schema_version integer not null,
  model_fingerprint text not null,
  units jsonb not null,
  created_at timestamptz not null default now(),
  constraint canonical_document_extractions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint canonical_document_extractions_cache_unique
    unique (user_id, content_sha256, extraction_schema_version, model_fingerprint)
);

create index if not exists canonical_document_extractions_user_content_idx
  on public.canonical_document_extractions (user_id, content_sha256);

alter table public.canonical_document_extractions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_document_extractions'
      and policyname = 'canonical_document_extractions_select_own'
  ) then
    create policy canonical_document_extractions_select_own
      on public.canonical_document_extractions
      for select to authenticated
      using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_document_extractions'
      and policyname = 'canonical_document_extractions_insert_own'
  ) then
    create policy canonical_document_extractions_insert_own
      on public.canonical_document_extractions
      for insert to authenticated
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_document_extractions'
      and policyname = 'canonical_document_extractions_update_own'
  ) then
    create policy canonical_document_extractions_update_own
      on public.canonical_document_extractions
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canonical_document_extractions'
      and policyname = 'canonical_document_extractions_delete_own'
  ) then
    create policy canonical_document_extractions_delete_own
      on public.canonical_document_extractions
      for delete to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

commit;
