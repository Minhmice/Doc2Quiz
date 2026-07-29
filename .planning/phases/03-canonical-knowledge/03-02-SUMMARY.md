---
phase: 03-canonical-knowledge
plan: 02
subsystem: api
tags: [zod, vitest, supabase, openai, canonicalize, llm]

requires:
  - phase: 03-canonical-knowledge
    plan: 01
    provides: prompt loader, Zod schemas, server AI helpers, section_key migration
provides:
  - runCanonicalize orchestration with LLM + validation + persistence
  - POST /api/study-sets/[id]/canonicalize endpoint
  - GET /api/study-sets/[id]/canonical read-only preview endpoint
affects: [03-03, canonical preview UI, quiz pipeline]

tech-stack:
  added: []
  patterns: [stripJsonFence + repair retry, validate-before-delete sections, failure metadata only]

key-files:
  created:
    - src/lib/pipeline/canonicalize.ts
    - src/lib/pipeline/canonicalize.test.ts
    - src/app/api/study-sets/[id]/canonical/route.ts
    - src/app/api/study-sets/[id]/canonicalize/route.test.ts
  modified:
    - src/app/api/study-sets/[id]/canonicalize/route.ts

key-decisions:
  - "runCanonicalize accepts auth.user for resolveUserAiTier model routing"
  - "120k raw_markdown truncation adds warning to merged metadata"
  - "Failure handler updates metadata only — no section delete or canonical_markdown overwrite"

patterns-established:
  - "Pattern: LLM + Zod validation completes before any canonical_sections delete"
  - "Pattern: persistCanonicalizationFailure merges canonicalization_status=failed only"
  - "Pattern: GET /canonical returns camelCase preview payload with ordered sections"

requirements-completed: [CANON-01, CANON-02, CANON-03, CANON-04, CANON-05, CANON-06, CANON-07, CANON-08]

duration: 12min
completed: 2026-07-25
---

# Phase 3 Plan 02: Canonicalize Service Summary

**LLM-powered canonical knowledge builder with locked prompt, Zod validation, Supabase persistence, and POST/GET API routes**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T06:32:00Z
- **Completed:** 2026-07-25T06:44:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Implemented `runCanonicalize()` — pre-flight validation, locked prompt LLM call, stripJsonFence + repair retry, D-16 field mapping
- Success path: updates `canonical_markdown`, replaces `canonical_sections` with `section_key`, merges metadata, sets `pipeline_stage=canonical`
- Failure path: sets `canonicalization_status=failed` without deleting sections or overwriting canonical data (D-06)
- Replaced 501 stub on POST `/canonicalize`; added GET `/canonical` read-only preview endpoint
- 11 unit/integration tests passing; typecheck clean

## Task Commits

1. **Task 1: runCanonicalize service** — `1559509` (test), `04e58e7` (feat)
2. **Task 2: POST canonicalize + GET canonical routes** — `875b484` (feat)
3. **Task 3: Route integration tests** — `908a3f5` (test)

## Files Created/Modified

- `src/lib/pipeline/canonicalize.ts` — runCanonicalize, error classes, stripJsonFence, D-16 mapping
- `src/lib/pipeline/canonicalize.test.ts` — validation, success, failure persistence tests
- `src/app/api/study-sets/[id]/canonicalize/route.ts` — POST handler delegating to runCanonicalize
- `src/app/api/study-sets/[id]/canonical/route.ts` — GET preview payload
- `src/app/api/study-sets/[id]/canonicalize/route.test.ts` — auth, 404, 400, 422, 200 paths

## Decisions Made

- `runCanonicalize` takes `user` param for `resolveUserAiTier` — route passes `auth.user`
- Raw markdown truncated at 120,000 chars with warning appended to metadata
- Route error mapping: validation → 400, canonicalize → 422 (including AI-not-configured via CanonicalizeError)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Canonicalize requires AI provider env vars when running against a live server:
- `AI_PROVIDER_URL`
- `AI_PROVIDER_KEY`

## Next Phase Readiness

- 03-03 (canonical preview UI) unblocked — GET `/canonical` returns preview payload
- Manual smoke test: POST `/canonicalize` on study set with `pipeline_stage=raw` when AI env configured

## Self-Check: PASSED

- FOUND: src/lib/pipeline/canonicalize.ts
- FOUND: src/lib/pipeline/canonicalize.test.ts
- FOUND: src/app/api/study-sets/[id]/canonical/route.ts
- FOUND: src/app/api/study-sets/[id]/canonicalize/route.test.ts
- FOUND: 1559509
- FOUND: 04e58e7
- FOUND: 875b484
- FOUND: 908a3f5

---
*Phase: 03-canonical-knowledge*
*Completed: 2026-07-25*
