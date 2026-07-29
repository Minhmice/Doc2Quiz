# Phase 3: Canonical Knowledge - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** Pipeline express path + **locked prompt** `prompt/canonical_builder_v1.json`

<domain>
## Phase Boundary

Transform stored **raw Markdown** (from Phase 2 ingest) into **canonical knowledge**: cleaned `canonical_markdown`, structured `canonical_sections` rows, and rich `metadata` (language, content type, extracted Q&A, title, filename). Implement **`POST /api/study-sets/[id]/canonicalize`** and a **canonical preview UI** so the user can review output before Phase 4 mode selection.

**In scope:** Canonical Knowledge Builder (AI), persistence to Supabase, `pipeline_stage` → `canonical`, preview/read UI.

**Out of scope:** Quiz/flashcard generation (Phases 4–5), full mode-selection workflow (MODE-01 → Phase 4; Phase 3 may show read-only preview + disabled/placeholder CTA only), pre-save quality validation gate (OOS-03).

</domain>

<decisions>
## Implementation Decisions

### Carrying forward
- **D-P1-04–06:** `canonical_documents` + `canonical_sections` tables; 1:1 with `study_sets`.
- **D-P1-17:** Canonicalize route is `POST /api/study-sets/[id]/canonicalize` — Phase 3 replaces 501 stub.
- **D-P2-04:** Input ends with `pipeline_stage = raw` and `canonical_documents.raw_markdown` populated.

### Canonical Knowledge Builder (AI)
- **D-01:** Builder is **LLM-powered** using user-supplied API keys via same-origin **`/api/ai/forward`** pattern (PROJECT.md). No embedded vendor keys in server env for generation.
- **D-02:** **Single structured output** per canonicalize run: `{ canonicalMarkdown, sections[], metadata }` validated with **Zod** before any DB write.
- **D-03:** **CANON-08 guardrails:** System prompt + output schema enforce *never invent* — title/filename derived only from source headings/filenames; sections must map to source headings/blocks; reject/sanitize outputs that add facts not in `raw_markdown`.
- **D-04:** Builder responsibilities (CANON-01–07):
  - Clean noise, collapse duplicate paragraphs (CANON-01)
  - Preserve headings, tables, formulas, examples in markdown (CANON-02)
  - Detect `metadata.language` (CANON-03)
  - Detect `metadata.content_type`: `theory` | `exam` | `mixed` (CANON-04)
  - Extract `metadata.extracted_qa[]` when present (CANON-05)
  - Split into stable `canonical_sections` with ordinal, heading, body_markdown (CANON-06)
  - Generate `metadata.title` and `metadata.clean_filename` without invention (CANON-07)
- **D-05:** On success: upsert `canonical_markdown`, replace `canonical_sections` rows (delete+insert in transaction), merge metadata, set `pipeline_stage = canonical`, update `study_sets.title` from metadata.title if present.
- **D-06:** On failure: return 422 with error; set `metadata.canonicalization_status = failed`; do not overwrite good canonical data with partial output.

### API behavior
- **D-07:** `POST /canonicalize` requires `pipeline_stage` at least `raw` and non-empty `raw_markdown`; idempotent re-run allowed (user may re-canonicalize after re-ingest).
- **D-08:** `GET /api/study-sets/[id]/canonical` (or extend existing GET) returns canonical markdown + sections + metadata for preview UI — read-only.

### Canonical preview UI
- **D-09:** Replace legacy `/sets/[id]/source` redirect with **canonical preview page**: render `canonical_markdown` (or section list), show metadata chips (language, content type, section count).
- **D-10:** After ingest (Phase 2), post-canonicalize navigation lands on preview page. **No Quiz/Flashcards generation buttons yet** — placeholder copy: "Choose learning mode next" (wired in Phase 4).
- **D-11:** Identity preservation — reuse existing typography/tokens; read-only markdown viewer (prose styles), not a redesign.

### Legacy cleanup
- **D-12:** Remove/stop using v1 canonical extraction (`generateFromFile/canonical*`, `canonical_document_extractions` patterns) — Phase 3 builder supersedes.

### Locked prompt contract (`prompt/canonical_builder_v1.json`)
- **D-13:** **Authoritative prompt spec** — load `prompt/canonical_builder_v1.json` at runtime; do not duplicate system/tasks/constraints in code. Version field `1.0` logged in `metadata.prompt_version`.
- **D-14:** **Input template variables** filled from `canonical_documents` + `study_sets`: `source_id` (study_set_id), `source_type` (metadata.input_type), `original_filename`, `raw_markdown`.
- **D-15:** **LLM must return JSON only** matching `output_schema` in the prompt file — validate with Zod derived from that schema before DB write.
- **D-16:** **Schema → Supabase mapping:**
  - `title` → `metadata.title` + update `study_sets.title`
  - `filename` → `metadata.clean_filename`
  - `language` → `metadata.language`
  - `document_type` → `metadata.content_type` (`theory` | `exam` | `mixed`)
  - `topics` → `metadata.topics[]`
  - `canonical_markdown` → `canonical_documents.canonical_markdown`
  - `sections[]` → `canonical_sections` rows: `id` → `metadata.section_id` on row or stored in section metadata; `ordinal` from array order; `title` → `heading`; `content` → `body_markdown`; `content_type` → `section_type`
  - `extracted_questions` → `metadata.extracted_questions[]`
  - `warnings` → `metadata.warnings[]`
- **D-17:** **Stable section IDs** — preserve LLM `sec_001` style IDs in `canonical_sections` (add `section_key` column or store in jsonb on section row) for flashcard coverage picker in Phase 5.
- **D-18:** Prompt constraints are binding: no invented facts, no quiz/flashcard generation in builder, no external knowledge, do not discard meaningful content.

### Claude's Discretion
- Model selection via user settings (which provider/model for canonicalize)
- Chunking strategy for very long raw markdown (if raw exceeds context window)
- Whether `section_key` is a new DB column vs nested in section metadata jsonb

</decisions>

<canonical_refs>
## Canonical References

- `docs/pipeline.md` — Canonical Knowledge Builder requirements (authoritative)
- `.planning/REQUIREMENTS.md` — CANON-01–08
- `.planning/ROADMAP.md` — Phase 3 success criteria
- `.planning/PROJECT.md` — AI forward pattern, no invention constraint
- `.planning/phases/01-foundation/01-CONTEXT.md` — Schema decisions
- `.planning/phases/02-input-markitdown/02-CONTEXT.md` — Ingest → raw stage
- `src/app/api/study-sets/[id]/canonicalize/route.ts` — stub to implement
- `supabase/migrations/20260725120000_v21_baseline.sql` — canonical_documents/sections
- `prompt/canonical_builder_v1.json` — **LOCKED** system prompt, tasks, output_schema, constraints for builder

</canonical_refs>

<code_context>
## Existing Code Insights

- **Canonicalize stub:** 501 at `canonicalize/route.ts` with auth + verifyStudySet pattern ready.
- **Schema:** `canonical_documents.canonical_markdown`, `metadata` jsonb; `canonical_sections` with ordinal/heading/body_markdown.
- **Legacy:** `src/lib/server/generateFromFile/*` has v1 canonical unit schemas — reference for section shape only, do not resurrect v1 pipeline.
- **AI routes:** Check for `/api/ai/forward` — may need restore from git if deleted.

</code_context>

<specifics>
## Specific Ideas

- User provided `prompt/canonical_builder_v1.json` — use as-is for LLM contract; Zod schema generated from `output_schema`.

</specifics>

<deferred>
## Deferred Ideas

- MODE-01 Quiz vs Flashcards selection UI — Phase 4
- MCQ/flashcard generation — Phases 4–5
- Separate quality-validation stage — OOS-03

</deferred>

---

*Phase: 3-Canonical Knowledge*
*Context gathered: 2026-07-25*
