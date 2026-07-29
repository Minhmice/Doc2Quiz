---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 05
subsystem: api
tags: [flashcards, multi-source, provenance, snapshots, bridge, workspace, zod]

requires:
  - phase: 09-04
    provides: buildOutputSourceSnapshots, create_learning_output patterns, workspace quiz route parity
  - phase: 09-01
    provides: create_learning_output RPC returning bridgeStudySetId/outputId
provides:
  - runMultiSourceFlashcardGenerate (validate before AI, create_learning_output only, no cross-mode deletes)
  - POST /api/workspaces/[workspaceId]/outputs/flashcards
  - Legacy study-set flashcard generate adapter without destructive cleanup
  - Client posts canonicalVersionIds only with flashcard selection persistence helpers
affects:
  - 09-06 workspace detail flashcard entry
  - 09-08 flashcard legacy adapters / soft-delete study

tech-stack:
  added: []
  patterns:
    - Flashcard create_learning_output uses p_kind flashcards with front/back items only
    - Never delete approved_questions or prior approved_flashcards on generate
    - D-03: preserve prior flashcard selection; latest-completed default only when none exists
    - Selection localStorage key doc2quiz:flashcard-source-selection:{workspaceId}

key-files:
  created:
    - src/lib/pipeline/flashcardMultiSourceGenerate.ts
    - src/lib/pipeline/flashcardMultiSourceGenerate.test.ts
    - src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.ts
    - src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.test.ts
  modified:
    - src/lib/pipeline/flashcardGenerate.ts
    - src/lib/pipeline/mapFlashcardOutputToRows.ts
    - src/lib/workspaces/schemas.ts
    - src/app/api/study-sets/[id]/flashcards/generate/route.ts
    - src/app/api/study-sets/[id]/flashcards/generate/route.test.ts
    - src/lib/client/flashcardGenerateStudySet.ts
    - src/lib/client/flashcardGenerateStudySet.test.ts
    - src/components/flashcards/FlashcardGenerateProgressCard.tsx
    - src/app/api/usage/route.ts

key-decisions:
  - "Quota for workspace route: weekly preflight via getUserUsage, then reserve/commit on returned bridgeStudySetId"
  - "Legacy adapter resolves frozen snapshot IDs when body omits selection; never mutable latest after selection"
  - "Selection UI lives on FlashcardGenerateProgressCard (quiz parallel), not FlashcardActions practice nav"

patterns-established:
  - "Workspace flashcard body: workspaceFlashcardGenerateBodySchema.strict() — IDs + goal/coverage/amount only"
  - "Success payload includes studySetId/bridgeStudySetId/outputId for setId consumers"
  - "Selection localStorage key doc2quiz:flashcard-source-selection:{workspaceId}"

requirements-completed: [WORK-06, WORK-07, WORK-08, WORK-09]

duration: 25min
completed: 2026-07-30
---

# Phase 09: Plan 05 Summary

**Multi-source flashcard generation with frozen output snapshots, workspace flashcard API, legacy bridge adapter, and explicit canonical-version selection client**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T06:35:00+07:00
- **Completed:** 2026-07-30T06:43:00+07:00
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- `runMultiSourceFlashcardGenerate` validates editor + completed in-workspace sources before AI, persists via `create_learning_output` only (`p_kind: flashcards`)
- Coverage section keys must exist on selected sources; mismatched keys rejected before AI
- Workspace flashcard route + legacy set-ID adapter return output-specific bridge IDs; never delete quiz or prior flashcard banks
- Client posts IDs + wizard options only; progress card selects completed versions with D-03 defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: multi-source flashcard generation and routes** - `e766b33` (feat)
2. **Task 2: flashcard source selection client and UI** - `bf3ecfb` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/pipeline/flashcardMultiSourceGenerate.ts` — workspace-native flashcard generator
- `src/app/api/workspaces/.../outputs/flashcards/route.ts` — authoritative flashcard API
- `src/app/api/study-sets/.../flashcards/generate/route.ts` — narrow non-destructive adapter
- `src/lib/client/flashcardGenerateStudySet.ts` — workspace + legacy clients, selection helpers
- `FlashcardGenerateProgressCard.tsx` — explicit multi-source selection UI

## Decisions Made
- Quota keys to returned bridge study set after `create_learning_output`; weekly preflight uses `getUserUsage` before AI
- Legacy adapter uses existing output snapshots when `canonicalVersionIds` omitted; refuses mutable latest invent
- Exported shared flashcard helpers from `flashcardGenerate.ts` for reuse (minimal surface)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Adaptation] Selection UI on FlashcardGenerateProgressCard, not FlashcardActions**
- **Found during:** Task 2
- **Issue:** Plan listed `FlashcardActions.tsx`, but that component is practice prev/next navigation; quiz parallel is `QuizGenerateProgressCard`
- **Fix:** Wired selection into `FlashcardGenerateProgressCard` with selecting/quota_blocked states
- **Files modified:** `FlashcardGenerateProgressCard.tsx`, `flashcardGenerateStudySet.ts`
- **Verification:** typecheck + client tests 11/11
- **Committed in:** `bf3ecfb`

**2. [Rule — Blocking] Usage route getUserUsage deep instantiation**
- **Found during:** Task 2 typecheck
- **Issue:** `tsc` TS2589 on `getUserUsage({ ...auth })` blocked plan verify
- **Fix:** Explicit `supabase as never` + `Promise<Response>` return (same class as 09-04 workspace quiz)
- **Files modified:** `usage/route.ts`, `usage/route.test.ts`
- **Verification:** `npm run typecheck` clean
- **Committed in:** `bf3ecfb`

---

**Total deviations:** 2 auto-fixed (1 adaptation, 1 blocking)
**Impact on plan:** Correct UI surface for selection; typecheck unblocked. No scope creep into Phase 10.

## Self-Check

- [x] `src/lib/pipeline/flashcardMultiSourceGenerate.ts` exists
- [x] `src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.ts` exists
- [x] Legacy flashcard generate route delegates to multi-source (no cross-mode deletes)
- [x] Client posts `canonicalVersionIds` only on workspace path
- [x] Task commits present on branch (`e766b33`, `bf3ecfb`)
- [x] Tests: 24/24 pipeline+workspace route; 11/11 client; legacy adapter 11/11 (Task 1 verify set 24/24)
- [x] `npm run typecheck` passes

**Self-Check: PASSED**

## Issues Encountered
- Dirty WIP across many UI files; restored flashcard client/actions baselines before editing; did not stage unrelated WIP
- Interleaved `docs(08-07)` commit landed between Task 1 and Task 2 on the same branch

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 09-06 workspace detail to feed completed version options into flashcard selection UI
- Bridge study set ID returned for existing flashcard review/practice navigation
- Soft-delete / historic snapshot study covered by later plans (09-08)

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
