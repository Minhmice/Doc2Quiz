-- Phase 10: hardened workspace role helpers and migrated RLS predicates.
-- Timestamp 20260730150200 (plan asked 140000 — collision with quota reservations; must run after 150100).

begin;

-- ---------------------------------------------------------------------------
-- Hardened role helpers (search_path='', schema-qualified, minimal grants)
-- ---------------------------------------------------------------------------

create or replace function private.workspace_role(p_workspace_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null or p_workspace_id is null then
    return null;
  end if;

  select m.role
  into v_role
  from public.workspace_members as m
  where m.workspace_id = p_workspace_id
    and m.user_id = v_uid;

  return v_role;
end;
$$;

create or replace function private.can_view_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) in ('owner', 'editor', 'viewer');
$$;

create or replace function private.can_edit_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) in ('owner', 'editor');
$$;

create or replace function private.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.workspace_role(p_workspace_id) = 'owner';
$$;

revoke all on function private.workspace_role(uuid) from public;
revoke all on function private.workspace_role(uuid) from anon;
revoke all on function private.can_view_workspace(uuid) from public;
revoke all on function private.can_view_workspace(uuid) from anon;
revoke all on function private.can_edit_workspace(uuid) from public;
revoke all on function private.can_edit_workspace(uuid) from anon;
revoke all on function private.is_workspace_owner(uuid) from public;
revoke all on function private.is_workspace_owner(uuid) from anon;

grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.can_view_workspace(uuid) to authenticated;
grant execute on function private.can_edit_workspace(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;

-- Keep legacy helper; delegate to workspace_role for consistent semantics.
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
  v_role text;
  v_have integer;
  v_need integer;
begin
  v_role := private.workspace_role(p_workspace_id);
  if v_role is null then
    return false;
  end if;
  if p_required_role is null or p_required_role not in ('viewer', 'editor', 'owner') then
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

-- Storage path helper: {workspaceId}/{documentId}/{versionId}/filename
create or replace function private.storage_object_workspace_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function private.storage_object_workspace_id(text) from public;
revoke all on function private.storage_object_workspace_id(text) from anon;
grant execute on function private.storage_object_workspace_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace-derived RLS: migrate to can_view_workspace / can_edit_workspace
-- ---------------------------------------------------------------------------

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using ((select private.can_view_workspace(id)));

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using ((select private.is_workspace_owner(id)))
  with check ((select private.is_workspace_owner(id)));

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

drop policy if exists documents_select_member on public.documents;
create policy documents_select_member on public.documents
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

drop policy if exists documents_insert_editor on public.documents;
create policy documents_insert_editor on public.documents
  for insert to authenticated
  with check ((select private.can_edit_workspace(workspace_id)));

drop policy if exists documents_update_editor on public.documents;
create policy documents_update_editor on public.documents
  for update to authenticated
  using ((select private.can_edit_workspace(workspace_id)))
  with check ((select private.can_edit_workspace(workspace_id)));

drop policy if exists document_versions_select_member on public.document_versions;
create policy document_versions_select_member on public.document_versions
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  );

drop policy if exists document_versions_insert_editor on public.document_versions;
create policy document_versions_insert_editor on public.document_versions
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
    and created_by = (select auth.uid())
  );

drop policy if exists document_versions_update_editor on public.document_versions;
create policy document_versions_update_editor on public.document_versions
  for update to authenticated
  using (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  )
  with check (
    (select private.can_edit_workspace(
      (select d.workspace_id from public.documents d where d.id = document_id)
    ))
  );

drop policy if exists canonical_versions_select_member on public.canonical_versions;
create policy canonical_versions_select_member on public.canonical_versions
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  );

drop policy if exists canonical_versions_insert_editor on public.canonical_versions;
create policy canonical_versions_insert_editor on public.canonical_versions
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
    and created_by = (select auth.uid())
  );

drop policy if exists canonical_versions_update_editor on public.canonical_versions;
create policy canonical_versions_update_editor on public.canonical_versions
  for update to authenticated
  using (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  )
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.document_versions dv
        join public.documents d on d.id = dv.document_id
        where dv.id = document_version_id
      )
    ))
  );

drop policy if exists canonical_version_sections_select_member on public.canonical_version_sections;
create policy canonical_version_sections_select_member on public.canonical_version_sections
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      )
    ))
  );

drop policy if exists canonical_version_sections_insert_editor on public.canonical_version_sections;
create policy canonical_version_sections_insert_editor on public.canonical_version_sections
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (
        select d.workspace_id
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = canonical_version_id
      )
    ))
  );

drop policy if exists learning_outputs_select_member on public.learning_outputs;
create policy learning_outputs_select_member on public.learning_outputs
  for select to authenticated
  using ((select private.can_view_workspace(workspace_id)));

drop policy if exists learning_outputs_insert_editor on public.learning_outputs;
create policy learning_outputs_insert_editor on public.learning_outputs
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(workspace_id))
    and created_by = (select auth.uid())
  );

drop policy if exists learning_outputs_update_editor on public.learning_outputs;
create policy learning_outputs_update_editor on public.learning_outputs
  for update to authenticated
  using ((select private.can_edit_workspace(workspace_id)))
  with check ((select private.can_edit_workspace(workspace_id)));

drop policy if exists output_source_snapshots_select_member on public.output_source_snapshots;
create policy output_source_snapshots_select_member on public.output_source_snapshots
  for select to authenticated
  using (
    (select private.can_view_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id)
    ))
  );

drop policy if exists output_source_snapshots_insert_editor on public.output_source_snapshots;
create policy output_source_snapshots_insert_editor on public.output_source_snapshots
  for insert to authenticated
  with check (
    (select private.can_edit_workspace(
      (select lo.workspace_id from public.learning_outputs lo where lo.id = output_id)
    ))
  );

-- ---------------------------------------------------------------------------
-- Output items: workspace collaborators via output_id; legacy rows stay owner-only
-- ---------------------------------------------------------------------------

drop policy if exists approved_questions_select_own on public.approved_questions;
create policy approved_questions_select_workspace on public.approved_questions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_view_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_insert_own on public.approved_questions;
create policy approved_questions_insert_workspace on public.approved_questions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_update_own on public.approved_questions;
create policy approved_questions_update_workspace on public.approved_questions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_questions_delete_own on public.approved_questions;
create policy approved_questions_delete_workspace on public.approved_questions
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_select_own on public.approved_flashcards;
create policy approved_flashcards_select_workspace on public.approved_flashcards
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_view_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_insert_own on public.approved_flashcards;
create policy approved_flashcards_insert_workspace on public.approved_flashcards
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_update_own on public.approved_flashcards;
create policy approved_flashcards_update_workspace on public.approved_flashcards
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

drop policy if exists approved_flashcards_delete_own on public.approved_flashcards;
create policy approved_flashcards_delete_workspace on public.approved_flashcards
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (
      output_id is not null
      and (select private.can_edit_workspace(
        (
          select lo.workspace_id
          from public.learning_outputs lo
          where lo.id = output_id
            and lo.deleted_at is null
        )
      ))
    )
  );

-- ---------------------------------------------------------------------------
-- Workspace-scoped storage (legacy owner policies retained for non-workspace paths)
-- ---------------------------------------------------------------------------

drop policy if exists doc2quiz_storage_select_workspace on storage.objects;
create policy doc2quiz_storage_select_workspace on storage.objects
  for select to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_view_workspace(private.storage_object_workspace_id(name)))
  );

drop policy if exists doc2quiz_storage_insert_workspace on storage.objects;
create policy doc2quiz_storage_insert_workspace on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

drop policy if exists doc2quiz_storage_update_workspace on storage.objects;
create policy doc2quiz_storage_update_workspace on storage.objects
  for update to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  )
  with check (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

drop policy if exists doc2quiz_storage_delete_workspace on storage.objects;
create policy doc2quiz_storage_delete_workspace on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'doc2quiz'
    and (select private.can_edit_workspace(private.storage_object_workspace_id(name)))
  );

-- ---------------------------------------------------------------------------
-- RPC predicates: use can_view_workspace / can_edit_workspace
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

  if p_route_kind in ('quiz') then
    v_kind := 'quiz';
  elsif p_route_kind in ('flashcard', 'flashcards') then
    v_kind := 'flashcards';
  else
    raise exception 'Route kind must be quiz or flashcards';
  end if;

  select *
  into v_bridge
  from public.learning_outputs lo
  where lo.legacy_study_set_id = p_study_set_id
    and lo.deleted_at is null
    and (select private.can_view_workspace(lo.workspace_id))
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

  select *
  into v_parent
  from public.learning_outputs lo
  where lo.legacy_parent_study_set_id = p_study_set_id
    and lo.kind = v_kind
    and lo.deleted_at is null
    and (select private.can_view_workspace(lo.workspace_id))
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

-- create_workspace_document_version editor check
create or replace function public.create_workspace_document_version(
  p_workspace_id uuid,
  p_document_id uuid,
  p_workspace_title text,
  p_document_title text,
  p_source_kind text,
  p_original_storage_path text,
  p_original_filename text,
  p_original_mime_type text,
  p_source_url text,
  p_raw_markdown text,
  p_raw_markdown_checksum text,
  p_conversion_provenance jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid := p_workspace_id;
  v_document_id uuid := p_document_id;
  v_version_id uuid;
  v_version_number integer;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_title := nullif(btrim(coalesce(p_document_title, p_workspace_title, '')), '');
  if v_title is null then
    raise exception 'Document title required';
  end if;

  if p_source_kind is null or p_source_kind not in ('upload', 'paste', 'url', 'legacy') then
    raise exception 'Invalid source_kind';
  end if;

  if v_workspace_id is null then
    if v_document_id is not null then
      raise exception 'document_id requires workspace_id';
    end if;

    insert into public.workspaces (owner_id, title, subtitle)
    values (
      v_user_id,
      coalesce(nullif(btrim(coalesce(p_workspace_title, '')), ''), v_title),
      null
    )
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'owner');

    insert into public.documents (workspace_id, title)
    values (v_workspace_id, v_title)
    returning id into v_document_id;

    v_version_number := 1;
  else
    if not (select private.can_edit_workspace(v_workspace_id)) then
      raise exception 'Workspace editor access required';
    end if;

    if v_document_id is null then
      insert into public.documents (workspace_id, title)
      values (v_workspace_id, v_title)
      returning id into v_document_id;
      v_version_number := 1;
    else
      if not exists (
        select 1
        from public.documents d
        where d.id = v_document_id
          and d.workspace_id = v_workspace_id
          and d.deleted_at is null
      ) then
        raise exception 'Document not found in workspace';
      end if;

      select coalesce(max(dv.version_number), 0) + 1
      into v_version_number
      from public.document_versions dv
      where dv.document_id = v_document_id;
    end if;
  end if;

  insert into public.document_versions (
    document_id,
    version_number,
    source_kind,
    original_storage_path,
    original_filename,
    original_mime_type,
    source_url,
    raw_markdown,
    raw_markdown_checksum,
    conversion_provenance,
    created_by
  )
  values (
    v_document_id,
    v_version_number,
    p_source_kind,
    p_original_storage_path,
    p_original_filename,
    p_original_mime_type,
    p_source_url,
    coalesce(p_raw_markdown, ''),
    p_raw_markdown_checksum,
    coalesce(p_conversion_provenance, '{}'::jsonb),
    v_user_id
  )
  returning id into v_version_id;

  return jsonb_build_object(
    'workspaceId', v_workspace_id,
    'documentId', v_document_id,
    'documentVersionId', v_version_id,
    'versionNumber', v_version_number
  );
end;
$$;

create or replace function public.persist_canonical_version(
  p_document_version_id uuid,
  p_canonical_markdown text,
  p_canonical_content_checksum text,
  p_sections_checksum text,
  p_model text,
  p_prompt_version text,
  p_parser_version text,
  p_generator_settings jsonb,
  p_provenance jsonb,
  p_metadata jsonb,
  p_expected_section_count integer,
  p_sections jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_version_number integer;
  v_canonical_version_id uuid;
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_document_version_id is null then
    raise exception 'document_version_id required';
  end if;
  if p_expected_section_count < 1 then
    raise exception 'Expected section count must be positive';
  end if;
  if jsonb_typeof(p_sections) <> 'array' then
    raise exception 'Sections payload must be an array';
  end if;
  if nullif(btrim(coalesce(p_canonical_content_checksum, '')), '') is null then
    raise exception 'canonical_content_checksum required';
  end if;
  if nullif(btrim(coalesce(p_sections_checksum, '')), '') is null then
    raise exception 'sections_checksum required';
  end if;

  v_input_count := jsonb_array_length(p_sections);
  if v_input_count <> p_expected_section_count then
    raise exception 'Expected % sections, received %',
      p_expected_section_count, v_input_count;
  end if;

  select d.workspace_id
  into v_workspace_id
  from public.document_versions dv
  join public.documents d on d.id = dv.document_id
  where dv.id = p_document_version_id
    and dv.deleted_at is null
    and d.deleted_at is null;

  if v_workspace_id is null then
    raise exception 'Document version not found';
  end if;
  if not (select private.can_edit_workspace(v_workspace_id)) then
    raise exception 'Workspace editor access required';
  end if;

  select coalesce(max(cv.version_number), 0) + 1
  into v_version_number
  from public.canonical_versions cv
  where cv.document_version_id = p_document_version_id;

  insert into public.canonical_versions (
    document_version_id,
    version_number,
    status,
    canonical_markdown,
    canonical_content_checksum,
    sections_checksum,
    model,
    prompt_version,
    parser_version,
    generator_settings,
    provenance,
    metadata,
    created_by
  )
  values (
    p_document_version_id,
    v_version_number,
    'completed',
    coalesce(p_canonical_markdown, ''),
    lower(p_canonical_content_checksum),
    lower(p_sections_checksum),
    p_model,
    p_prompt_version,
    p_parser_version,
    coalesce(p_generator_settings, '{}'::jsonb),
    coalesce(p_provenance, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    v_user_id
  )
  returning id into v_canonical_version_id;

  insert into public.canonical_version_sections (
    canonical_version_id,
    ordinal,
    section_key,
    heading,
    body_markdown,
    section_type,
    checksum
  )
  select
    v_canonical_version_id,
    section.ordinal,
    section.section_key,
    section.heading,
    coalesce(section.body_markdown, ''),
    section.section_type,
    section.checksum
  from jsonb_to_recordset(p_sections) as section(
    ordinal integer,
    section_key text,
    heading text,
    body_markdown text,
    section_type text,
    checksum text
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_section_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_section_count, v_inserted_count;
  end if;

  return jsonb_build_object(
    'canonicalVersionId', v_canonical_version_id,
    'versionNumber', v_version_number,
    'sectionCount', v_inserted_count
  );
end;
$$;

create or replace function public.create_learning_output(
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_generation_provenance jsonb,
  p_snapshots jsonb,
  p_expected_item_count integer,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bridge_id uuid;
  v_output_id uuid;
  v_snapshot_count integer;
  v_inserted_snapshots integer;
  v_item_count integer;
  v_inserted_items integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_workspace_id is null then
    raise exception 'workspace_id required';
  end if;
  if p_kind is null or p_kind not in ('quiz', 'flashcards') then
    raise exception 'kind must be quiz or flashcards';
  end if;
  if nullif(btrim(coalesce(p_title, '')), '') is null then
    raise exception 'title required';
  end if;
  if not (select private.can_edit_workspace(p_workspace_id)) then
    raise exception 'Workspace editor access required';
  end if;
  if p_expected_item_count < 1 then
    raise exception 'Expected item count must be positive';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items payload must be an array';
  end if;
  if jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'Snapshots payload must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count <> p_expected_item_count then
    raise exception 'Expected % items, received %',
      p_expected_item_count, v_item_count;
  end if;

  v_snapshot_count := jsonb_array_length(p_snapshots);
  if v_snapshot_count < 1 then
    raise exception 'At least one source snapshot required';
  end if;

  if p_kind = 'quiz' then
    if exists (
      select 1
      from jsonb_array_elements(p_items) as elem
      where elem->>'prompt' is null
         or elem->'choices' is null
         or elem->>'correct_index' is null
         or elem->>'front' is not null
         or elem->>'back' is not null
    ) then
      raise exception 'Quiz items must not mix flashcard fields';
    end if;
  else
    if exists (
      select 1
      from jsonb_array_elements(p_items) as elem
      where elem->>'front' is null
         or elem->>'back' is null
         or elem->>'prompt' is not null
         or elem->'choices' is not null
    ) then
      raise exception 'Flashcard items must not mix quiz fields';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshots) as snap
    where snap->>'canonical_version_id' is not null
      and not exists (
        select 1
        from public.canonical_versions cv
        join public.document_versions dv on dv.id = cv.document_version_id
        join public.documents d on d.id = dv.document_id
        where cv.id = (snap->>'canonical_version_id')::uuid
          and cv.status = 'completed'
          and cv.deleted_at is null
          and dv.deleted_at is null
          and d.deleted_at is null
          and d.workspace_id = p_workspace_id
      )
  ) then
    raise exception 'Snapshot canonical_version_id must be a completed version in workspace';
  end if;

  insert into public.study_sets (
    user_id,
    title,
    pipeline_stage,
    content_kind
  )
  values (
    v_user_id,
    p_title,
    case when p_kind = 'quiz' then 'quiz' else 'flashcards' end,
    p_kind
  )
  returning id into v_bridge_id;

  insert into public.learning_outputs (
    workspace_id,
    legacy_study_set_id,
    legacy_parent_study_set_id,
    kind,
    title,
    status,
    generation_provenance,
    created_by
  )
  values (
    p_workspace_id,
    v_bridge_id,
    null,
    p_kind,
    p_title,
    'ready',
    coalesce(p_generation_provenance, '{}'::jsonb),
    v_user_id
  )
  returning id into v_output_id;

  insert into public.output_source_snapshots (
    output_id,
    canonical_version_id,
    ordinal,
    canonical_content_checksum,
    sections_checksum,
    canonical_markdown,
    sections,
    canonical_metadata,
    source_provenance
  )
  select
    v_output_id,
    snap.canonical_version_id,
    coalesce(snap.ordinal, ord.ordinal::integer),
    snap.canonical_content_checksum,
    snap.sections_checksum,
    coalesce(snap.canonical_markdown, ''),
    coalesce(snap.sections, '[]'::jsonb),
    coalesce(snap.canonical_metadata, '{}'::jsonb),
    coalesce(snap.source_provenance, '{}'::jsonb)
  from jsonb_array_elements(p_snapshots) with ordinality as ord(value, ordinal)
  cross join lateral jsonb_to_record(ord.value) as snap(
    canonical_version_id uuid,
    ordinal integer,
    canonical_content_checksum text,
    sections_checksum text,
    canonical_markdown text,
    sections jsonb,
    canonical_metadata jsonb,
    source_provenance jsonb
  );

  get diagnostics v_inserted_snapshots = row_count;
  if v_inserted_snapshots <> v_snapshot_count then
    raise exception 'Expected to insert % snapshots, inserted %',
      v_snapshot_count, v_inserted_snapshots;
  end if;

  if p_kind = 'quiz' then
    insert into public.approved_questions (
      id,
      user_id,
      study_set_id,
      output_id,
      prompt,
      choices,
      correct_index,
      explanation,
      tags,
      source
    )
    select
      coalesce(q.id, gen_random_uuid()),
      v_user_id,
      v_bridge_id,
      v_output_id,
      q.prompt,
      q.choices,
      q.correct_index,
      q.explanation,
      coalesce(q.tags, '{}'::text[]),
      coalesce(q.source, '{}'::jsonb)
    from jsonb_to_recordset(p_items) as q(
      id uuid,
      prompt text,
      choices text[],
      correct_index smallint,
      explanation text,
      tags text[],
      source jsonb
    );
  else
    insert into public.approved_flashcards (
      id,
      user_id,
      study_set_id,
      output_id,
      front,
      back,
      tags,
      source
    )
    select
      coalesce(c.id, gen_random_uuid()),
      v_user_id,
      v_bridge_id,
      v_output_id,
      c.front,
      c.back,
      coalesce(c.tags, '{}'::text[]),
      coalesce(c.source, '{}'::jsonb)
    from jsonb_to_recordset(p_items) as c(
      id uuid,
      front text,
      back text,
      tags text[],
      source jsonb
    );
  end if;

  get diagnostics v_inserted_items = row_count;
  if v_inserted_items <> p_expected_item_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_item_count, v_inserted_items;
  end if;

  return jsonb_build_object(
    'outputId', v_output_id,
    'bridgeStudySetId', v_bridge_id,
    'legacyParentStudySetId', null,
    'kind', p_kind,
    'itemCount', v_inserted_items,
    'snapshotCount', v_inserted_snapshots
  );
end;
$$;

commit;
