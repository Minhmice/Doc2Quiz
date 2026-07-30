-- Phase 10 workspace authorization matrix.
-- Run: supabase db reset && supabase test db --file supabase/tests/phase10_workspace_authorization.sql

\set ON_ERROR_STOP on

begin;

\ir fixtures/phase10_workspace_roles.sql

-- -------------------------------------------------------------------------
-- Helper hardening
-- -------------------------------------------------------------------------

select pg_temp.phase10_assert_true(
  (
    select not has_function_privilege('anon', 'private.workspace_role(uuid)', 'execute')
       and has_function_privilege('authenticated', 'private.workspace_role(uuid)', 'execute')
       and not has_function_privilege('anon', 'private.can_view_workspace(uuid)', 'execute')
       and has_function_privilege('authenticated', 'private.can_view_workspace(uuid)', 'execute')
       and not has_function_privilege('anon', 'private.can_edit_workspace(uuid)', 'execute')
       and has_function_privilege('authenticated', 'private.can_edit_workspace(uuid)', 'execute')
       and not has_function_privilege('anon', 'private.is_workspace_owner(uuid)', 'execute')
       and has_function_privilege('authenticated', 'private.is_workspace_owner(uuid)', 'execute')
  ),
  'phase10 helpers revoked from anon and granted to authenticated'
);

select pg_temp.phase10_assert_true(
  (
    select prosecdef and proconfig::text like '%search_path%'
    from pg_proc
    where oid = 'private.workspace_role(uuid)'::regprocedure
  ),
  'workspace_role is security definer with fixed search_path'
);

reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.phase10_assert_true(
  private.can_view_workspace((select workspace_id from phase10_fixture)) is false,
  'auth-null can_view_workspace denies'
);

-- No anon SELECT policies on private workspace tables
select pg_temp.phase10_assert_true(
  (
    select count(*) = 0
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspaces', 'workspace_members', 'documents', 'document_versions',
        'canonical_versions', 'canonical_version_sections', 'learning_outputs',
        'output_source_snapshots', 'approved_questions', 'approved_flashcards'
      )
      and 'anon' = any (roles)
      and cmd = 'SELECT'
  ),
  'no anon select policies on private workspace tables'
);

-- -------------------------------------------------------------------------
-- Owner matrix
-- -------------------------------------------------------------------------

select pg_temp.phase10_as_user(owner_id) from phase10_fixture;

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.workspaces w join phase10_fixture f on w.id = f.workspace_id),
  'owner can select workspace'
);

update public.workspaces set title = 'Owner Updated'
where id = (select workspace_id from phase10_fixture);

select pg_temp.phase10_assert_true(
  (select title = 'Owner Updated' from public.workspaces where id = (select workspace_id from phase10_fixture)),
  'owner can update workspace'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.approved_questions aq
    join phase10_fixture f on aq.id = f.quiz_item_id),
  'owner can select workspace quiz items'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from storage.objects o
    join phase10_fixture f on o.id = f.storage_object_id),
  'owner can select workspace storage object'
);

-- -------------------------------------------------------------------------
-- Editor matrix
-- -------------------------------------------------------------------------

select pg_temp.phase10_as_user(editor_id) from phase10_fixture;

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.learning_outputs lo join phase10_fixture f on lo.workspace_id = f.workspace_id),
  'editor can select learning_outputs'
);

insert into public.documents (workspace_id, title)
select workspace_id, 'Editor Added Doc' from phase10_fixture;

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.documents d
    join phase10_fixture f on d.workspace_id = f.workspace_id
   where d.title = 'Editor Added Doc'),
  'editor can insert documents'
);

update public.approved_questions
set explanation = 'Editor edit'
where id = (select quiz_item_id from phase10_fixture);

select pg_temp.phase10_assert_true(
  (select explanation = 'Editor edit' from public.approved_questions
    where id = (select quiz_item_id from phase10_fixture)),
  'editor can update workspace quiz items'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from storage.objects o
    join phase10_fixture f on o.id = f.storage_object_id),
  'editor can select workspace storage object'
);

do $$
declare
  updated integer;
begin
  update public.workspaces set title = 'Editor Hijack'
  where id = (select workspace_id from phase10_fixture);
  get diagnostics updated = row_count;
  perform pg_temp.phase10_assert_true(updated = 0, 'editor cannot update workspace metadata');
end;
$$;

-- Collaborator cannot write another user's personal history
do $$
declare
  inserted integer := 0;
begin
  begin
    insert into public.quiz_sessions (id, user_id, study_set_id, total_questions, correct_count)
    select
      'c6000000-0000-0000-0000-000000000099',
      (select owner_id from phase10_fixture),
      parent_study_set_id,
      1,
      0
    from phase10_fixture;
    get diagnostics inserted = row_count;
  exception when others then
    inserted := 0;
  end;
  perform pg_temp.phase10_assert_true(inserted = 0, 'editor cannot insert owner quiz_sessions');
end;
$$;

do $$
declare
  updated integer := 0;
begin
  begin
    update public.study_sessions
    set revision = revision + 1
    where id = (select study_session_id from phase10_fixture);
    get diagnostics updated = row_count;
  exception when others then
    updated := 0;
  end;
  perform pg_temp.phase10_assert_true(updated = 0, 'editor cannot update owner study_sessions');
end;
$$;

-- -------------------------------------------------------------------------
-- Viewer matrix
-- -------------------------------------------------------------------------

select pg_temp.phase10_as_user(viewer_id) from phase10_fixture;

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.output_source_snapshots oss
    join phase10_fixture f on oss.output_id = f.quiz_output_id),
  'viewer can select output snapshots'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from public.approved_flashcards af
    join phase10_fixture f on af.id = f.flashcard_item_id),
  'viewer can select workspace flashcard items'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 1 from storage.objects o
    join phase10_fixture f on o.id = f.storage_object_id),
  'viewer can select workspace storage object'
);

do $$
declare
  inserted integer := 0;
  updated integer := 0;
begin
  begin
    insert into public.documents (workspace_id, title)
    select workspace_id, 'Viewer Doc' from phase10_fixture;
    get diagnostics inserted = row_count;
  exception when others then
    inserted := 0;
  end;
  perform pg_temp.phase10_assert_true(inserted = 0, 'viewer cannot insert documents');

  begin
    update public.approved_questions
    set explanation = 'Viewer edit'
    where id = (select quiz_item_id from phase10_fixture);
    get diagnostics updated = row_count;
  exception when others then
    updated := 0;
  end;
  perform pg_temp.phase10_assert_true(updated = 0, 'viewer cannot update quiz items');
end;
$$;

-- -------------------------------------------------------------------------
-- Outsider matrix
-- -------------------------------------------------------------------------

select pg_temp.phase10_as_user(outsider_id) from phase10_fixture;

select pg_temp.phase10_assert_true(
  (select count(*) = 0 from public.workspaces w join phase10_fixture f on w.id = f.workspace_id),
  'outsider cannot select workspace'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 0 from public.approved_questions aq
    join phase10_fixture f on aq.id = f.quiz_item_id),
  'outsider cannot select workspace quiz items'
);

select pg_temp.phase10_assert_true(
  (select count(*) = 0 from storage.objects o
    join phase10_fixture f on o.id = f.storage_object_id),
  'outsider cannot select workspace storage object'
);

select pg_temp.phase10_assert_true(
  (
    select count(*) = 0
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from phase10_fixture),
      'quiz'
    )
  ),
  'outsider cannot resolve learning output bridge'
);

-- -------------------------------------------------------------------------
-- Membership mutation blocked
-- -------------------------------------------------------------------------

do $$
declare
  mutated integer := 0;
begin
  select pg_temp.phase10_as_user(outsider_id) from phase10_fixture;
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    select workspace_id, outsider_id, 'editor' from phase10_fixture;
    get diagnostics mutated = row_count;
  exception when others then
    mutated := 0;
  end;
  perform pg_temp.phase10_assert_true(mutated = 0, 'outsider cannot insert membership');

  select pg_temp.phase10_as_user(editor_id) from phase10_fixture;
  mutated := 0;
  begin
    update public.workspace_members
    set role = 'owner'
    where workspace_id = (select workspace_id from phase10_fixture)
      and user_id = (select viewer_id from phase10_fixture);
    get diagnostics mutated = row_count;
  exception when others then
    mutated := 0;
  end;
  perform pg_temp.phase10_assert_true(mutated = 0, 'editor cannot escalate membership role');
end;
$$;

-- -------------------------------------------------------------------------
-- RPC outcomes
-- -------------------------------------------------------------------------

select pg_temp.phase10_as_user(editor_id) from phase10_fixture;

select pg_temp.phase10_assert_true(
  (
    select (created->>'versionNumber')::integer = 2
    from (
      select public.create_workspace_document_version(
        (select workspace_id from phase10_fixture),
        (select document_id from phase10_fixture),
        null,
        'RPC Doc',
        'paste',
        null,
        null,
        null,
        null,
        '# raw 2',
        private.sha256_utf8_hex('# raw 2'),
        '{"via":"phase10-test"}'::jsonb
      ) as created
    ) rpc
  ),
  'editor can append document version via RPC'
);

select pg_temp.phase10_as_user(viewer_id) from phase10_fixture;

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.create_workspace_document_version(
      (select workspace_id from phase10_fixture),
      (select document_id from phase10_fixture),
      null,
      'Denied',
      'paste',
      null, null, null, null,
      '# denied',
      private.sha256_utf8_hex('# denied'),
      '{}'::jsonb
    );
  exception when others then
    failed := true;
  end;
  perform pg_temp.phase10_assert_true(failed, 'viewer cannot append document version via RPC');
end;
$$;

rollback;
