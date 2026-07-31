-- Documents, canonical versions, sections, and source snapshots.

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

alter table public.canonical_documents enable row level security;

alter table public.canonical_sections enable row level security;

alter table public.canonical_sections
  add column if not exists section_key text null;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_number integer not null,
  source_kind text not null default 'upload',
  original_storage_path text null,
  original_filename text null,
  original_mime_type text null,
  source_url text null,
  raw_markdown text not null default '',
  raw_markdown_checksum text null,
  conversion_provenance jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint document_versions_version_number_check check (version_number >= 1),
  constraint document_versions_document_version_unique unique (document_id, version_number)
);

create table if not exists public.canonical_versions (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references public.document_versions (id) on delete cascade,
  version_number integer not null,
  status text not null default 'completed',
  canonical_markdown text not null default '',
  canonical_content_checksum text not null,
  sections_checksum text not null,
  model text null,
  prompt_version text null,
  parser_version text null,
  generator_settings jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint canonical_versions_version_number_check check (version_number >= 1),
  constraint canonical_versions_status_check check (
    status in ('pending', 'completed', 'failed')
  ),
  constraint canonical_versions_document_version_unique unique (document_version_id, version_number)
);

create table if not exists public.canonical_version_sections (
  id uuid primary key default gen_random_uuid(),
  canonical_version_id uuid not null references public.canonical_versions (id) on delete cascade,
  ordinal integer not null,
  section_key text null,
  heading text null,
  body_markdown text not null default '',
  section_type text null,
  checksum text null,
  created_at timestamptz not null default now(),
  constraint canonical_version_sections_ordinal_unique unique (canonical_version_id, ordinal)
);

create table if not exists public.output_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.learning_outputs (id) on delete cascade,
  canonical_version_id uuid null references public.canonical_versions (id) on delete set null,
  ordinal integer not null default 1,
  canonical_content_checksum text null,
  sections_checksum text null,
  canonical_markdown text not null default '',
  sections jsonb not null default '[]'::jsonb,
  canonical_metadata jsonb not null default '{}'::jsonb,
  source_provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint output_source_snapshots_ordinal_check check (ordinal >= 1),
  constraint output_source_snapshots_output_ordinal_unique unique (output_id, ordinal)
);

alter table public.documents enable row level security;

alter table public.document_versions enable row level security;

alter table public.canonical_versions enable row level security;

alter table public.canonical_version_sections enable row level security;

alter table public.output_source_snapshots enable row level security;

create unique index if not exists canonical_sections_document_section_key_unique
  on public.canonical_sections (canonical_document_id, section_key)
  where section_key is not null;

create index if not exists documents_workspace_active_idx
  on public.documents (workspace_id, updated_at desc)
  where deleted_at is null;

create index if not exists document_versions_document_active_idx
  on public.document_versions (document_id, version_number desc)
  where deleted_at is null;

create index if not exists canonical_versions_document_version_active_idx
  on public.canonical_versions (document_version_id, version_number desc)
  where deleted_at is null;

create unique index if not exists canonical_version_sections_key_unique
  on public.canonical_version_sections (canonical_version_id, section_key)
  where section_key is not null;

create index if not exists canonical_version_sections_version_ordinal_idx
  on public.canonical_version_sections (canonical_version_id, ordinal);

create index if not exists output_source_snapshots_output_idx
  on public.output_source_snapshots (output_id, ordinal);
