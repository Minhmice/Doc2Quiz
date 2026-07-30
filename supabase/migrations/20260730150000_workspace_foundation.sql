-- Phase 9 workspace foundation: schema, RLS, compatibility backfill, resolver.
-- Timestamp 20260730150000 (plan asked 140000 — collision with quota reservations).
-- New sections table is public.canonical_version_sections (legacy canonical_sections untouched).

begin;

create schema if not exists private;
create schema if not exists extensions;
-- Prefer existing install (baseline may put pgcrypto in public or extensions).
create extension if not exists pgcrypto;

-- SHA-256 of UTF-8 bytes after caller normalizes line endings.
-- pgcrypto lives in extensions on Supabase; functions with search_path=public
-- cannot resolve bare digest(text, unknown) — qualify via this helper.
create or replace function private.sha256_utf8_hex(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(digest(convert_to(coalesce(p_text, ''), 'UTF8'), 'sha256'::text), 'hex');
$$;

revoke all on function private.sha256_utf8_hex(text) from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  subtitle text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create index if not exists workspaces_owner_active_idx
  on public.workspaces (owner_id, updated_at desc)
  where deleted_at is null;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_members_role_check check (role in ('owner', 'editor', 'viewer'))
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

create index if not exists documents_workspace_active_idx
  on public.documents (workspace_id, updated_at desc)
  where deleted_at is null;

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

create index if not exists document_versions_document_active_idx
  on public.document_versions (document_id, version_number desc)
  where deleted_at is null;

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

create index if not exists canonical_versions_document_version_active_idx
  on public.canonical_versions (document_version_id, version_number desc)
  where deleted_at is null;

-- New versioned sections table. Legacy public.canonical_sections is untouched.
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

create unique index if not exists canonical_version_sections_key_unique
  on public.canonical_version_sections (canonical_version_id, section_key)
  where section_key is not null;

create index if not exists canonical_version_sections_version_ordinal_idx
  on public.canonical_version_sections (canonical_version_id, ordinal);

create table if not exists public.learning_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  legacy_study_set_id uuid not null unique references public.study_sets (id) on delete restrict,
  legacy_parent_study_set_id uuid not null references public.study_sets (id) on delete restrict,
  kind text not null,
  title text not null,
  status text not null default 'ready',
  generation_provenance jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint learning_outputs_kind_check check (kind in ('quiz', 'flashcards')),
  constraint learning_outputs_status_check check (
    status in ('pending', 'ready', 'failed')
  ),
  constraint learning_outputs_bridge_ne_parent check (
    legacy_study_set_id <> legacy_parent_study_set_id
  )
);

create trigger learning_outputs_set_updated_at
before update on public.learning_outputs
for each row
execute function public.set_updated_at();

create unique index if not exists learning_outputs_parent_kind_active_unique
  on public.learning_outputs (legacy_parent_study_set_id, kind)
  where deleted_at is null;

create index if not exists learning_outputs_workspace_active_idx
  on public.learning_outputs (workspace_id, updated_at desc)
  where deleted_at is null;

create index if not exists learning_outputs_parent_idx
  on public.learning_outputs (legacy_parent_study_set_id);

create table if not exists public.output_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.learning_outputs (id) on delete cascade,
  -- Historical locator only; never cascade-delete evidence when source is removed.
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

create index if not exists output_source_snapshots_output_idx
  on public.output_source_snapshots (output_id, ordinal);

alter table public.approved_questions
  add column if not exists output_id uuid null
    references public.learning_outputs (id) on delete set null;

alter table public.approved_flashcards
  add column if not exists output_id uuid null
    references public.learning_outputs (id) on delete set null;

create index if not exists approved_questions_output_id_idx
  on public.approved_questions (output_id)
  where output_id is not null;

create index if not exists approved_flashcards_output_id_idx
  on public.approved_flashcards (output_id)
  where output_id is not null;

-- ---------------------------------------------------------------------------
-- Hardened membership helper
-- ---------------------------------------------------------------------------

create or replace function private.can_workspace(
  p_workspace_id uuid,
  p_required_role text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_have integer;
  v_need integer;
begin
  if v_uid is null then
    return false;
  end if;
  if p_workspace_id is null then
    return false;
  end if;
  if p_required_role is null or p_required_role not in ('viewer', 'editor', 'owner') then
    return false;
  end if;

  select m.role
  into v_role
  from public.workspace_members as m
  where m.workspace_id = p_workspace_id
    and m.user_id = v_uid;

  if v_role is null then
    return false;
  end if;

  v_have := case v_role
    when 'viewer' then 1
    when 'editor' then 2
    when 'owner' then 3
    else 0
  end;
  v_need := case p_required_role
    when 'viewer' then 1
    when 'editor' then 2
    when 'owner' then 3
    else 99
  end;

  return v_have >= v_need;
end;
$$;

revoke all on function private.can_workspace(uuid, text) from public;
revoke all on function private.can_workspace(uuid, text) from anon;
grant execute on function private.can_workspace(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kind-aware bridge resolver (database-visible contract for later adapters)
-- ---------------------------------------------------------------------------

create or replace function public.resolve_learning_output_bridge(
  p_study_set_id uuid,
  p_route_kind text
)
returns table (
  output_id uuid,
  workspace_id uuid,
  bridge_study_set_id uuid,
  legacy_parent_study_set_id uuid,
  kind text,
  resolution_mode text,
  history_study_set_id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_bridge public.learning_outputs%rowtype;
  v_parent public.learning_outputs%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_study_set_id is null then
    raise exception 'Study set id required';
  end if;

  -- Normalize flashcard singular used by some routes to flashcards storage kind.
  if p_route_kind in ('quiz') then
    v_kind := 'quiz';
  elsif p_route_kind in ('flashcard', 'flashcards') then
    v_kind := 'flashcards';
  else
    raise exception 'Route kind must be quiz or flashcards';
  end if;

  -- Bridge ID: resolve own output only; history stays on bridge (no parent fallback).
  select *
  into v_bridge
  from public.learning_outputs lo
  where lo.legacy_study_set_id = p_study_set_id
    and lo.deleted_at is null
    and (select private.can_workspace(lo.workspace_id, 'viewer'))
  limit 1;

  if found then
    output_id := v_bridge.id;
    workspace_id := v_bridge.workspace_id;
    bridge_study_set_id := v_bridge.legacy_study_set_id;
    legacy_parent_study_set_id := v_bridge.legacy_parent_study_set_id;
    kind := v_bridge.kind;
    resolution_mode := 'bridge';
    history_study_set_id := v_bridge.legacy_study_set_id;
    return next;
    return;
  end if;

  -- Historic parent ID: requires route kind; history lookup uses parent id.
  select *
  into v_parent
  from public.learning_outputs lo
  where lo.legacy_parent_study_set_id = p_study_set_id
    and lo.kind = v_kind
    and lo.deleted_at is null
    and (select private.can_workspace(lo.workspace_id, 'viewer'))
  limit 1;

  if found then
    output_id := v_parent.id;
    workspace_id := v_parent.workspace_id;
    bridge_study_set_id := v_parent.legacy_study_set_id;
    legacy_parent_study_set_id := v_parent.legacy_parent_study_set_id;
    kind := v_parent.kind;
    resolution_mode := 'parent';
    history_study_set_id := v_parent.legacy_parent_study_set_id;
    return next;
  end if;
end;
$$;

revoke all on function public.resolve_learning_output_bridge(uuid, text) from public;
revoke all on function public.resolve_learning_output_bridge(uuid, text) from anon;
grant execute on function public.resolve_learning_output_bridge(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.canonical_versions enable row level security;
alter table public.canonical_version_sections enable row level security;
alter table public.learning_outputs enable row level security;
alter table public.output_source_snapshots enable row level security;

-- workspaces
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.can_workspace(id, 'viewer')));

create policy workspaces_insert_owner on public.workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select auth.uid()) is not null);

create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using ((select private.can_workspace(id, 'owner')))
  with check ((select private.can_workspace(id, 'owner')));

-- workspace_members: read for members; no direct client mutation policies
create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using ((select private.can_workspace(workspace_id, 'viewer')));

-- documents
create policy documents_select_member on public.documents
  for select to authenticated
  using ((select private.can_workspace(workspace_id, 'viewer')));

create policy documents_insert_editor on public.documents
  for insert to authenticated
  with check ((select private.can_workspace(workspace_id, 'editor')));

create policy documents_update_editor on public.documents
  for update to authenticated
  using ((select private.can_workspace(workspace_id, 'editor')))
  with check ((select private.can_workspace(workspace_id, 'editor')));

-- document_versions
create policy document_versions_select_member on public.document_versions
  for select to authenticated
  using (
    (select private.can_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id),
      'viewer'
    ))
  );

create policy document_versions_insert_editor on public.document_versions
  for insert to authenticated
  with check (
    (select private.can_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id),
      'editor'
    ))
    and created_by = (select auth.uid())
  );

create policy document_versions_update_editor on public.document_versions
  for update to authenticated
  using (
    (select private.can_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id),
      'editor'
    ))
  )
  with check (
    (select private.can_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id),
      'editor'
    ))
  );

-- canonical_versions
create policy canonical_versions_select_member on public.canonical_versions
  for select to authenticated
  using (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      ),
      'viewer'
    ))
  );

create policy canonical_versions_insert_editor on public.canonical_versions
  for insert to authenticated
  with check (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      ),
      'editor'
    ))
    and created_by = (select auth.uid())
  );

create policy canonical_versions_update_editor on public.canonical_versions
  for update to authenticated
  using (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      ),
      'editor'
    ))
  )
  with check (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      ),
      'editor'
    ))
  );

-- canonical_version_sections
create policy canonical_version_sections_select_member on public.canonical_version_sections
  for select to authenticated
  using (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      ),
      'viewer'
    ))
  );

create policy canonical_version_sections_insert_editor on public.canonical_version_sections
  for insert to authenticated
  with check (
    (select private.can_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      ),
      'editor'
    ))
  );

-- learning_outputs
create policy learning_outputs_select_member on public.learning_outputs
  for select to authenticated
  using ((select private.can_workspace(workspace_id, 'viewer')));

create policy learning_outputs_insert_editor on public.learning_outputs
  for insert to authenticated
  with check (
    (select private.can_workspace(workspace_id, 'editor'))
    and created_by = (select auth.uid())
  );

create policy learning_outputs_update_editor on public.learning_outputs
  for update to authenticated
  using ((select private.can_workspace(workspace_id, 'editor')))
  with check ((select private.can_workspace(workspace_id, 'editor')));

-- output_source_snapshots
create policy output_source_snapshots_select_member on public.output_source_snapshots
  for select to authenticated
  using (
    (select private.can_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id),
      'viewer'
    ))
  );

create policy output_source_snapshots_insert_editor on public.output_source_snapshots
  for insert to authenticated
  with check (
    (select private.can_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id),
      'editor'
    ))
  );

-- ---------------------------------------------------------------------------
-- Compatibility backfill (reusable for SQL tests)
-- ---------------------------------------------------------------------------

create or replace function private.backfill_legacy_study_set(p_study_set_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  r record;
  v_workspace_id uuid;
  v_document_id uuid;
  v_document_version_id uuid;
  v_canonical_version_id uuid;
  v_has_quiz boolean;
  v_has_flashcards boolean;
  v_bridge_id uuid;
  v_output_id uuid;
  v_canonical_checksum text;
  v_sections_checksum text;
  v_sections_json jsonb;
begin
  if exists (
    select 1
    from public.learning_outputs lo
    where lo.legacy_parent_study_set_id = p_study_set_id
       or lo.legacy_study_set_id = p_study_set_id
  ) or exists (
    select 1
    from public.document_versions dv
    where dv.conversion_provenance ->> 'study_set_id' = p_study_set_id::text
  ) then
    select d.workspace_id into v_workspace_id
    from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    where dv.conversion_provenance ->> 'study_set_id' = p_study_set_id::text
    limit 1;
    return v_workspace_id;
  end if;

  select
    ss.id as study_set_id,
    ss.user_id,
    ss.title,
    ss.subtitle,
    ss.pipeline_stage,
    ss.content_kind,
    ss.created_at,
    ss.updated_at,
    cd.id as canonical_document_id,
    cd.original_storage_path,
    cd.original_filename,
    cd.original_mime_type,
    cd.raw_markdown,
    cd.canonical_markdown,
    cd.metadata
  into r
  from public.study_sets ss
  left join public.canonical_documents cd on cd.study_set_id = ss.id
  where ss.id = p_study_set_id;

  if not found then
    raise exception 'Study set not found for backfill';
  end if;

  insert into public.workspaces (owner_id, title, subtitle, created_at, updated_at)
  values (r.user_id, r.title, r.subtitle, r.created_at, r.updated_at)
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, created_at)
  values (v_workspace_id, r.user_id, 'owner', r.created_at);

  insert into public.documents (workspace_id, title, description, created_at, updated_at)
  values (v_workspace_id, r.title, r.subtitle, r.created_at, r.updated_at)
  returning id into v_document_id;

  insert into public.document_versions (
    document_id,
    version_number,
    source_kind,
    original_storage_path,
    original_filename,
    original_mime_type,
    raw_markdown,
    raw_markdown_checksum,
    conversion_provenance,
    created_by,
    created_at
  )
  values (
    v_document_id,
    1,
    case when r.original_storage_path is not null then 'upload' else 'legacy' end,
    r.original_storage_path,
    r.original_filename,
    r.original_mime_type,
    coalesce(r.raw_markdown, ''),
    case
      when coalesce(r.raw_markdown, '') = '' then null
      else private.sha256_utf8_hex(
        replace(replace(r.raw_markdown, E'\r\n', E'\n'), E'\r', E'\n')
      )
    end,
    jsonb_build_object('migrated_from', 'canonical_documents', 'study_set_id', r.study_set_id),
    r.user_id,
    r.created_at
  )
  returning id into v_document_version_id;

  v_canonical_version_id := null;
  v_sections_json := '[]'::jsonb;

  if r.canonical_document_id is not null
     and nullif(btrim(coalesce(r.canonical_markdown, '')), '') is not null then
    v_canonical_checksum := private.sha256_utf8_hex(
      replace(replace(r.canonical_markdown, E'\r\n', E'\n'), E'\r', E'\n')
    );

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'ordinal', cs.ordinal,
          'section_key', cs.section_key,
          'heading', cs.heading,
          'section_type', cs.section_type,
          'body_markdown', cs.body_markdown
        )
        order by cs.ordinal
      ),
      '[]'::jsonb
    )
    into v_sections_json
    from public.canonical_sections cs
    where cs.canonical_document_id = r.canonical_document_id;

    select private.sha256_utf8_hex(coalesce(v_sections_json::text, '[]'))
    into v_sections_checksum;

    insert into public.canonical_versions (
      document_version_id,
      version_number,
      status,
      canonical_markdown,
      canonical_content_checksum,
      sections_checksum,
      provenance,
      metadata,
      created_by,
      created_at
    )
    values (
      v_document_version_id,
      1,
      'completed',
      r.canonical_markdown,
      v_canonical_checksum,
      coalesce(v_sections_checksum, private.sha256_utf8_hex('[]')),
      jsonb_build_object(
        'migrated_from', 'canonical_documents',
        'study_set_id', r.study_set_id,
        'mode', 'legacy_backfill'
      ),
      coalesce(r.metadata, '{}'::jsonb),
      r.user_id,
      r.created_at
    )
    returning id into v_canonical_version_id;

    insert into public.canonical_version_sections (
      canonical_version_id,
      ordinal,
      section_key,
      heading,
      body_markdown,
      section_type,
      created_at
    )
    select
      v_canonical_version_id,
      cs.ordinal,
      cs.section_key,
      cs.heading,
      cs.body_markdown,
      cs.section_type,
      cs.created_at
    from public.canonical_sections cs
    where cs.canonical_document_id = r.canonical_document_id
    order by cs.ordinal;
  end if;

  select exists(
    select 1 from public.approved_questions aq where aq.study_set_id = r.study_set_id
  ) into v_has_quiz;
  select exists(
    select 1 from public.approved_flashcards af where af.study_set_id = r.study_set_id
  ) into v_has_flashcards;

  if v_has_quiz then
    insert into public.study_sets (
      user_id, title, subtitle, pipeline_stage, content_kind, created_at, updated_at
    )
    values (
      r.user_id, r.title || ' (quiz)', r.subtitle, 'quiz', 'quiz', r.created_at, r.updated_at
    )
    returning id into v_bridge_id;

    insert into public.learning_outputs (
      workspace_id, legacy_study_set_id, legacy_parent_study_set_id, kind, title, status,
      generation_provenance, created_by, created_at, updated_at
    )
    values (
      v_workspace_id, v_bridge_id, r.study_set_id, 'quiz', r.title, 'ready',
      jsonb_build_object('migrated_from', 'approved_questions', 'parent_study_set_id', r.study_set_id),
      r.user_id, r.created_at, r.updated_at
    )
    returning id into v_output_id;

    update public.approved_questions
    set study_set_id = v_bridge_id, output_id = v_output_id
    where study_set_id = r.study_set_id;

    insert into public.output_source_snapshots (
      output_id, canonical_version_id, ordinal, canonical_content_checksum, sections_checksum,
      canonical_markdown, sections, canonical_metadata, source_provenance
    )
    values (
      v_output_id, v_canonical_version_id, 1,
      case when v_canonical_version_id is null then null else v_canonical_checksum end,
      case when v_canonical_version_id is null then null else v_sections_checksum end,
      coalesce(r.canonical_markdown, ''),
      coalesce(v_sections_json, '[]'::jsonb),
      coalesce(r.metadata, '{}'::jsonb),
      case
        when v_canonical_version_id is null then
          jsonb_build_object(
            'migration_exception', true,
            'reason', 'canonical_source_absent',
            'parent_study_set_id', r.study_set_id
          )
        else
          jsonb_build_object(
            'migrated_from', 'canonical_documents',
            'parent_study_set_id', r.study_set_id
          )
      end
    );
  end if;

  if v_has_flashcards then
    insert into public.study_sets (
      user_id, title, subtitle, pipeline_stage, content_kind, created_at, updated_at
    )
    values (
      r.user_id, r.title || ' (flashcards)', r.subtitle, 'flashcards', 'flashcards',
      r.created_at, r.updated_at
    )
    returning id into v_bridge_id;

    insert into public.learning_outputs (
      workspace_id, legacy_study_set_id, legacy_parent_study_set_id, kind, title, status,
      generation_provenance, created_by, created_at, updated_at
    )
    values (
      v_workspace_id, v_bridge_id, r.study_set_id, 'flashcards', r.title, 'ready',
      jsonb_build_object('migrated_from', 'approved_flashcards', 'parent_study_set_id', r.study_set_id),
      r.user_id, r.created_at, r.updated_at
    )
    returning id into v_output_id;

    update public.approved_flashcards
    set study_set_id = v_bridge_id, output_id = v_output_id
    where study_set_id = r.study_set_id;

    insert into public.output_source_snapshots (
      output_id, canonical_version_id, ordinal, canonical_content_checksum, sections_checksum,
      canonical_markdown, sections, canonical_metadata, source_provenance
    )
    values (
      v_output_id, v_canonical_version_id, 1,
      case when v_canonical_version_id is null then null else v_canonical_checksum end,
      case when v_canonical_version_id is null then null else v_sections_checksum end,
      coalesce(r.canonical_markdown, ''),
      coalesce(v_sections_json, '[]'::jsonb),
      coalesce(r.metadata, '{}'::jsonb),
      case
        when v_canonical_version_id is null then
          jsonb_build_object(
            'migration_exception', true,
            'reason', 'canonical_source_absent',
            'parent_study_set_id', r.study_set_id
          )
        else
          jsonb_build_object(
            'migrated_from', 'canonical_documents',
            'parent_study_set_id', r.study_set_id
          )
      end
    );
  end if;

  return v_workspace_id;
end;
$$;

revoke all on function private.backfill_legacy_study_set(uuid) from public;
revoke all on function private.backfill_legacy_study_set(uuid) from anon;
-- Tests and service role may execute; authenticated clients must not self-backfill arbitrarily.
grant execute on function private.backfill_legacy_study_set(uuid) to service_role;

do $$
declare
  sid uuid;
begin
  for sid in
    select ss.id
    from public.study_sets ss
    where not exists (
      select 1 from public.learning_outputs lo
      where lo.legacy_parent_study_set_id = ss.id or lo.legacy_study_set_id = ss.id
    )
    and not exists (
      select 1 from public.document_versions dv
      where dv.conversion_provenance ->> 'study_set_id' = ss.id::text
    )
  loop
    perform private.backfill_legacy_study_set(sid);
  end loop;
end;
$$;

commit;
