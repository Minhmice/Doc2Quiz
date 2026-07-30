---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 04
subsystem: api
tags: [quiz, multi-source, provenance, snapshots, bridge, workspace, zod]

requires:
  - phase: 09-01
    provides: create_learning_output RPC returning bridgeStudySetId/outputId
  - phase: 09-03
    provides: completed canonical versions and sections for selection
provides:
  - buildOutputSourceSnapshots with secret-free frozen provenance
  - runMultiSourceQuizGenerate (validate before AI, create_learning_output only)
  - POST /api/workspaces/[workspaceId]/outputs/quiz
  - Legacy study-set quiz generate adapter without destructive replace
  - Client posts canonicalVersionIds only with selection persistence helpers
affects:
  - 09-05 flashcard multi-source generation (reuse snapshots + RPC)
  - 09-06 workspace detail quiz entry
  - 09-07/09-08 broader legacy adapters

tech-stack:
  added: []
  patterns:
    - Client posts canonical version IDs only; server loads markdown/checksums
    - create_learning_output allocates one output-specific bridge study_sets row
    - Never call replace_quiz_questions on workspace-native path
    - D-03: preserve prior selection; latest-completed default only when none exists

key-files:
  created:
    - src/lib/provenance/outputSnapshot.ts
    - src/lib/provenance/outputSnapshot.test.ts
    - src/lib/pipeline/multiSourceGenerate.ts
    - src/lib/pipeline/multiSourceGenerate.test.ts
    - src/app/api/workspaces/[workspaceId]/outputs/quiz/route.ts
    - src/app/api/workspaces/[workspaceId]/outputs/quiz/route.test.ts
  modified:
    - src/lib/pipeline/mapQuizOutputToRows.ts
    - src/lib/pipeline/quizGenerate.ts
    - src/lib/workspaces/schemas.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.ts
    - src/app/api/study-sets/[id]/quiz/generate/route.test.ts
    - src/lib/client/quizGenerateStudySet.ts
    - src/lib/client/quizGenerateStudySet.test.ts
    - src/components/quiz/QuizGenerateProgressCard.tsx

key-decisions:
  - "Quota for workspace route: weekly preflight via getUserUsage, then reserve/commit on returned bridgeStudySetId"
  - "Legacy adapter resolves frozen snapshot IDs when body omits selection; never mutable latest after selection"
  - "Exported quizGenerate helpers for reuse instead of duplicating candidate builder"

patterns-established:
  - "Workspace quiz body: workspaceQuizGenerateBodySchema.strict() — IDs + optional count only"
  - "Success payload includes studySetId/bridgeStudySetId/outputId for setId consumers"
  - "Selection localStorage key doc2quiz:quiz-source-selection:{workspaceId}"

requirements-completed: [WORK-06, WORK-07, WORK-08, WORK-09]

duration: 35min
completed: 2026-07-30
---

# Phase 09: Plan 04 Summary

**Multi-source quiz generation with frozen output snapshots, workspace quiz API, legacy bridge adapter, and explicit canonical-version selection client**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-30T06:20:00+07:00
- **Completed:** 2026-07-30T06:33:00+07:00
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- `buildOutputSourceSnapshots` freezes checksums, markdown, ordered sections, and redacted model/prompt/parser settings
- `runMultiSourceQuizGenerate` validates editor + completed in-workspace sources before AI, persists via `create_learning_output` only
- Workspace quiz route + legacy set-ID adapter return output-specific bridge IDs for quota/session/mistake consumers
- Client posts IDs only; progress card selects completed versions grouped by document with D-03 defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: frozen multi-source snapshot contract** - `0decba3` (feat)
2. **Task 2: workspace quiz route and legacy adapter** - `fe62058` (feat)
3. **Task 3: quiz source selection client** - `34dcc92` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/provenance/outputSnapshot.ts` — dedupe-ordered frozen snapshots
- `src/lib/pipeline/multiSourceGenerate.ts` — workspace-native quiz generator
- `src/app/api/workspaces/.../outputs/quiz/route.ts` — authoritative quiz API
- `src/app/api/study-sets/.../quiz/generate/route.ts` — narrow non-destructive adapter
- `src/lib/client/quizGenerateStudySet.ts` — workspace + legacy clients, selection helpers
- `QuizGenerateProgressCard.tsx` — explicit multi-source selection UI

## Decisions Made
- Quota keys to returned bridge study set after `create_learning_output`; weekly preflight uses `getUserUsage` before AI
- Legacy adapter uses existing output snapshots when `canonicalVersionIds` omitted; refuses mutable latest invent
- Exported shared quiz candidate helpers from `quizGenerate.ts` for reuse (minimal surface)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Adaptation] Export quizGenerate helpers instead of duplicating builder**
- **Found during:** Task 1
- **Issue:** Candidate/AI helpers were private; plan forbade destructive path but needed reuse
- **Fix:** Exported `buildQuestionCandidates`, `callQuizGenerator`, `validateAtomicFactArtifact`, `truncateCanonicalMarkdown`, `resolveGenerationMode`
- **Files modified:** `quizGenerate.ts`, `multiSourceGenerate.ts`
- **Verification:** multiSourceGenerate tests 5/5
- **Committed in:** `0decba3`

**2. [Rule — Blocking] MultiSource error classes must not narrow `name` literal**
- **Found during:** Task 3 typecheck
- **Issue:** Subclassing `QuizGenerate*Error` with a different `name` failed TS2416
- **Fix:** Standalone error classes with matching status/code shape
- **Files modified:** `multiSourceGenerate.ts`
- **Verification:** `npm run typecheck` clean
- **Committed in:** `34dcc92`

**3. [Rule — Adaptation] Cast supabase for getUserUsage preflight**
- **Found during:** Task 3 typecheck
- **Issue:** Full SupabaseClient caused TS2589 deep instantiation in workspace quiz route
- **Fix:** `auth.supabase as never` at getUserUsage call site (same class of issue as usage route)
- **Files modified:** workspace quiz `route.ts`
- **Verification:** typecheck + route tests pass
- **Committed in:** `34dcc92`

---

**Total deviations:** 3 auto-fixed (2 adaptation, 1 blocking)
**Impact on plan:** Required for reuse and typecheck; no scope creep into flashcards/09-05.

## Self-Check

- [x] `src/lib/provenance/outputSnapshot.ts` exists
- [x] `src/lib/pipeline/multiSourceGenerate.ts` exists
- [x] `src/app/api/workspaces/[workspaceId]/outputs/quiz/route.ts` exists
- [x] Legacy quiz generate route delegates to multi-source (no `replace_quiz_questions`)
- [x] Client posts `canonicalVersionIds` only on workspace path
- [x] Task commits present on branch (`0decba3`, `fe62058`, `34dcc92`)
- [x] Tests: 38/38 in plan verify set (outputSnapshot, multiSourceGenerate, client, both routes)
- [x] `npm run typecheck` passes

**Self-Check: PASSED**

## Issues Encountered
- Dirty WIP on `QuizGenerateProgressCard` / quiz page from other work; restored HEAD baselines and applied only 09-04 selection changes
- Restored conflicting WIP quiz page to HEAD so typecheck stays green without staging unrelated UI

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 09-05 flashcard multi-source (reuse `buildOutputSourceSnapshots` + `create_learning_output`)
- Workspace detail (09-06) can feed completed version options into selection UI
- Bridge study set ID returned for existing review/practice navigation

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
