---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 05
subsystem: ui
tags: [react, localization, accessibility, quiz, flashcards]
requires:
  - phase: 06-02
    provides: Hydration-safe locale provider and typed EN/VI catalogs
  - phase: 06-03
    provides: Semantic-event contextual slang composition
provides:
  - Bilingual quiz practice, feedback, progress, and result chrome
  - Bilingual flashcard practice, navigation, announcements, and completion chrome
  - Event-stable safe correct, wrong, empty, loading, and result personality copy
affects: [06-07, practice, results, locale-coverage]
tech-stack:
  added: []
  patterns: [typed practice catalog, locale-aware visible number formatting, semantic-event feedback slang]
key-files:
  created: []
  modified: [src/components/quiz/QuizSession.tsx, src/app/(app)/quiz/[id]/page.tsx, src/app/(app)/quiz/[id]/done/page.tsx, src/components/flashcards/FlashcardSession.tsx, src/components/flashcards/FlashcardActions.tsx, src/components/flashcards/FlashcardInteractionHints.tsx, src/app/(app)/flashcards/[id]/page.tsx, src/app/(app)/flashcards/[id]/done/page.tsx, src/lib/locale/messages.ts, src/lib/locale/types.ts]
key-decisions:
  - "Generated questions, explanations, flashcard faces, and study-set titles remain untouched data while surrounding practice chrome localizes."
  - "Correct and wrong personality copy is selected only from semantic reveal event keys and follows literal feedback/explanation."
patterns-established:
  - "Practice copy lives under the closed workflows.practice catalog for immediate provider-driven locale switching."
  - "Visible counts and percentages format through Intl.NumberFormat while stored values and score math remain numeric."
requirements-completed: [LOCALE-01, LOCALE-04, SLANG-01, SLANG-02, SLANG-03, SLANG-04]
duration: 20min
completed: 2026-07-26
---

# Phase 6 Plan 5: Bilingual Practice and Results Summary

**Typed EN/VI practice chrome with event-stable safe reactions across quiz feedback, flashcard navigation, progress, and completion results**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-26T06:04:00Z
- **Completed:** 2026-07-26T06:24:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Quiz answer reveals now present literal correctness and generated explanation before optional gentle correct/wrong slang keyed to the question reveal event.
- Quiz progress, controls, score/result language, retry and mistake actions, and result chrome consume typed EN/VI copy with locale-aware visible numbers.
- Flashcard loading, empty, progress, face labels, literal announcements, keyboard hints, actions, and completion results switch locale without changing card content or session controls.
- Supporting slang remains effect-selected, aria-hidden, and tied to loading, empty, answer, or completion semantic events rather than rerenders.
- Existing quiz scoring, mistake recording, routes, flashcard focus/keyboard controls, card geometry, and generated/user content were preserved.

## Task Commits

1. **Task 1: Localize quiz play, feedback, progress, and results** - `b413d21` (feat)
2. **Task 2: Localize flashcard play, progress, navigation, and completion** - `e3d01d6` (feat)

## Files Created/Modified

- `src/lib/locale/types.ts` - Closed typed practice catalog contract.
- `src/lib/locale/messages.ts` - English and Vietnamese quiz/flashcard practice copy.
- `src/components/quiz/QuizSession.tsx` - Localized quiz controls and event-stable reveal feedback.
- `src/app/(app)/quiz/[id]/page.tsx` - Localized route progress chrome.
- `src/app/(app)/quiz/[id]/done/page.tsx` - Localized saved-result presentation.
- `src/components/flashcards/FlashcardSession.tsx` - Localized session states, progress, face labels, and announcements.
- `src/components/flashcards/FlashcardActions.tsx` - Localized previous/next/done actions.
- `src/components/flashcards/FlashcardInteractionHints.tsx` - Localized literal keyboard hints.
- `src/app/(app)/flashcards/[id]/page.tsx` - Localized loading chrome.
- `src/app/(app)/flashcards/[id]/done/page.tsx` - Localized completion count, copy, and CTAs.

## Decisions Made

- Kept primary actions and all accessibility/error instructions literal; slang is optional supporting copy only.
- Used question ID plus reveal index for quiz reaction events and session/count identity for completion events.
- Preserved all generated and user-authored learning content without translation or interpolation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Focused locale tests initially detected that the existing `messageDomains` runtime parity list had not been extended for the already-present `workflows` domain. Added the missing domain entry and reran all tests successfully.
- Unrelated dirty work, including pre-existing quiz result styling and media-loading changes, was preserved rather than reverted.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None introduced by this plan.

## Threat Flags

None. The changes add no endpoint, auth, file-access, or schema surface; generated content remains data and contextual reactions use curated plain-text catalogs.

## Verification

- `npm run typecheck` passed.
- Focused locale suite passed: 6 files, 26 tests.
- Full test suite passed: 35 files, 230 tests.

## Next Phase Readiness

- Practice and result surfaces are ready for the Phase 6 locale coverage audit and browser route matrix in Plan 06-07.
- No implementation blocker remains for this plan.

## Self-Check: PASSED

- All ten planned source files exist.
- Task commits `b413d21` and `e3d01d6` exist.
- Typecheck and all 230 tests pass.

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-26*
