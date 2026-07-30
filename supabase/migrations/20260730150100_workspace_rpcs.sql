-- Phase 9 atomic append-only workspace RPCs.
-- Timestamp 20260730150100 (plan asked 140100 — paired with foundation 150000).

begin;

-- Native outputs have no historic parent; backfill rows keep immutable parent ids.
alter table public.learning_outputs
  alter column legacy_parent_study_set_id drop not null;

alter table public.learning_outputs
  drop constraint if exists learning_outputs_bridge_ne_parent;

alter table public.learning_outputs
  add constraint learning_outputs_bridge_ne_parent check (
    legacy_parent_study_set_id is null
    or legacy_study_set_id <> legacy_parent_study_set_id
  );

-- Narrow bootstrap only: caller may insert themselves as owner on a workspace they own.
-- No editor/viewer self-promotion; no mutating others' memberships.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname = 'workspace_members_insert_own_owner'
  ) then
    create policy workspace_members_insert_own_owner on public.workspace_members
      for insert to authenticated
      with check (
        user_id = (select auth.uid())
        and role = 'owner'
        and exists (
          select 1
          from public.workspaces w
          where w.id = workspace_id
            and w.owner_id = (select auth.uid())
            and w.deleted_at is null
        )
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_workspace_document_version
-- ---------------------------------------------------------------------------

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

  -- First ingest: create workspace + owner membership + document.
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
    if not (select private.can_workspace(v_workspace_id, 'editor')) then
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

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public;
revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from anon;
grant execute on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- persist_canonical_version
-- ---------------------------------------------------------------------------

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
  if not (select private.can_workspace(v_workspace_id, 'editor')) then
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

revoke all on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) from public;
revoke all on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) from anon;
grant execute on function public.persist_canonical_version(
  uuid, text, text, text, text, text, text, jsonb, jsonb, jsonb, integer, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- create_learning_output
-- ---------------------------------------------------------------------------

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
  if not (select private.can_workspace(p_workspace_id, 'editor')) then
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

  -- Reject mixed item shapes: quiz items require prompt/choices; flashcards require front/back.
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

  -- Validate selected completed canonical versions belong to this workspace when provided.
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

  -- Output-specific bridge study set (never reuse a historic parent).
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

revoke all on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) from public;
revoke all on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) from anon;
grant execute on function public.create_learning_output(
  uuid, text, text, jsonb, jsonb, integer, jsonb
) to authenticated;

commit;
