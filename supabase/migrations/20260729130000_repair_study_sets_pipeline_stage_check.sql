begin;

-- CREATE TABLE IF NOT EXISTS in the v2.1 baseline does not replace a CHECK
-- constraint on an older study_sets table. Remove the legacy constraint before
-- normalizing legacy stage values.
alter table public.study_sets
  drop constraint if exists study_sets_pipeline_stage_check;

update public.study_sets as study_set
set pipeline_stage = case
  when exists (
    select 1
    from public.approved_questions as question
    where question.study_set_id = study_set.id
      and question.user_id = study_set.user_id
  ) then 'quiz'
  when exists (
    select 1
    from public.approved_flashcards as flashcard
    where flashcard.study_set_id = study_set.id
      and flashcard.user_id = study_set.user_id
  ) then 'flashcards'
  when exists (
    select 1
    from public.canonical_documents as document
    where document.study_set_id = study_set.id
      and document.user_id = study_set.user_id
      and nullif(btrim(document.canonical_markdown), '') is not null
  ) then 'canonical'
  when exists (
    select 1
    from public.canonical_documents as document
    where document.study_set_id = study_set.id
      and document.user_id = study_set.user_id
      and nullif(btrim(document.raw_markdown), '') is not null
  ) then 'raw'
  else 'input'
end
where study_set.pipeline_stage not in (
  'input',
  'raw',
  'canonical',
  'mode_selected',
  'quiz',
  'flashcards'
);

alter table public.study_sets
  add constraint study_sets_pipeline_stage_check check (
    pipeline_stage in (
      'input',
      'raw',
      'canonical',
      'mode_selected',
      'quiz',
      'flashcards'
    )
  );

commit;
