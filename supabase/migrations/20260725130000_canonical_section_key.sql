begin;

-- Stable LLM section IDs (e.g. sec_001) for Phase 5 flashcard coverage picker (D-17).
alter table public.canonical_sections
  add column if not exists section_key text null;

create unique index if not exists canonical_sections_document_section_key_unique
  on public.canonical_sections (canonical_document_id, section_key)
  where section_key is not null;

commit;
