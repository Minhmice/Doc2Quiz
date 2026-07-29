# Phase 1: Foundation - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore authenticated Supabase connectivity, a **fresh v2.1 database baseline** (no legacy migrations), and an API route skeleton that mirrors the MVP pipeline in `docs/pipeline.md`. Phase 1 does **not** implement MarkItDown conversion, canonical building, or AI generation — only the foundation those steps plug into.

**In scope:** SQL reset + new schema, real auth (replace client stubs), protected app routes, storage bucket + RLS, stub API handlers per pipeline step.

**Out of scope:** Input validation logic, MarkItDown, canonical builder AI, quiz/flashcard generation, UI redesign.

</domain>

<decisions>
## Implementation Decisions

### SQL migration reset
- **D-01:** Delete **all 6** existing files in `supabase/migrations/` and replace with **one** fresh baseline migration for v2.1. No incremental ALTERs on v1 schema.
- **D-02:** Do **not** reset the remote Supabase project in Phase 1 — schema files only. User will apply/reset manually when ready.
- **D-03:** Old migrations are **not** archived to `.planning/` — full delete. Git history retains them if needed.

### Canonical knowledge schema
- **D-04:** **1:1** relationship — `study_sets` + `canonical_documents` (FK). One import → one study set → one canonical document row.
- **D-05:** `canonical_documents` holds: original file storage reference, `raw_markdown`, `canonical_markdown`, `metadata` (jsonb: language, content_type, title, clean_filename, input_type, source_url, etc.), timestamps.
- **D-06:** **`canonical_sections`** table — one row per stable section (`ordinal`, `heading`, `body_markdown`, optional `section_type`). Supports flashcard coverage picker in Phase 5.
- **D-07:** Drop v1 tables entirely from baseline: `media_assets`, `ocr_results`, `canonical_document_extractions`, `generation_output_cache`, `study_set_documents`. No v1 PDF/OCR columns.

### Practice content tables (carry forward shape)
- **D-08:** Include `approved_questions`, `approved_flashcards`, `quiz_sessions`, `study_wrong_history` in the fresh baseline — same general shape as v1 (4-choice MCQs, front/back cards, session stats, wrong-history). Adapt FKs to new `study_sets` + user-scoped RLS.
- **D-09:** Remove `draft`/`ready` publish semantics from `study_sets.status`. Use `pipeline_stage` enum/text instead: `input` → `raw` → `canonical` → `mode_selected` → `quiz` | `flashcards`. `content_kind` remains `quiz` | `flashcards` | null.

### Original file storage
- **D-10:** **Supabase Storage** bucket `doc2quiz` for uploaded originals (PDF, Office, images, audio). `canonical_documents.original_storage_path` + `original_filename` + `original_mime_type` reference the object.
- **D-11:** Paste and YouTube URL inputs store source reference in metadata only (no storage object). Phase 2 implements upload; Phase 1 creates bucket + RLS policies in migration.

### Auth restoration
- **D-12:** Replace `src/lib/client/*` stubs with real Supabase clients: `browser.ts`, `server.ts`, `middlewareClient.ts`, `auth-guard.ts`.
- **D-13:** **Email/password only** for v2.1 (same as v1). No OAuth providers in Phase 1.
- **D-14:** Restore `requireUser()` on `(app)` layout — protected routes redirect unauthenticated users to `/login`.
- **D-15:** Wire `src/proxy.ts` for Supabase session refresh (replace passthrough). **No dev backdoor.**

### API route skeleton
- **D-16:** **Step-based routes** aligned to `docs/pipeline.md` — not one monolithic orchestrator. Phase 1 creates route files with stub handlers (501 or structured "not implemented" JSON).
- **D-17:** Route map:
  - `GET/POST /api/study-sets` — list / create study set
  - `GET/PATCH/DELETE /api/study-sets/[id]` — study set CRUD
  - `POST /api/study-sets/[id]/ingest` — validate + MarkItDown (stub → Phase 2)
  - `POST /api/study-sets/[id]/canonicalize` — canonical builder (stub → Phase 3)
  - `POST /api/study-sets/[id]/quiz/generate` — MCQ generation (stub → Phase 4)
  - `POST /api/study-sets/[id]/flashcards/generate` — flashcard generation (stub → Phase 5)
- **D-18:** All API routes require authenticated user; use server Supabase client + RLS.

### Input validation stub
- **D-19:** `INPUT-VAL-01` — create shared validation types/constants (supported MIME types, max sizes per format) in `src/lib/pipeline/validation.ts`. Enforcement logic lands in Phase 2; Phase 1 exports the contract.

### Claude's Discretion
- Exact column names and enum vs text for `pipeline_stage` and `metadata` keys
- Whether `study_sets.subtitle` is kept or dropped
- Migration filename timestamp
- Minor RLS policy naming — must be user-scoped on all tables

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline & requirements
- `docs/pipeline.md` — Authoritative MVP flow: input → validate → MarkItDown → raw MD → canonical builder → Supabase → quiz or flashcards
- `.planning/REQUIREMENTS.md` — CORE-AUTH-01/02, CANON-09, INPUT-VAL-01 for Phase 1; full traceability
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependency graph
- `.planning/PROJECT.md` — Supabase source of truth, MarkItDown, immediate save, no draft stage

### Codebase (integration targets)
- `src/lib/client/supabase.ts` — Mock to replace
- `src/lib/client/studySetDb.ts` — Mock to replace with real DB layer
- `src/proxy.ts` — Passthrough to wire for session refresh
- `src/app/(app)/layout.tsx` — Missing auth guard; restore
- `src/app/(auth)/login/LoginClient.tsx` — Login UI (wire to real auth)
- `src/app/(auth)/signup/SignupClient.tsx` — Signup UI (wire to real auth)

### Supabase (to be replaced)
- `supabase/migrations/*.sql` — All 6 files deleted; one new baseline written in Phase 1 execution

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Frontend shell:** Dashboard, quiz, flashcards, review, settings pages and components — keep; swap data layer from stubs to Supabase.
- **Auth UI:** `LoginClient.tsx`, `SignupClient.tsx`, `/logout` route — exist; need real Supabase wiring.
- **v1 Supabase patterns:** `src/lib/supabase/browser.ts`, `server.ts`, `middlewareClient.ts`, `auth-guard.ts` may still exist on disk — prefer restoring/adapting over rewriting.

### Established Patterns
- **User-scoped RLS:** v1 migration used `(user_id = auth.uid())` on all tables — carry forward.
- **Composite FK:** `study_sets` has `UNIQUE (id, user_id)` for child-table FKs — keep pattern.
- **Same-origin AI forward:** v1 used `/api/ai/forward` for user API keys — out of Phase 1 scope but pattern may return in later phases.

### Integration Points
- `studySetDb.ts` → Supabase queries against `study_sets`, `canonical_documents`, `canonical_sections`
- `(app)/layout.tsx` → `requireUser()` before rendering children
- `proxy.ts` → session cookie refresh on navigation
- New `src/app/api/study-sets/**` → pipeline step stubs

### Codebase caveat
Workspace may still contain legacy v1 API routes and server libs (`src/app/api/`, `src/lib/server/`). Phase 1 execution should align active code with the new skeleton — remove or ignore stale v1 pipeline code that conflicts with step-based routes.

</code_context>

<specifics>
## Specific Ideas

- User explicitly requested: **delete all old SQL before Phase 1** — no archive folder, single fresh baseline.
- User scope: align foundation with **everything in `docs/pipeline.md`** — schema must accommodate full pipeline even if implementation is phased.
- Remote DB reset deferred — user controls when to apply migration to Supabase project.

</specifics>

<deferred>
## Deferred Ideas

- **MarkItDown integration** — Phase 2
- **Canonical Knowledge Builder AI** — Phase 3
- **Quiz / flashcard generation** — Phases 4–5
- **OAuth / social login** — not v2.1
- **Remote `supabase db reset`** — user action when ready, not Phase 1 automation
- **Legacy v1 API routes** (`generate-from-file`, OCR, parse progress) — remove or replace during execution; not part of v2.1 pipeline

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-07-25*
