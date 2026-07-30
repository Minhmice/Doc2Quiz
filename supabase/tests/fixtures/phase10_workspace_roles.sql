-- Reusable Phase 10 workspace role fixtures.
-- Loaded by supabase/tests/phase10_workspace_authorization.sql

create or replace function pg_temp.phase10_assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create temp table if not exists phase10_fixture (
  owner_id uuid not null,
  editor_id uuid not null,
  viewer_id uuid not null,
  outsider_id uuid not null,
  blocked_id uuid not null,
  parent_study_set_id uuid not null,
  workspace_id uuid null,
  document_id uuid null,
  document_version_id uuid null,
  canonical_version_id uuid null,
  quiz_bridge_id uuid null,
  flashcards_bridge_id uuid null,
  quiz_output_id uuid null,
  flashcards_output_id uuid null,
  quiz_item_id uuid not null,
  flashcard_item_id uuid not null,
  quiz_session_id uuid not null,
  study_session_id uuid not null,
  storage_object_id uuid not null,
  storage_path text not null
) on commit drop;

truncate phase10_fixture;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p10-owner@example.com', crypt('pw', gen_salt('bf')), now()),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p10-editor@example.com', crypt('pw', gen_salt('bf')), now()),
  ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p10-viewer@example.com', crypt('pw', gen_salt('bf')), now()),
  ('c1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p10-outsider@example.com', crypt('pw', gen_salt('bf')), now()),
  ('c1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p10-blocked@example.com', crypt('pw', gen_salt('bf')), now())
on conflict (id) do nothing;

insert into public.study_sets (id, user_id, title, pipeline_stage, content_kind)
values (
  'c2000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Phase 10 Parent',
  'quiz',
  'quiz'
);

insert into public.canonical_documents (
  id, user_id, study_set_id, raw_markdown, canonical_markdown, metadata, original_filename
)
values (
  'c3000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  '# Raw',
  '# Canonical' || E'\n\n' || 'Body',
  '{"lang":"en"}'::jsonb,
  'notes.md'
);

insert into public.canonical_sections (
  user_id, canonical_document_id, ordinal, heading, body_markdown, section_type, section_key
)
values
  ('c1000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 1, 'One', 'Body one', 'section', 'sec_001');

insert into public.approved_questions (
  id, user_id, study_set_id, prompt, choices, correct_index, explanation
)
values (
  'c4000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  'Q1?',
  array['A','B','C','D'],
  0,
  'Because'
);

insert into public.approved_flashcards (
  id, user_id, study_set_id, front, back
)
values (
  'c5000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  'Front',
  'Back'
);

insert into public.quiz_sessions (
  id, user_id, study_set_id, total_questions, correct_count
)
values (
  'c6000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  1,
  1
);

insert into public.study_wrong_history (user_id, study_set_id, question_ids)
values (
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  array['c4000000-0000-0000-0000-000000000001']::uuid[]
);

insert into public.study_sessions (
  id, user_id, study_set_id, mode, item_ids
)
values (
  'c7000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  'quiz',
  array['c4000000-0000-0000-0000-000000000001']::uuid[]
);

insert into public.study_mistakes (
  user_id, study_set_id, item_id, mode
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'c2000000-0000-0000-0000-000000000001',
  'c4000000-0000-0000-0000-000000000001',
  'quiz'
);

insert into phase10_fixture (
  owner_id, editor_id, viewer_id, outsider_id, blocked_id,
  parent_study_set_id, quiz_item_id, flashcard_item_id,
  quiz_session_id, study_session_id, storage_object_id, storage_path
)
values (
  'c1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000003',
  'c1000000-0000-0000-0000-000000000004',
  'c1000000-0000-0000-0000-000000000005',
  'c2000000-0000-0000-0000-000000000001',
  'c4000000-0000-0000-0000-000000000001',
  'c5000000-0000-0000-0000-000000000001',
  'c6000000-0000-0000-0000-000000000001',
  'c7000000-0000-0000-0000-000000000001',
  'c8000000-0000-0000-0000-000000000001',
  'pending'
);

select private.backfill_legacy_study_set(parent_study_set_id)
from phase10_fixture;

update phase10_fixture f
set workspace_id = quiz.workspace_id,
    quiz_bridge_id = quiz.legacy_study_set_id,
    flashcards_bridge_id = cards.legacy_study_set_id,
    quiz_output_id = quiz.id,
    flashcards_output_id = cards.id,
    document_id = d.id,
    document_version_id = dv.id,
    canonical_version_id = cv.id,
    quiz_item_id = aq.id,
    flashcard_item_id = af.id,
    storage_path = quiz.workspace_id::text || '/' || d.id::text || '/' || dv.id::text || '/notes.md'
from public.learning_outputs quiz
join public.learning_outputs cards
  on cards.legacy_parent_study_set_id = quiz.legacy_parent_study_set_id
 and cards.kind = 'flashcards'
join public.documents d on d.workspace_id = quiz.workspace_id
join public.document_versions dv on dv.document_id = d.id
join public.canonical_versions cv on cv.document_version_id = dv.id
join public.approved_questions aq on aq.output_id = quiz.id
join public.approved_flashcards af on af.output_id = cards.id
where quiz.legacy_parent_study_set_id = f.parent_study_set_id
  and quiz.kind = 'quiz';

insert into public.workspace_members (workspace_id, user_id, role)
select workspace_id, editor_id, 'editor' from phase10_fixture;

insert into public.workspace_members (workspace_id, user_id, role)
select workspace_id, viewer_id, 'viewer' from phase10_fixture;

insert into storage.objects (id, bucket_id, name, owner, metadata)
select
  storage_object_id,
  'doc2quiz',
  storage_path,
  owner_id,
  '{}'::jsonb
from phase10_fixture;

create or replace function pg_temp.phase10_as_user(p_user_id uuid)
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
