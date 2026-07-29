---
phase: 04-quiz-pipeline
plan: 02
subsystem: api
tags: [vitest, llm, quiz-generation, supabase, openai-compatible]

requires:
  - phase: 04-quiz-pipeline
    provides: quizPrompt.ts, quizSchemas.ts, quiz_generator_v1.json (04-01)
  - phase: 03-canonical-knowledge
    provides: canonical_documents, canonical_sections, runCanonicalize pattern
provides:
  - runQuizGenerate orchestration with persist-before-response
  - dedupeAndCapQuestions QUIZ-04 post-processing
  - mapQuizOutputToRows for approved_questions inserts
  - POST /api/study-sets/[id]/quiz/generate (replaces 501 stub)
affects:
  - 04-03-quiz-client-db
  - 04-04-review-practice-wiring

tech-stack:
  added: []
  patterns:
    - "Replace-all approved_questions: DELETE then bulk INSERT on each generate"
    - "QuizGenerateError.statusCode 503 for AI-not-configured path"
    - "Canonical-only LLM inputs — never raw_markdown (D-03)"

key-files:
  created:
    - src/lib/pipeline/dedupeAndCapQuestions.ts
    - src/lib/pipeline/dedupeAndCapQuestions.test.ts
    - src/lib/pipeline/mapQuizOutputToRows.ts
    - src/lib/pipeline/mapQuizOutputToRows.test.ts
    - src/lib/pipeline/quizGenerate.ts
    - src/lib/pipeline/quizGenerate.test.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.test.ts
  modified:
    - src/app/api/study-sets/[id]/quiz/generate/route.ts

key-decisions:
  - "runQuizGenerate accepts user param for resolveUserAiTier (mirrors runCanonicalize)"
  - "Route checks isAiProcessingConfigured before delegating — returns 503 without LLM call"
  - "Thin content warning when uniqueConcepts.length < 3 or generated < recommended"

patterns-established:
  - "dedupeAndCapQuestions: case-insensitive concept dedupe, cap min(recommended, concepts, questions, override, 40)"
  - "quizGenerate mirrors canonicalize: stripJsonFence, one repair retry, no partial DB writes on LLM failure"

requirements-completed: [QUIZ-01, QUIZ-02, QUIZ-03, QUIZ-04, QUIZ-05]

duration: 12min
completed: 2026-07-25
---

# Phase 4 Plan 02: Server Quiz Generation Summary

**runQuizGenerate with canonical-only LLM input, QUIZ-04 dedupe/cap, approved_questions replace-all persist, and operational POST /quiz/generate**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-25T06:43:00Z
- **Completed:** 2026-07-25T06:55:00Z
- **Tasks:** 3
- **Files modified:** 9 created, 1 modified

## Accomplishments

- Implemented `dedupeAndCapQuestions` and `mapQuizOutputToRows` with 7 unit tests covering QUIZ-04 edge cases
- Built `runQuizGenerate` orchestration: canonical pre-flight, single LLM call + Zod repair retry, delete-then-insert persist, pipeline_stage=quiz
- Replaced 501 stub with POST route returning `{ recommendedCount, generatedCount, questionIds }` (D-12)
- 21 tests pass; typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: dedupeAndCapQuestions + mapQuizOutputToRows + tests** — `5b336cf` (feat)
2. **Task 2: runQuizGenerate service** — `f6bda76` (feat)
3. **Task 3: Replace 501 POST /quiz/generate route + tests** — `3368dea` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `src/lib/pipeline/dedupeAndCapQuestions.ts` — QUIZ-04 dedupe by concept_id, cap count, thin-content warnings
- `src/lib/pipeline/mapQuizOutputToRows.ts` — LLM question → approved_questions row with source jsonb
- `src/lib/pipeline/quizGenerate.ts` — `runQuizGenerate`, error classes, canonical-only LLM flow
- `src/app/api/study-sets/[id]/quiz/generate/route.ts` — Auth, body parse, error mapping, D-12 response
- `*.test.ts` — Unit/route tests (21 total for this plan)

## Decisions Made

- Added `user` param to `runQuizGenerate` (canonicalize pattern) for `resolveUserAiTier`
- Route-level `isAiProcessingConfigured()` guard returns 503 before calling service
- `QuizGenerateError` carries `statusCode` (503 for AI-not-configured, 422 default)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

**AI provider env vars required for live generation:**
- `AI_PROVIDER_URL` — OpenAI-compatible base URL
- `AI_PROVIDER_KEY` — API key

Route returns 503 `ai_not_configured` when unset. Unit tests mock LLM/DB — no live AI needed for CI.

## Next Phase Readiness

- 04-03 client `studySetDb` can load persisted `approved_questions` from generate runs
- 04-04 can wire ReviewSection and QuizSession to Supabase-backed bank
- Live E2E generate requires AI env configuration

## Self-Check: PASSED

- FOUND: src/lib/pipeline/dedupeAndCapQuestions.ts
- FOUND: src/lib/pipeline/mapQuizOutputToRows.ts
- FOUND: src/lib/pipeline/quizGenerate.ts
- FOUND: src/app/api/study-sets/[id]/quiz/generate/route.ts
- FOUND: 5b336cf
- FOUND: f6bda76
- FOUND: 3368dea

---
*Phase: 04-quiz-pipeline*
*Completed: 2026-07-25*
