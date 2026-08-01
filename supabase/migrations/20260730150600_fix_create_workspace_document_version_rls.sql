-- First-ingest bootstrap inserts workspaces, workspace_members, documents, and
-- document_versions in one RPC. security invoker cannot satisfy RLS on the
-- bootstrap path (workspaces insert policy + member/document policies).
-- Match collaboration RPCs: security definer with explicit auth + role checks.

begin;

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
security definer
set search_path = public, private
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

revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from public;
revoke all on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) from anon;
grant execute on function public.create_workspace_document_version(
  uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

commit;
