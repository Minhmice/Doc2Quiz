# Phase 2: Input & MarkItDown - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** Pipeline express path (no discuss-phase — decisions from `docs/pipeline.md`, Phase 1 CONTEXT, REQUIREMENTS)

<domain>
## Phase Boundary

Authenticated users can submit **any supported input type** through a unified input zone, pass validation, convert to **raw Markdown via MarkItDown**, and persist results in Supabase (`canonical_documents.raw_markdown`, original storage reference, metadata). Phase 2 implements **`POST /api/study-sets/[id]/ingest`** end-to-end and wires the frontend import flow.

**In scope:** Input zone UI (all formats), validation enforcement, file upload to Storage, MarkItDown conversion, raw MD + source persistence, `pipeline_stage` → `raw`.

**Out of scope:** Canonical Knowledge Builder (Phase 3), quiz/flashcard generation, mode selection after canonical save, quality-validation gate before save.

</domain>

<decisions>
## Implementation Decisions

### Carrying forward from Phase 1
- **D-P1-04–11:** `study_sets` 1:1 `canonical_documents`; Storage bucket `doc2quiz`; paste/YouTube = metadata-only source ref; `pipeline_stage` enum.
- **D-P1-17:** Ingest route is `POST /api/study-sets/[id]/ingest` — Phase 2 replaces stub with real handler.
- **D-P1-19:** `src/lib/pipeline/validation.ts` is the allowlist contract — Phase 2 enforces it.

### MarkItDown integration
- **D-01:** Use **Microsoft MarkItDown** (Python) as the sole conversion engine per `docs/pipeline.md` and PROJECT.md — no custom PDF/OCR parsers.
- **D-02:** Conversion runs **server-side** in the ingest API route (or a dedicated server module it calls). Client never runs MarkItDown.
- **D-03:** MarkItDown invocation via **Python subprocess** from Node (`python -m markitdown` or equivalent CLI) unless research proves a better same-repo pattern. Pin MarkItDown version in project docs/requirements.

### Ingest pipeline behavior
- **D-04:** Ingest flow: **validate input** → **store original** (file → Storage; paste/URL → metadata) → **MarkItDown convert** → **save `raw_markdown`** on `canonical_documents` → set `study_sets.pipeline_stage` to `raw`.
- **D-05:** On validation failure, return **4xx with clear error message** before any conversion or storage write (INPUT-VAL-01).
- **D-06:** On conversion failure, return **5xx/422 with actionable error**; do not leave partial `raw_markdown` without marking failure state in metadata.

### Input types
- **D-07:** **File upload** path: multipart to ingest API (or signed upload then ingest) for PDF, Office, images, audio, HTML, CSV, JSON, XML.
- **D-08:** **Paste** path: JSON body with `{ kind: "paste", text }` — no Storage object; `metadata.input_type = "paste"`.
- **D-09:** **YouTube URL** path: JSON body with `{ kind: "youtube", url }` — MarkItDown handles URL where supported; store `metadata.source_url`; no separate yt-dlp unless MarkItDown cannot handle YouTube (research decides; prefer MarkItDown-only).

### Input zone UI
- **D-10:** **Unified import flow** replacing legacy PDF-only `NewStudySetPdfImportFlow` — one surface for file drop, paste, and URL on `/edit/new` routes (quiz + flashcards).
- **D-11:** Reuse existing shell components (`StudySetNewImportStepContext`, step chrome) where possible; **identity preservation** per Impeccable — no full redesign.
- **D-12:** Show **conversion progress** states: idle → validating → uploading → converting → done/error. No fake progress bars — real step labels only.
- **D-13:** After successful ingest, navigate user to **next pipeline step placeholder** (view raw / await Phase 3 canonicalize) — not straight to quiz generation.

### Storage
- **D-14:** Uploaded originals land in `doc2quiz` bucket at path `{user_id}/{study_set_id}/{filename}` (or equivalent); populate `canonical_documents.original_storage_path`, `original_filename`, `original_mime_type`.
- **D-15:** Do not store duplicate raw text in legacy `extracted_text` columns — `canonical_documents.raw_markdown` is source of truth.

### Legacy cleanup
- **D-16:** Remove or bypass v1 import paths: `generate-from-file`, PDF parse pages, OCR/graphify hooks tied to old pipeline. Phase 2 ingest is the only import path.

### Claude's Discretion
- Multipart vs presigned upload strategy
- Exact MarkItDown CLI flags and temp file handling
- Whether to keep `NewStudySetTextImportFlow` as separate route or merge into unified flow
- Python runtime requirement documentation (README, Docker, dev setup)
- Progress UI component structure (reuse `UnifiedImportStatusCard` vs new minimal component)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline & requirements
- `docs/pipeline.md` — Input zone → validate → MarkItDown → raw MD (authoritative)
- `.planning/REQUIREMENTS.md` — INPUT-01–12, INPUT-VAL-01, CONV-01, CONV-02
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/PROJECT.md` — MarkItDown decision, Supabase source of truth

### Phase 1 upstream
- `.planning/phases/01-foundation/01-CONTEXT.md` — Schema, ingest stub route, validation contract
- `.planning/phases/01-foundation/01-RESEARCH.md` — Supabase/storage patterns
- `.planning/phases/01-foundation/01-PATTERNS.md` — API and DB analogs

### Codebase (integration targets)
- `src/app/api/study-sets/[id]/ingest/route.ts` — stub to implement (or create)
- `src/lib/pipeline/validation.ts` — INPUT-VAL-01 contract (Phase 1)
- `src/components/edit/new/import/` — existing import step UI
- `src/app/(app)/edit/new/` — new study set routes
- `src/components/edit/new/NewStudySetTextImportFlow.tsx` — text import (adapt or merge)
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` — legacy PDF flow (replace)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StudySetNewImportStepContext` — step state machine for import wizard
- `NewStudySetTextImportFlow` — paste + text file pattern (currently client-stub `createStudySet`)
- Legacy `UnifiedImportStatusCard`, `ImportQuizLivePanel` — v1 progress UI patterns (evaluate reuse vs simplify)
- `src/lib/pdf/validatePdfFile.ts` — v1 PDF-only validation (replace with pipeline validation)

### Established Patterns
- Ingest API stub from Phase 1 plan 01-04 (501 → implement)
- `canonical_documents` table from Phase 1 baseline migration
- Toast errors via sonner on client flows

### Integration Points
- Dashboard → `/edit/new` → create study set → POST ingest → redirect
- Storage bucket `doc2quiz` + RLS from Phase 1 migration

### Caveats
- Phase 1 execution may be partial on disk — planner should verify Phase 1 artifacts exist or include prerequisite tasks
- Legacy v1 API routes (`generate-from-file`) may still exist — Phase 2 removes them

</code_context>

<specifics>
## Specific Ideas

- User skipped discuss-phase; scope locked to `docs/pipeline.md` Accept list and ROADMAP Phase 2 success criteria.
- UI phase should follow **Impeccable** product register — preserve mint/forest design system, no PDF-centric copy.

</specifics>

<deferred>
## Deferred Ideas

- Canonical Knowledge Builder — Phase 3
- Quiz/flashcard generation after import — Phases 4–5
- Pre-save quality scoring — out of scope (OOS-03)
- Client-side MarkItDown / WASM — rejected (server-only per D-02)

</deferred>

---

*Phase: 2-Input & MarkItDown*
*Context gathered: 2026-07-25*
