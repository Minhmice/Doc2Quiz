---
phase: 05-flashcards-e2e
plan: 04
subsystem: ui
tags: [flashcards, wizard, dashboard, mistakes-drill, vitest, nextjs]

# Dependency graph
requires:
  - phase: 05-02
    provides: POST /flashcards/generate API and runFlashcardGenerate
  - phase: 05-03
    provides: getApprovedFlashcardBank, postFlashcardGenerate client
provides:
  - FlashcardSetupWizard + FlashcardGenerateProgressCard inline on canonical preview
  - Enabled Flashcards mode selection and flashcards resume strip
  - End-to-end flashcard path source → generate → practice → done
  - Dashboard Start flashcards + Drill mistakes CTAs
affects: [05-04-human-e2e-checkpoint, phase-5-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "contentKindIntent isolates quiz vs flashcard generation UI on source page"
    - "FlashcardGenerateProgressCard mirrors QuizGenerateProgressCard shell"
    - "Mode-specific resume strips in CanonicalModeSelectionFooter (quiz vs flashcards)"

key-files:
  created:
    - src/components/flashcards/FlashcardSetupWizard.tsx
    - src/components/flashcards/FlashcardGenerateProgressCard.tsx
  modified:
    - src/components/canonical/CanonicalModeSelectionFooter.tsx
    - src/app/(app)/sets/[id]/source/page.tsx
    - src/components/flashcards/FlashcardSession.tsx
    - src/app/(app)/flashcards/[id]/done/page.tsx
    - src/lib/ui/studySetActionLabels.ts
    - src/components/dashboard/DashboardStudySetCard.tsx
    - src/app/(app)/quiz/[id]/done/page.tsx
    - src/lib/client/activityTracking.ts

key-decisions:
  - "Inline wizard on source page (no modal) per 05-UI-SPEC"
  - "Post-generate redirect skips edit workspace — goes straight to /flashcards/[id]"
  - "Flashcards resume strip takes precedence over quiz strip when pipeline_stage is flashcards"

patterns-established:
  - "Wizard maps learningGoal/coverage/amount to flashcardGenerateBodySchema enums only (D-05)"

requirements-completed: [MODE-01, FLASH-01, FLASH-02, FLASH-03, FLASH-04, FLASH-05, FLASH-06, FLASH-07, CORE-MIST-01]

# Metrics
duration: 18min
completed: 2026-07-25
---

# Phase 5 Plan 04: Flashcards E2E UI Summary

**Inline 3-step flashcard wizard on canonical preview, generation progress, practice session wiring, dashboard re-entry, and mistakes drill CTAs — automated gates green; human E2E checkpoint pending**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-25T07:08:00Z
- **Completed:** 2026-07-25T07:26:00Z
- **Tasks:** 3 auto complete, 1 human checkpoint pending
- **Files modified:** 10

## Accomplishments

- Enabled **Flashcards** CTA on canonical preview with mode-specific resume strip when cards exist
- **FlashcardSetupWizard** (goal → coverage → amount) posts validated body via `postFlashcardGenerate`
- **FlashcardGenerateProgressCard** shows recommended/generated counts and detected format
- Source page state machine: wizard → generating → redirect `/flashcards/[id]` (FLASH-07)
- **FlashcardSession** loads Supabase bank; Done routes to `/flashcards/[id]/done`
- Dashboard **Start flashcards** and **Drill mistakes** labels wired per UI-SPEC
- Quiz done page shows **Drill mistakes** as first CTA when `hasMistakesForStudySet`
- `npm test run`, `npm run typecheck`, `npm run build` all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Flashcard wizard + progress card + enable footer** - `76f6b54` (feat)
2. **Task 2: Source page flashcard flow + FlashcardSession + done page** - `0706f9b` (feat)
3. **Task 3: Dashboard CTAs + mistakes drill verify** - `cf3169b` (feat)

## Files Created/Modified

- `src/components/flashcards/FlashcardSetupWizard.tsx` - 3-step inline wizard (FLASH-01–03)
- `src/components/flashcards/FlashcardGenerateProgressCard.tsx` - Generation progress UI (FLASH-04)
- `src/components/canonical/CanonicalModeSelectionFooter.tsx` - Enabled Flashcards + resume strip (D-01, D-02)
- `src/app/(app)/sets/[id]/source/page.tsx` - Flashcard state machine alongside quiz path
- `src/components/flashcards/FlashcardSession.tsx` - Real bank load, empty state, done routing (D-15, D-16)
- `src/app/(app)/flashcards/[id]/done/page.tsx` - Session complete summary with shadcn CTAs
- `src/lib/ui/studySetActionLabels.ts` - `Start flashcards` primary label (D-17)
- `src/components/dashboard/DashboardStudySetCard.tsx` - `Drill mistakes` link, quiz-only visibility (D-19)
- `src/app/(app)/quiz/[id]/done/page.tsx` - Mistakes drill first CTA (CORE-MIST-01)
- `src/lib/client/activityTracking.ts` - Dev `console.error` on Supabase write failures (D-18)

## Decisions Made

- Inline wizard on `/sets/[id]/source` replaces markdown+TOC while active (matches Phase 4 quiz generate swap)
- No re-generate / AlertDialog in this plan — resume strip offers Start flashcards only
- Quiz done page shows disabled Drill mistakes hint when no mistakes (title tooltip per UI-SPEC)

## Deviations from Plan

None - plan executed exactly as written for Tasks 1–3.

## Pending Human Checkpoint (Task 4)

**Status:** Awaiting user approval (`approved` resume signal)

Manual E2E verification required per 05-04-PLAN.md Task 4:

1. Confirm automated gates green (done: 176 vitest tests, typecheck, build)
2. Flashcards express path: canonical → Flashcards → wizard → generate → practice → done
3. Quiz regression on quiz set unchanged
4. Mistakes drill: dashboard + quiz done + `?review=mistakes` filter
5. Cross-mode isolation: flashcard and quiz sets coexist without wrong CTAs

## Auth Gates

None.

## Test Results

```
npm test run — 24 files, 176 tests passed
npm run typecheck — clean
npm run build — Next.js 16.2.11 production build succeeded
```

## Next Phase Readiness

- Human checkpoint (Task 4) blocks D-21 milestone sign-off
- After approval, Phase 5 verification can mark complete

---
*Phase: 05-flashcards-e2e*
*Completed: 2026-07-25 (automated tasks)*

## Self-Check: PASSED

- FOUND: src/components/flashcards/FlashcardSetupWizard.tsx
- FOUND: src/components/flashcards/FlashcardGenerateProgressCard.tsx
- FOUND: src/components/canonical/CanonicalModeSelectionFooter.tsx (onSelectFlashcards)
- FOUND: src/app/(app)/sets/[id]/source/page.tsx (postFlashcardGenerate)
- FOUND: commit 76f6b54
- FOUND: commit 0706f9b
- FOUND: commit cf3169b
