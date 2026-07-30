-- Workspace RLS, backfill, bridge, and resolver assertions.
-- Run after `supabase db reset` (or via `supabase test db`).
-- Uses authenticated JWT claims. Rolls back all fixtures.

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create temp table workspace_test_ids (
  owner_id uuid not null,
  editor_id uuid not null,
  viewer_id uuid not null,
  nonmember_id uuid not null,
  parent_study_set_id uuid not null,
  workspace_id uuid null,
  quiz_bridge_id uuid null,
  flashcards_bridge_id uuid null,
  quiz_output_id uuid null,
  flashcards_output_id uuid null,
  quiz_session_id uuid null,
  quota_id uuid null
) on commit drop;

-- Seed users (bypass RLS as migration/superuser role).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws-owner@example.com', crypt('pw', gen_salt('bf')), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws-editor@example.com', crypt('pw', gen_salt('bf')), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws-viewer@example.com', crypt('pw', gen_salt('bf')), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ws-nonmember@example.com', crypt('pw', gen_salt('bf')), now());

insert into public.study_sets (id, user_id, title, pipeline_stage, content_kind)
values (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Dual Mode Parent',
  'quiz',
  'quiz'
);

insert into public.canonical_documents (
  id, user_id, study_set_id, raw_markdown, canonical_markdown, metadata, original_filename
)
values (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '# Raw',
  '# Canonical' || E'\n\n' || 'Body',
  '{"lang":"en"}'::jsonb,
  'notes.md'
);

insert into public.canonical_sections (
  user_id, canonical_document_id, ordinal, heading, body_markdown, section_type, section_key
)
values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'One', 'Body one', 'section', 'sec_001'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2, 'Two', 'Body two', 'section', 'sec_002');

insert into public.approved_questions (
  id, user_id, study_set_id, prompt, choices, correct_index, explanation
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Q1?',
  array['A','B','C','D'],
  0,
  'Because'
);

insert into public.approved_flashcards (
  id, user_id, study_set_id, front, back
)
values (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Front',
  'Back'
);

-- Historic parent-keyed records (must remain unchanged after backfill).
insert into public.quiz_sessions (
  id, user_id, study_set_id, total_questions, correct_count
)
values (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  1,
  1
);

insert into public.study_wrong_history (user_id, study_set_id, question_ids)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  array['d0000000-0000-0000-0000-000000000001']::uuid[]
);

insert into public.quota_consumptions (
  id, user_id, study_set_id, content_kind, state, consumed_at, committed_at
)
values (
  'g0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'quiz',
  'committed',
  now(),
  now()
);

insert into public.study_sessions (
  id, user_id, study_set_id, mode, item_ids
)
values (
  'h0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'quiz',
  array['d0000000-0000-0000-0000-000000000001']::uuid[]
);

insert into public.study_mistakes (
  user_id, study_set_id, item_id, mode
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'quiz'
);

insert into workspace_test_ids (
  owner_id, editor_id, viewer_id, nonmember_id, parent_study_set_id,
  quiz_session_id, quota_id
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'g0000000-0000-0000-0000-000000000001'
);

-- Backfill as privileged role (function is security definer / service_role).
select private.backfill_legacy_study_set(parent_study_set_id)
from workspace_test_ids;

update workspace_test_ids t
set workspace_id = lo.workspace_id,
    quiz_bridge_id = quiz.legacy_study_set_id,
    flashcards_bridge_id = cards.legacy_study_set_id,
    quiz_output_id = quiz.id,
    flashcards_output_id = cards.id
from public.learning_outputs quiz
join public.learning_outputs cards
  on cards.legacy_parent_study_set_id = quiz.legacy_parent_study_set_id
 and cards.kind = 'flashcards'
where quiz.legacy_parent_study_set_id = t.parent_study_set_id
  and quiz.kind = 'quiz';

-- Seed editor/viewer memberships (no client mutation policies; privileged seed only).
insert into public.workspace_members (workspace_id, user_id, role)
select workspace_id, editor_id, 'editor' from workspace_test_ids;
insert into public.workspace_members (workspace_id, user_id, role)
select workspace_id, viewer_id, 'viewer' from workspace_test_ids;

-- -------------------------------------------------------------------------
-- Dual-mode split / cardinality / section parity / snapshot coverage
-- -------------------------------------------------------------------------

select pg_temp.assert_true(
  (select count(*) = 2 from public.learning_outputs lo
    join workspace_test_ids t on lo.legacy_parent_study_set_id = t.parent_study_set_id),
  'dual-mode yields exactly two learning_outputs'
);

select pg_temp.assert_true(
  (select quiz_bridge_id is distinct from parent_study_set_id
      and flashcards_bridge_id is distinct from parent_study_set_id
      and quiz_bridge_id is distinct from flashcards_bridge_id
   from workspace_test_ids),
  'bridges are distinct from parent and each other'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.approved_questions aq
    join workspace_test_ids t on aq.study_set_id = t.quiz_bridge_id and aq.output_id = t.quiz_output_id),
  'quiz items reassigned to quiz bridge + output_id'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.approved_flashcards af
    join workspace_test_ids t on af.study_set_id = t.flashcards_bridge_id and af.output_id = t.flashcards_output_id),
  'flashcard items reassigned to flashcards bridge + output_id'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.approved_questions aq
    where aq.study_set_id = (select parent_study_set_id from workspace_test_ids)),
  'parent no longer holds quiz items'
);

select pg_temp.assert_true(
  (
    select count(*) = 2
    from public.canonical_version_sections cvs
    join public.canonical_versions cv on cv.id = cvs.canonical_version_id
    join public.document_versions dv on dv.id = cv.document_version_id
    where dv.conversion_provenance ->> 'study_set_id' =
      (select parent_study_set_id::text from workspace_test_ids)
  ),
  'canonical_version_sections parity with legacy sections'
);

select pg_temp.assert_true(
  (select count(*) = 2 from public.output_source_snapshots oss
    join workspace_test_ids t on oss.output_id in (t.quiz_output_id, t.flashcards_output_id)
    where oss.canonical_version_id is not null
       or coalesce(oss.source_provenance ->> 'migration_exception', '') = 'true'),
  'each migrated output has frozen snapshot or explicit provenance exception'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.workspaces w
    join workspace_test_ids t on w.id = t.workspace_id),
  'backfill creates exactly one workspace per legacy parent'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.workspace_members wm
    join workspace_test_ids t on wm.workspace_id = t.workspace_id and wm.role = 'owner'),
  'backfill creates exactly one owner membership'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.documents d
    join workspace_test_ids t on d.workspace_id = t.workspace_id and d.deleted_at is null),
  'backfill creates exactly one active document'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    join workspace_test_ids t on d.workspace_id = t.workspace_id
   where dv.deleted_at is null),
  'backfill creates exactly one active document version'
);

select pg_temp.assert_true(
  (select count(distinct lo.legacy_parent_study_set_id) = 1
      and min(lo.legacy_parent_study_set_id) = (select parent_study_set_id from workspace_test_ids)
   from public.learning_outputs lo
   join workspace_test_ids t on lo.legacy_parent_study_set_id = t.parent_study_set_id),
  'both derived outputs share immutable legacy_parent_study_set_id'
);

-- -------------------------------------------------------------------------
-- History unchanged on parent (no duplication / rekey)
-- -------------------------------------------------------------------------

select pg_temp.assert_true(
  (select count(*) = 1 and min(study_set_id) = (select parent_study_set_id from workspace_test_ids)
      and min(total_questions) = 1 and min(correct_count) = 1
   from public.quiz_sessions where id = (select quiz_session_id from workspace_test_ids)),
  'quiz_sessions remain parent-keyed with unchanged payload'
);

select pg_temp.assert_true(
  (select count(*) = 1
      and min(question_ids) = array['d0000000-0000-0000-0000-000000000001']::uuid[]
   from public.study_wrong_history
    where study_set_id = (select parent_study_set_id from workspace_test_ids)),
  'study_wrong_history remain parent-keyed with unchanged payload'
);

select pg_temp.assert_true(
  (select count(*) = 1 and min(study_set_id) = (select parent_study_set_id from workspace_test_ids)
      and min(content_kind) = 'quiz' and min(state) = 'committed'
   from public.quota_consumptions where id = (select quota_id from workspace_test_ids)),
  'quota_consumptions remain parent-keyed with unchanged payload'
);

select pg_temp.assert_true(
  (select count(*) = 1 and min(mode) = 'quiz'
      and min(item_ids) = array['d0000000-0000-0000-0000-000000000001']::uuid[]
   from public.study_sessions
    where study_set_id = (select parent_study_set_id from workspace_test_ids)),
  'study_sessions remain parent-keyed with unchanged payload'
);

select pg_temp.assert_true(
  (select count(*) = 1 and min(mode) = 'quiz'
      and min(item_id) = 'd0000000-0000-0000-0000-000000000001'::uuid
   from public.study_mistakes
    where study_set_id = (select parent_study_set_id from workspace_test_ids)),
  'study_mistakes remain parent-keyed with unchanged payload'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.quiz_sessions qs
    join workspace_test_ids t on qs.study_set_id in (t.quiz_bridge_id, t.flashcards_bridge_id)),
  'no duplicated quiz_sessions on bridges'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.quota_consumptions qc
    join workspace_test_ids t on qc.study_set_id in (t.quiz_bridge_id, t.flashcards_bridge_id)),
  'no duplicated quota_consumptions on bridges'
);

-- -------------------------------------------------------------------------
-- Hardened helper grants / auth-null
-- -------------------------------------------------------------------------

select pg_temp.assert_true(
  (
    select not has_function_privilege('anon', 'private.can_workspace(uuid, text)', 'execute')
       and has_function_privilege('authenticated', 'private.can_workspace(uuid, text)', 'execute')
  ),
  'can_workspace execute revoked from anon, granted authenticated'
);

select pg_temp.assert_true(
  (
    select prosecdef and proconfig::text like '%search_path%'
    from pg_proc
    where oid = 'private.can_workspace(uuid, text)'::regprocedure
  ),
  'can_workspace is security definer with fixed search_path'
);

reset role;
select set_config('request.jwt.claims', '', true);

select pg_temp.assert_true(
  private.can_workspace((select workspace_id from workspace_test_ids), 'viewer') is false,
  'auth-null can_workspace denies'
);

-- -------------------------------------------------------------------------
-- Role matrix
-- -------------------------------------------------------------------------

create or replace function pg_temp.as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- Owner read/write
select pg_temp.as_user(owner_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 1 from public.workspaces w
    join workspace_test_ids t on w.id = t.workspace_id),
  'owner can select workspace'
);
update public.workspaces set title = 'Owner Renamed'
where id = (select workspace_id from workspace_test_ids);
select pg_temp.assert_true(
  (select title = 'Owner Renamed' from public.workspaces
    where id = (select workspace_id from workspace_test_ids)),
  'owner can update workspace'
);

-- Editor read + document mutate; cannot update workspace (owner-only)
select pg_temp.as_user(editor_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 1 from public.workspaces w
    join workspace_test_ids t on w.id = t.workspace_id),
  'editor can select workspace'
);
insert into public.documents (workspace_id, title)
select workspace_id, 'Editor Doc' from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 1 from public.documents d
    join workspace_test_ids t on d.workspace_id = t.workspace_id
   where d.title = 'Editor Doc'),
  'editor can insert documents'
);

do $$
declare
  updated integer;
begin
  update public.workspaces set title = 'Editor Hijack'
  where id = (select workspace_id from workspace_test_ids);
  get diagnostics updated = row_count;
  perform pg_temp.assert_true(updated = 0, 'editor cannot update workspace (owner-only)');
end;
$$;

-- Viewer read-only
select pg_temp.as_user(viewer_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 1 from public.learning_outputs lo
    join workspace_test_ids t on lo.workspace_id = t.workspace_id),
  'viewer can select learning_outputs'
);

do $$
declare
  inserted integer := 0;
begin
  begin
    insert into public.documents (workspace_id, title)
    select workspace_id, 'Viewer Doc' from workspace_test_ids;
    get diagnostics inserted = row_count;
  exception
    when insufficient_privilege or check_violation or others then
      inserted := 0;
  end;
  perform pg_temp.assert_true(inserted = 0, 'viewer cannot insert documents');
end;
$$;

-- Nonmember denied
select pg_temp.as_user(nonmember_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 0 from public.workspaces w
    join workspace_test_ids t on w.id = t.workspace_id),
  'nonmember cannot select workspace'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.learning_outputs lo
    join workspace_test_ids t on lo.id in (t.quiz_output_id, t.flashcards_output_id)),
  'nonmember cannot select outputs'
);

-- No direct membership mutation for authenticated clients
do $$
declare
  mutated integer := 0;
begin
  begin
    insert into public.workspace_members (workspace_id, user_id, role)
    select workspace_id, nonmember_id, 'owner' from workspace_test_ids;
    get diagnostics mutated = row_count;
  exception when others then
    mutated := 0;
  end;
  perform pg_temp.assert_true(mutated = 0, 'authenticated cannot insert membership');
end;
$$;

do $$
declare
  mutated integer := 0;
begin
  begin
    update public.workspace_members
    set role = 'owner'
    where workspace_id = (select workspace_id from workspace_test_ids)
      and user_id = (select viewer_id from workspace_test_ids);
    get diagnostics mutated = row_count;
  exception when others then
    mutated := 0;
  end;
  perform pg_temp.assert_true(mutated = 0, 'authenticated cannot escalate membership role');
end;
$$;

-- -------------------------------------------------------------------------
-- Resolver: parent kind match, bridge no-fallback, auth denial
-- -------------------------------------------------------------------------

select pg_temp.as_user(owner_id) from workspace_test_ids;

select pg_temp.assert_true(
  (
    select resolution_mode = 'parent'
       and kind = 'quiz'
       and history_study_set_id = parent_study_set_id
       and bridge_study_set_id = quiz_bridge_id
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'quiz'
    )
    cross join workspace_test_ids
    limit 1
  ),
  'parent+quiz resolves quiz child with parent history id'
);

select pg_temp.assert_true(
  (
    select resolution_mode = 'parent'
       and kind = 'flashcards'
       and history_study_set_id = parent_study_set_id
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'flashcards'
    )
    cross join workspace_test_ids
    limit 1
  ),
  'parent+flashcards resolves flashcards child with parent history id'
);

select pg_temp.assert_true(
  (
    select resolution_mode = 'bridge'
       and history_study_set_id = quiz_bridge_id
       and history_study_set_id is distinct from parent_study_set_id
    from public.resolve_learning_output_bridge(
      (select quiz_bridge_id from workspace_test_ids),
      'quiz'
    )
    cross join workspace_test_ids
    limit 1
  ),
  'bridge resolve uses bridge history with no parent fallback'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'flashcards'
    ) r
    cross join workspace_test_ids t
    where r.kind = 'quiz'
  ),
  'parent+flashcards does not resolve quiz child'
);

select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'quiz'
    ) r
    cross join workspace_test_ids t
    where r.kind = 'flashcards'
  ),
  'parent+quiz does not resolve flashcards child'
);

select pg_temp.assert_true(
  (
    select r.history_study_set_id = t.parent_study_set_id
       and (
         select count(*) from public.quiz_sessions qs
         where qs.study_set_id = r.history_study_set_id
       ) = 1
       and (
         select count(*) from public.quiz_sessions qs
         where qs.study_set_id = r.bridge_study_set_id
       ) = 0
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'quiz'
    ) r
    cross join workspace_test_ids t
    limit 1
  ),
  'parent-resolution exposes parent-keyed historic records only'
);

select pg_temp.assert_true(
  (
    select r.history_study_set_id = t.quiz_bridge_id
       and r.history_study_set_id is distinct from t.parent_study_set_id
       and (
         select count(*) from public.quiz_sessions qs
         where qs.study_set_id = r.history_study_set_id
       ) = 0
       and (
         select count(*) from public.quiz_sessions qs
         where qs.study_set_id = t.parent_study_set_id
       ) = 1
    from public.resolve_learning_output_bridge(
      (select quiz_bridge_id from workspace_test_ids),
      'quiz'
    ) r
    cross join workspace_test_ids t
    limit 1
  ),
  'bridge resolutions return no parent historic records'
);

select pg_temp.as_user(nonmember_id) from workspace_test_ids;
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.resolve_learning_output_bridge(
      (select parent_study_set_id from workspace_test_ids),
      'quiz'
    )
  ),
  'nonmember cannot resolve parent'
);
select pg_temp.assert_true(
  (
    select count(*) = 0
    from public.resolve_learning_output_bridge(
      (select quiz_bridge_id from workspace_test_ids),
      'quiz'
    )
  ),
  'nonmember cannot resolve bridge'
);

-- Legacy canonical_sections table still exists untouched.
select pg_temp.assert_true(
  (select to_regclass('public.canonical_sections') is not null),
  'legacy canonical_sections retained'
);
select pg_temp.assert_true(
  (select to_regclass('public.canonical_version_sections') is not null),
  'canonical_version_sections created'
);

-- -------------------------------------------------------------------------
-- Atomic RPCs: append-only persist + create_learning_output rollback
-- -------------------------------------------------------------------------

select pg_temp.as_user(owner_id) from workspace_test_ids;

do $$
declare
  doc_version_id uuid;
  persist_result jsonb;
  created jsonb;
  before_outputs integer;
  before_bridges integer;
  before_questions integer;
begin
  select dv.id into doc_version_id
  from public.document_versions dv
  join workspace_test_ids t
    on dv.conversion_provenance ->> 'study_set_id' = t.parent_study_set_id::text
  limit 1;

  persist_result := public.persist_canonical_version(
    doc_version_id,
    '# Canonical v2',
    private.sha256_utf8_hex('# Canonical v2'),
    private.sha256_utf8_hex('[]'),
    'test-model',
    'prompt-1',
    'parser-1',
    '{"temperature":0}'::jsonb,
    '{"mode":"test"}'::jsonb,
    '{}'::jsonb,
    1,
    '[{"ordinal":1,"section_key":"sec_new","heading":"N","body_markdown":"x","section_type":"section"}]'::jsonb
  );
  perform pg_temp.assert_true(
    (persist_result->>'versionNumber')::integer = 2,
    'persist_canonical_version appends version 2'
  );
  perform pg_temp.assert_true(
    (select count(*) = 2 from public.canonical_versions where document_version_id = doc_version_id),
    'canonical versions remain append-only'
  );

  select count(*) into before_outputs from public.learning_outputs;
  select count(*) into before_bridges from public.study_sets;
  select count(*) into before_questions from public.approved_questions;

  begin
    created := public.create_learning_output(
      (select workspace_id from workspace_test_ids),
      'quiz',
      'Native Quiz',
      '{}'::jsonb,
      '[{"ordinal":1,"canonical_markdown":"# snap","sections":[]}]'::jsonb,
      1,
      '[{"prompt":"Q?","choices":["A","B","C","D"],"correct_index":0,"front":"bad"}]'::jsonb
    );
    perform pg_temp.assert_true(false, 'mixed-kind create_learning_output must fail');
  exception
    when others then
      perform pg_temp.assert_true(
        sqlerrm like '%mix%',
        'mixed-kind rejected: ' || sqlerrm
      );
  end;

  perform pg_temp.assert_true(
    (select count(*) = before_outputs from public.learning_outputs),
    'failed create_learning_output rolls back outputs'
  );
  perform pg_temp.assert_true(
    (select count(*) = before_bridges from public.study_sets),
    'failed create_learning_output rolls back bridge study_sets'
  );
  perform pg_temp.assert_true(
    (select count(*) = before_questions from public.approved_questions),
    'failed create_learning_output rolls back items'
  );

  created := public.create_learning_output(
    (select workspace_id from workspace_test_ids),
    'quiz',
    'Native Quiz',
    '{"generator":"test"}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'ordinal', 1,
        'canonical_version_id', (persist_result->>'canonicalVersionId')::uuid,
        'canonical_content_checksum', persist_result->>'canonicalVersionId',
        'sections_checksum', private.sha256_utf8_hex('[]'),
        'canonical_markdown', '# Canonical v2',
        'sections', '[]'::jsonb,
        'canonical_metadata', '{}'::jsonb,
        'source_provenance', '{}'::jsonb
      )
    ),
    1,
    '[{"prompt":"Native Q?","choices":["A","B","C","D"],"correct_index":1,"explanation":"e"}]'::jsonb
  );

  perform pg_temp.assert_true(created ? 'outputId', 'create_learning_output returns outputId');
  perform pg_temp.assert_true(created ? 'bridgeStudySetId', 'create_learning_output returns bridgeStudySetId');
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.approved_questions aq
      where aq.output_id = (created->>'outputId')::uuid
        and aq.study_set_id = (created->>'bridgeStudySetId')::uuid),
    'native items store bridge study_set_id and output_id'
  );
  perform pg_temp.assert_true(
    (select legacy_parent_study_set_id is null from public.learning_outputs
      where id = (created->>'outputId')::uuid),
    'native output has null legacy_parent_study_set_id'
  );

  -- Bridge-keyed new history must never fall back to parent.
  insert into public.quiz_sessions (
    id, user_id, study_set_id, total_questions, correct_count
  )
  values (
    'f0000000-0000-0000-0000-000000000099',
    (select owner_id from workspace_test_ids),
    (created->>'bridgeStudySetId')::uuid,
    2,
    1
  );

  perform pg_temp.assert_true(
    (
      select r.resolution_mode = 'bridge'
         and r.history_study_set_id = (created->>'bridgeStudySetId')::uuid
         and r.history_study_set_id is distinct from t.parent_study_set_id
         and (
           select count(*) from public.quiz_sessions qs
           where qs.study_set_id = r.history_study_set_id
         ) = 1
         and (
           select count(*) from public.quiz_sessions qs
           where qs.study_set_id = t.parent_study_set_id
         ) = 1
      from public.resolve_learning_output_bridge(
        (created->>'bridgeStudySetId')::uuid,
        'quiz'
      ) r
      cross join workspace_test_ids t
      limit 1
    ),
    'bridge-keyed new history never falls back to parent'
  );
end;
$$;

do $$
declare
  created jsonb;
begin
  created := public.create_workspace_document_version(
    null,
    null,
    'Fresh Workspace',
    'Fresh Doc',
    'paste',
    null,
    null,
    null,
    null,
    '# raw',
    private.sha256_utf8_hex('# raw'),
    '{"via":"test"}'::jsonb
  );
  perform pg_temp.assert_true(created ? 'workspaceId', 'first-ingest returns workspaceId');
  perform pg_temp.assert_true(
    (created->>'versionNumber')::integer = 1,
    'first-ingest creates version 1'
  );
  perform pg_temp.assert_true(
    (select count(*) = 1 from public.workspace_members
      where workspace_id = (created->>'workspaceId')::uuid
        and user_id = (select owner_id from workspace_test_ids)
        and role = 'owner'),
    'first-ingest creates owner membership'
  );

  created := public.create_workspace_document_version(
    (created->>'workspaceId')::uuid,
    (created->>'documentId')::uuid,
    null,
    'Fresh Doc',
    'paste',
    null,
    null,
    null,
    null,
    '# raw 2',
    private.sha256_utf8_hex('# raw 2'),
    '{}'::jsonb
  );
  perform pg_temp.assert_true(
    (created->>'versionNumber')::integer = 2,
    'replacement appends document version 2'
  );
end;
$$;

-- -------------------------------------------------------------------------
-- Soft-delete: source hidden, frozen snapshots remain readable
-- (After RPC tests so append/create still have an active document version.)
-- -------------------------------------------------------------------------

select pg_temp.as_user(owner_id) from workspace_test_ids;

update public.documents
set deleted_at = now()
where workspace_id = (select workspace_id from workspace_test_ids)
  and deleted_at is null;

update public.document_versions dv
set deleted_at = now()
from public.documents d
where d.id = dv.document_id
  and d.workspace_id = (select workspace_id from workspace_test_ids)
  and dv.deleted_at is null;

select pg_temp.assert_true(
  (select count(*) = 0 from public.documents d
    join workspace_test_ids t on d.workspace_id = t.workspace_id
   where d.deleted_at is null),
  'soft-deleted source invisible in active document list'
);

select pg_temp.assert_true(
  (select count(*) = 0 from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    join workspace_test_ids t on d.workspace_id = t.workspace_id
   where dv.deleted_at is null),
  'soft-deleted document versions invisible in active version list'
);

select pg_temp.assert_true(
  (select count(*) = 2 from public.output_source_snapshots oss
    join workspace_test_ids t on oss.output_id in (t.quiz_output_id, t.flashcards_output_id)),
  'authorized owner can read frozen output snapshots after soft delete'
);

select pg_temp.assert_true(
  (select count(*) = 1 from public.learning_outputs lo
    join workspace_test_ids t on lo.id = t.quiz_output_id),
  'soft-deleted source does not remove learning_outputs for authorized member'
);

select pg_temp.as_user(viewer_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 2 from public.output_source_snapshots oss
    join workspace_test_ids t on oss.output_id in (t.quiz_output_id, t.flashcards_output_id)),
  'authorized viewer can read frozen output snapshots after soft delete'
);

select pg_temp.as_user(nonmember_id) from workspace_test_ids;
select pg_temp.assert_true(
  (select count(*) = 0 from public.output_source_snapshots oss
    join workspace_test_ids t on oss.output_id in (t.quiz_output_id, t.flashcards_output_id)),
  'nonmember cannot read output snapshots after soft delete'
);

rollback;
