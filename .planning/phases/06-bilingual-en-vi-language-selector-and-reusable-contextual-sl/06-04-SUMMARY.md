---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 04
subsystem: ui
tags: [react, localization, sonner, accessibility, review]
requires:
  - phase: 06-02
    provides: Hydration-safe locale provider and typed EN/VI catalogs
  - phase: 06-03
    provides: Literal-first pipeline progress and event-driven safe slang
provides:
  - Bilingual import, upload, canonical mode, and flashcard setup workflow chrome
  - Bilingual quiz and flashcard review workspace chrome
  - Literal localized validation, warning, destructive, accessibility, and error recovery copy
affects: [06-05, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [typed workflow message domains, dynamic-content translation boundary, literal critical-copy policy]
key-files:
  created: []
  modified: [src/lib/locale/types.ts, src/lib/locale/messages.ts, src/components/edit/new/import/UnifiedInputZone.tsx, src/components/upload/UploadBox.tsx, src/app/(app)/sets/[id]/source/page.tsx, src/components/canonical/CanonicalModeSelectionFooter.tsx, src/components/flashcards/FlashcardSetupWizard.tsx, src/components/review/ReviewSection.tsx, src/components/review/QuestionEditor.tsx, src/components/flashcards/review/FlashcardReviewWorkspace.tsx]
key-decisions:
  - "Stable workflow chrome uses typed catalogs while filenames, source text, section headings, generated questions, and flashcard faces remain verbatim data."
  - "Validation, warning, destructive, error, and accessibility copy stays literal with no slang."
patterns-established:
  - "Workflow copy boundary: translate stable labels and fallbacks, never arbitrary server or generated content."
  - "Review localization preserves persistence callbacks, optimistic state, navigation, and editor validation."
requirements-completed: [LOCALE-01, LOCALE-04, SLANG-01, SLANG-03, SLANG-04]
duration: 24min
completed: 2026-07-26
---

# Phase 6 Plan 4: Bilingual Workflow Integration Summary

**Typed EN/VI literal chrome across import, canonical generation, setup, and review workflows while preserving all source and generated study content**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-26T06:04:00Z
- **Completed:** 2026-07-26T06:28:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Localized import tabs, instructions, drop zone, validation fallbacks, conversion controls, canonical states, mode selection, and flashcard setup.
- Localized quiz editor/review and flashcard review headings, counts, badges, warnings, navigation, actions, ARIA labels, and stable success toasts.
- Preserved file names, pasted text, URLs, study-set metadata, canonical Markdown, section headings, questions/options, and flashcard front/back content verbatim.
- Kept error, warning, destructive, validation, and accessibility surfaces literal and free of slang.

## Task Commits

1. **Task 1: Localize import and canonical generation workflow** - `7d7706a` (feat)
2. **Task 2: Localize quiz and flashcard review workspaces** - `61e502c` (feat)

## Files Created/Modified

- `src/lib/locale/types.ts` - Typed workflow catalog contracts.
- `src/lib/locale/messages.ts` - Literal EN/VI workflow copy.
- `src/components/edit/new/import/UnifiedInputZone.tsx` - Localized input and conversion chrome.
- `src/components/upload/UploadBox.tsx` - Localized drop-zone instructions.
- `src/app/(app)/sets/[id]/source/page.tsx` - Localized canonical states and recovery controls.
- `src/components/canonical/CanonicalModeSelectionFooter.tsx` - Localized mode selection and resume actions.
- `src/components/flashcards/FlashcardSetupWizard.tsx` - Localized setup steps, options, and validation.
- `src/components/review/ReviewSection.tsx` - Localized quiz review status and navigation.
- `src/components/review/QuestionEditor.tsx` - Localized editor fields and save feedback.
- `src/components/flashcards/review/FlashcardReviewWorkspace.tsx` - Localized flashcard review chrome and accessibility labels.

## Decisions Made

- Dynamic API detail remains unchanged; only stable fallback and recovery copy is localized.
- Existing shared progress components continue to own eligible event-driven personality; critical workflow and review copy remains literal.
- User and generated study content is never interpolated through translation or slang catalogs.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None. Typecheck, focused locale tests, and the full 230-test suite passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access, persistence schema, or trust boundary was introduced.

## Next Phase Readiness

- Practice/results and dashboard plans can reuse the typed locale and literal-first patterns.
- Final coverage audit should validate remaining listed-context hard-coded copy and responsive EN/VI layouts.

## Self-Check: PASSED

- All ten planned source files exist.
- Task commits `7d7706a` and `61e502c` exist.
- `npm run typecheck` passes.
- Focused locale suite passes 26 tests; full suite passes 230 tests.

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-26*
