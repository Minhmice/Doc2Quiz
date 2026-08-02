---
phase: 03-canonical-knowledge
verified: 2026-07-25T06:42:00Z
status: human_needed
score: 11/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Ingest a real document (file/paste/URL), land on /sets/{id}/source, wait for auto-canonicalize to finish"
    expected: "Progress card transitions to preview with rendered canonical markdown, metadata chips (language, content type, section count), and disabled 'Choose learning mode' CTA"
    why_human: "E2E flow requires live Supabase, MarkItDown ingest, and AI provider; cannot run without external services"
  - test: "After successful canonicalize, inspect canonical_documents.metadata in Supabase"
    expected: "metadata contains language, content_type, title, clean_filename, prompt_version=1.0, canonicalization_status=ok; study_sets.pipeline_stage=canonical"
    why_human: "LLM output quality and field population only observable on real runs"
  - test: "Run canonicalize on a document with known exam Q&A content"
    expected: "metadata.extracted_questions populated; sections have stable section_key values (sec_001, sec_002); headings/tables preserved in preview"
    why_human: "CANON-01–07 behaviors are LLM-delegated; prompt instructs but quality cannot be grep-verified"
  - test: "Trigger canonicalize failure (e.g. unset AI_PROVIDER_URL) and retry"
    expected: "422 error shown in UI with retry button; metadata.canonicalization_status=failed without overwriting existing canonical_markdown or sections"
    why_human: "Failure UX and metadata-only persistence need runtime observation"
---

# Phase 3: Canonical Knowledge Verification Report

**Phase Goal:** Raw Markdown becomes cleaned, sectioned canonical knowledge in Supabase  
**Verified:** 2026-07-25T06:42:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

Phase 3 delivers all three core pillars in code: **canonical knowledge builder** (`runCanonicalize` + locked prompt + Zod validation), **Supabase persistence** (canonical_markdown, sections with `section_key`, metadata, `pipeline_stage=canonical`), and **preview UI** (`/sets/[id]/source` with auto-canonicalize, read-only viewer, metadata chips, Phase 4 placeholder). Automated tests (23 vitest cases) and typecheck pass. LLM output *quality* (noise removal, language detection accuracy) requires human E2E verification.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Noise removed, duplicates collapsed; headings/tables/formulas/examples preserved (ROADMAP SC1) | ? UNCERTAIN | Prompt tasks in `prompt/canonical_builder_v1.json` instruct cleaning + preservation; behavior is LLM-delegated — no runtime quality proof |
| 2 | Language and content type detected and stored (ROADMAP SC2) | ? UNCERTAIN | `mapCanonicalOutputToMetadata` stores `language` + `content_type`; detection accuracy needs real document run |
| 3 | Q&A extracted when present; stable sections; title/filename without invention (ROADMAP SC3) | ? UNCERTAIN | Schema validates `extracted_questions`, `sec_NNN` IDs, title/filename; `section_key` persisted; invention guardrails in prompt constraints only |
| 4 | User can view canonical output before choosing learning mode (ROADMAP SC4) | ✓ VERIFIED | Full preview page at `src/app/(app)/sets/[id]/source/page.tsx` with markdown viewer, chips, TOC, disabled CTA |
| 5 | Minimal server AI helpers export `postChatCompletionAssistantText` + `getAiProcessingConfig` | ✓ VERIFIED | `src/lib/server/openAiChatCompletion.ts`, `ai-processing-config.ts` exist and imported by `canonicalize.ts` |
| 6 | `canonical_sections` has `section_key` column with unique index per document | ✓ VERIFIED | `supabase/migrations/20260725130000_canonical_section_key.sql`; mapped in `mapCanonicalOutputToSections` |
| 7 | Locked prompt loads at runtime without duplicating system/tasks/constraints in code | ✓ VERIFIED | `loadCanonicalPrompt` reads `prompt/canonical_builder_v1.json`; `buildCanonicalMessages` assembles from spec |
| 8 | Zod schema rejects malformed LLM output before DB write | ✓ VERIFIED | `canonicalBuilderOutputSchema` + 7 tests; `runCanonicalize` validates before any section delete |
| 9 | POST `/canonicalize` transforms raw_markdown via locked prompt + LLM | ✓ VERIFIED | `runCanonicalize` → `callCanonicalBuilder` → `postChatCompletionAssistantText`; route delegates with auth |
| 10 | Success sets `pipeline_stage=canonical`, persists markdown/sections/metadata | ✓ VERIFIED | `canonicalize.ts` lines 329–373; integration test confirms 200 + `pipelineStage: "canonical"` |
| 11 | Failure returns 422, sets `canonicalization_status=failed`, no data overwrite | ✓ VERIFIED | `persistCanonicalizationFailure` updates metadata only; test confirms no section delete on validation fail |
| 12 | GET `/canonical` returns read-only preview payload | ✓ VERIFIED | `src/app/api/study-sets/[id]/canonical/route.ts` returns camelCase `data` with sections ordered by ordinal |
| 13 | `/sets/[id]/source` shows canonical preview (not legacy redirect) | ✓ VERIFIED | Full state machine page with 6 canonical components; ingest routes via `studySetSource(id)` |
| 14 | Raw stage auto-POSTs canonicalize with progress UI | ✓ VERIFIED | `page.tsx` lines 125–145: `pipeline_stage === "raw"` triggers `postCanonicalize` with `canonicalizeStartedRef` guard |

**Score:** 11/14 truths verified (3 UNCERTAIN pending human E2E)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/pipeline/canonicalPrompt.ts` | Runtime prompt load + template substitution | ✓ VERIFIED | 68 lines; exports `loadCanonicalPrompt`, `buildCanonicalMessages`, `CANONICAL_PROMPT_VERSION` |
| `src/lib/pipeline/canonicalSchemas.ts` | Zod mirror of locked output_schema | ✓ VERIFIED | Validates document_type, sec_NNN IDs, min(1) canonical_markdown |
| `src/lib/pipeline/canonicalize.ts` | LLM orchestration + persistence | ✓ VERIFIED | 382 lines; pre-flight, validate-before-delete, failure metadata |
| `src/app/api/study-sets/[id]/canonicalize/route.ts` | POST endpoint | ✓ VERIFIED | Auth, 400/422/200 mapping, delegates to `runCanonicalize` |
| `src/app/api/study-sets/[id]/canonical/route.ts` | GET preview endpoint | ✓ VERIFIED | Returns studySet + document + sections with `sectionKey` |
| `supabase/migrations/20260725130000_canonical_section_key.sql` | Stable section IDs | ✓ VERIFIED | Column + partial unique index |
| `src/app/(app)/sets/[id]/source/page.tsx` | Preview page state machine | ✓ VERIFIED | WIRED — auto-canonicalize, preview, error/retry states |
| `src/lib/client/canonicalizeStudySet.ts` | Client API helpers | ✓ VERIFIED | `postCanonicalize`, `fetchCanonicalPreview` with error mapping |
| `src/components/canonical/*.tsx` | Six UI components | ✓ VERIFIED | All 6 exist; imported by source page |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `canonicalPrompt.ts` | `prompt/canonical_builder_v1.json` | `readFile` at runtime | ✓ WIRED | `path.join(process.cwd(), "prompt", "canonical_builder_v1.json")` |
| `canonicalize.ts` | `openAiChatCompletion.ts` | `postChatCompletionAssistantText` | ✓ WIRED | JSON object mode, repair retry on schema fail |
| `canonicalize.ts` | `canonical_documents` + `canonical_sections` | validate → update doc → delete sections → insert | ✓ WIRED | No explicit DB transaction (see warnings) |
| `canonicalize/route.ts` | `canonicalize.ts` | `runCanonicalize({ supabase, userId, studySetId, user })` | ✓ WIRED | Route test confirms delegation |
| `source/page.tsx` | `/api/.../canonicalize` | `postCanonicalize` on raw mount | ✓ WIRED | `canonicalizeStartedRef` prevents Strict Mode double POST |
| `source/page.tsx` | `/api/.../canonical` | `fetchCanonicalPreview` after success | ✓ WIRED | Preview state renders `CanonicalMarkdownViewer` |
| `edit/new/quiz/page.tsx` | `/sets/{id}/source` | `getPostIngestHref` → `studySetSource` | ✓ WIRED | Post-ingest navigation lands on preview page |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `source/page.tsx` | `state.data` (preview) | `fetchCanonicalPreview` → GET `/canonical` → Supabase | Yes (when canonicalized) | ✓ FLOWING |
| `CanonicalMarkdownViewer` | `sections` / `markdown` | Props from preview API payload | Yes (DB-backed) | ✓ FLOWING |
| `CanonicalMetadataChips` | `metadata.language`, `content_type` | `document.metadata` from API | Yes (LLM-populated on success) | ✓ FLOWING |
| `CanonicalizeProgressCard` | N/A (static progress UI) | Shown during `postCanonicalize` await | N/A | ✓ OK |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zod schema validation | `npm test -- --run canonicalSchemas` | 7 tests passed | ✓ PASS |
| Canonicalize service | `npm test -- --run canonicalize` | 6 tests passed | ✓ PASS |
| Canonicalize route | `npm test -- --run canonicalize/route` | 5 tests passed | ✓ PASS |
| Prompt loader | `npm test -- --run canonicalPrompt` | 5 tests passed | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0 | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared or conventional `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CANON-01 | 03-02, 03-03 | Clean noise, remove duplicates | ? NEEDS HUMAN | Prompt task #1; LLM quality unverified |
| CANON-02 | 03-02, 03-03 | Preserve headings, tables, formulas, examples | ? NEEDS HUMAN | Prompt task #2; markdown viewer renders GFM |
| CANON-03 | 03-02 | Detect document language | ? NEEDS HUMAN | Stored in `metadata.language`; detection unverified |
| CANON-04 | 03-02 | Detect content type theory/exam/mixed | ? NEEDS HUMAN | `document_type` enum + `metadata.content_type` mapping |
| CANON-05 | 03-02 | Extract existing Q&A | ? NEEDS HUMAN | `extracted_questions` in schema + metadata |
| CANON-06 | 03-02 | Split into stable sections | ✓ SATISFIED | `sections[]` → `canonical_sections` with ordinal + `section_key` |
| CANON-07 | 03-02 | Generate title/filename without invention | ? NEEDS HUMAN | Schema requires min(1); prompt constraints bind; quality unverified |
| CANON-08 | 03-01, 03-02 | Never invent information | ✓ SATISFIED | Prompt constraints + Zod gates + empty-body rejection |
| CANON-09 | Phase 1 | Store original, raw, canonical, metadata, sections | ✓ SATISFIED | Baseline schema + canonicalize persistence path |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX in phase files | — | Clean |
| `src/lib/server/generateFromFile/*` | — | Legacy v1 canonical extraction path is absent from current source tree | ℹ️ Info | Verification note is stale; current canonical path is `src/lib/pipeline/canonicalize.ts` |
| `canonicalize.ts` | 329–360 | Section delete+insert without DB transaction | ⚠️ Warning | Partial failure after delete could lose sections; low probability |

### Human Verification Required

### 1. End-to-end ingest → canonicalize → preview

**Test:** Upload or paste source material on `/edit/new/quiz`, complete ingest, observe `/sets/{id}/source`  
**Expected:** Auto-canonicalize progress → preview with markdown, metadata chips, section TOC (if ≥2 sections), disabled mode CTA  
**Why human:** Requires live Supabase + AI provider + MarkItDown pipeline

### 2. Metadata persistence after real canonicalize

**Test:** Inspect `canonical_documents.metadata` and `study_sets` after successful run  
**Expected:** `prompt_version: "1.0"`, `canonicalization_status: "ok"`, `language`, `content_type`, `pipeline_stage: "canonical"`  
**Why human:** Field population depends on LLM output

### 3. CANON-01–07 output quality on representative documents

**Test:** Canonicalize theory doc, exam doc with Q&A, and doc with tables/formulas  
**Expected:** Noise reduced, structure preserved, Q&A extracted where present, no invented content  
**Why human:** Builder delegates semantics to LLM; grep cannot assess quality

### 4. Failure path UX

**Test:** Run with AI env unset or invalid; click retry after configuring  
**Expected:** Error card + toast; metadata `canonicalization_status: "failed"`; prior canonical data intact  
**Why human:** Runtime error handling and UI states

### Gaps Summary

No **blocker** gaps found. All Phase 3 deliverables exist, are substantive, and are wired:

- **Builder:** `runCanonicalize` + locked prompt + Zod + repair retry
- **Persistence:** canonical_markdown, sections with `section_key`, metadata merge, `pipeline_stage` update
- **Preview UI:** Full page with auto-canonicalize, viewer, chips, TOC, Phase 4 placeholder

Three roadmap success criteria (SC1–SC3) depend on LLM output quality and require human E2E verification before declaring full goal achievement. Implementation architecture note: canonicalize uses server env `AI_PROVIDER_URL`/`AI_PROVIDER_KEY` via `postChatCompletionAssistantText`, not browser `/api/ai/forward` (CONTEXT D-01 deviation; functional with `.env.example` vars).

---

_Verified: 2026-07-25T06:42:00Z_  
_Verifier: Claude (gsd-verifier)_
