create or replace function public.replace_canonical_content(
  p_study_set_id uuid,
  p_canonical_markdown text,
  p_metadata jsonb,
  p_title text,
  p_expected_section_count integer,
  p_sections jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document_id uuid;
  v_input_count integer;
  v_inserted_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_expected_section_count < 1 then
    raise exception 'Expected section count must be positive';
  end if;
  if jsonb_typeof(p_sections) <> 'array' then
    raise exception 'Sections payload must be an array';
  end if;

  v_input_count := jsonb_array_length(p_sections);
  if v_input_count <> p_expected_section_count then
    raise exception 'Expected % sections, received %',
      p_expected_section_count, v_input_count;
  end if;

  update public.canonical_documents
  set canonical_markdown = p_canonical_markdown,
      metadata = p_metadata
  where study_set_id = p_study_set_id
    and user_id = v_user_id
  returning id into v_document_id;

  if v_document_id is null then
    raise exception 'Canonical document not found';
  end if;

  delete from public.canonical_sections
  where canonical_document_id = v_document_id
    and user_id = v_user_id;

  insert into public.canonical_sections (
    user_id,
    canonical_document_id,
    ordinal,
    heading,
    body_markdown,
    section_type,
    section_key
  )
  select
    v_user_id,
    v_document_id,
    section.ordinal,
    section.heading,
    section.body_markdown,
    section.section_type,
    section.section_key
  from jsonb_to_recordset(p_sections) as section(
    ordinal integer,
    heading text,
    body_markdown text,
    section_type text,
    section_key text
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> p_expected_section_count then
    raise exception 'Expected to insert %, inserted %',
      p_expected_section_count, v_inserted_count;
  end if;

  update public.study_sets
  set pipeline_stage = 'canonical',
      title = p_title
  where id = p_study_set_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Study set update failed';
  end if;

  return v_inserted_count;
end;
$$;

revoke all on function public.replace_canonical_content(
  uuid, text, jsonb, text, integer, jsonb
) from public;
grant execute on function public.replace_canonical_content(
  uuid, text, jsonb, text, integer, jsonb
) to authenticated;
