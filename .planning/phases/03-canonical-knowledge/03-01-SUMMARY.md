---
phase: 03-canonical-knowledge
plan: 01
subsystem: api
tags: [zod, vitest, supabase, openai, canonical-prompt]

requires:
  - phase: 02-input-markitdown
    provides: raw_markdown in canonical_documents, pipeline_stage=raw
provides:
  - Restored server AI trio (postChatCompletionAssistantText, getAiProcessingConfig)
  - section_key migration for stable sec_001 IDs
  - Runtime prompt loader from canonical_builder_v1.json
  - Zod schema mirroring locked output_schema (CANON-08 validation gates)
affects: [03-02, canonicalize service, LLM builder]

tech-stack:
  added: []
  patterns: [runtime JSON prompt load, template substitution, Zod output validation]

key-files:
  created:
    - supabase/migrations/20260725130000_canonical_section_key.sql
    - src/lib/pipeline/canonicalPrompt.ts
    - src/lib/pipeline/canonicalSchemas.ts
    - src/lib/pipeline/canonicalPrompt.test.ts
    - src/lib/pipeline/canonicalSchemas.test.ts
  modified:
    - src/lib/server/openAiChatCompletion.ts (restored from git HEAD)
    - src/lib/server/ai-processing-config.ts (restored from git HEAD)
    - src/lib/server/resolveUserAiTier.ts (restored from git HEAD)
    - src/lib/ai/openAiEndpoint.ts (restored dependency)

key-decisions:
  - "filename validation uses min(1) not endsWith('.md') per plan — example in prompt is illustrative"
  - "canonical_markdown requires min(1) for CANON-08 empty-body rejection"
  - "Prompt text lives only in JSON; system message assembled from spec at runtime"

patterns-established:
  - "Pattern: loadCanonicalPrompt caches prompt/canonical_builder_v1.json per process"
  - "Pattern: buildCanonicalMessages returns { system, user } with JSON-stringified substituted input"
  - "Pattern: canonicalBuilderOutputSchema validates LLM output before any DB write path"

requirements-completed: [CANON-08]

duration: 15min
completed: 2026-07-25
---

# Phase 3 Plan 01: Canonical Foundation Summary

**Runtime prompt loader with Zod output validation, section_key migration, and restored server AI helpers for Phase 3 LLM calls**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-25T06:29:00Z
- **Completed:** 2026-07-25T06:44:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Restored minimal server AI infrastructure from git HEAD (`openAiChatCompletion`, `ai-processing-config`, `resolveUserAiTier` + `openAiEndpoint` dependency)
- Added `section_key` column migration with partial unique index per document (D-17)
- Implemented `canonicalPrompt.ts` loading locked JSON at runtime with template substitution (D-13, D-14)
- Implemented `canonicalSchemas.ts` Zod mirror of `output_schema` with CANON-08 validation gates
- 12 unit tests passing (vitest)

## Task Commits

1. **Task 1: Restore minimal server AI infrastructure** — no commit (files restored from git HEAD, identical to HEAD)
2. **Task 2: Add section_key migration** — `cab6990` (feat)
3. **Task 3: Prompt loader + Zod schemas** — `cbf665f` (test), `8e34ceb` (feat)

## Files Created/Modified

- `supabase/migrations/20260725130000_canonical_section_key.sql` — section_key column + unique index
- `src/lib/pipeline/canonicalPrompt.ts` — loadCanonicalPrompt, substituteTemplate, buildCanonicalMessages
- `src/lib/pipeline/canonicalSchemas.ts` — canonicalBuilderOutputSchema + types
- `src/lib/pipeline/canonicalPrompt.test.ts` — prompt loader and message assembly tests
- `src/lib/pipeline/canonicalSchemas.test.ts` — schema validation tests
- `src/lib/server/openAiChatCompletion.ts` — restored from HEAD
- `src/lib/server/ai-processing-config.ts` — restored from HEAD
- `src/lib/server/resolveUserAiTier.ts` — restored from HEAD
- `src/lib/ai/openAiEndpoint.ts` — restored dependency for ai-processing-config

## Decisions Made

- filename uses `z.string().min(1)` not `.endsWith(".md")` — plan explicitly allows non-.md filenames
- `canonical_markdown` uses `.min(1)` to reject empty cleaned bodies
- Restored `openAiEndpoint.ts` alongside AI trio — required import for `getChatCompletionsUrl`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored openAiEndpoint.ts dependency**
- **Found during:** Task 1 (AI infrastructure restore)
- **Issue:** `ai-processing-config.ts` imports `@/lib/ai/openAiEndpoint` which was also missing from working tree
- **Fix:** `git checkout HEAD -- src/lib/ai/openAiEndpoint.ts`
- **Files modified:** `src/lib/ai/openAiEndpoint.ts`
- **Verification:** `npm run typecheck` passes

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal dependency restore required for typecheck; no scope creep.

## Issues Encountered

None

## User Setup Required

None — no external service configuration required for this plan (AI env vars needed only when canonicalize runs in 03-02).

## Next Phase Readiness

- Wave 2 (03-02) unblocked: canonicalize service can import prompt loader, schemas, and `postChatCompletionAssistantText`
- Migration ready for `supabase db push` / remote apply
- CANON-01–07 builder logic and API routes remain in 03-02

## Self-Check: PASSED

- FOUND: supabase/migrations/20260725130000_canonical_section_key.sql
- FOUND: src/lib/pipeline/canonicalPrompt.ts
- FOUND: src/lib/pipeline/canonicalSchemas.ts
- FOUND: src/lib/server/openAiChatCompletion.ts
- FOUND: cab6990
- FOUND: cbf665f
- FOUND: 8e34ceb

---
*Phase: 03-canonical-knowledge*
*Completed: 2026-07-25*
