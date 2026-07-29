---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 03
subsystem: ui
tags: [react, localization, accessibility, hydration, progress]
requires:
  - phase: 06-02
    provides: Hydration-safe locale provider, typed EN/VI catalogs, and event-driven slang API
provides:
  - Reusable post-hydration semantic-event slang composition
  - Localized accessible shared progress shell labels
  - Bilingual ingest, canonicalization, quiz, and flashcard progress cards
affects: [06-04, 06-05, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [effect-selected semantic copy, literal-primary aria-live status, typed pipeline message domain]
key-files:
  created: [src/components/locale/LocalizedCopy.tsx, src/components/locale/LocalizedCopy.test.tsx]
  modified: [src/components/processing/conversion-progress.tsx, src/components/edit/new/import/IngestProgressCard.tsx, src/components/canonical/CanonicalizeProgressCard.tsx, src/components/quiz/QuizGenerateProgressCard.tsx, src/components/flashcards/FlashcardGenerateProgressCard.tsx, src/lib/locale/messages.ts, src/lib/locale/types.ts]
key-decisions:
  - "Supporting slang is selected in an effect keyed by locale, context, and semantic event, never during SSR or render."
  - "Literal localized status remains the sole live-region source; optional slang is aria-hidden and suppressed for errors."
patterns-established:
  - "Progress composition: literal title and useful subtitle first, optional personality slot second."
  - "Pipeline localization: dynamic errors and unknown detected formats remain verbatim data."
requirements-completed: [LOCALE-01, LOCALE-04, SLANG-01, SLANG-02, SLANG-03, SLANG-04]
duration: 10min
completed: 2026-07-26
---

# Phase 6 Plan 3: Contextual Pipeline Progress Summary

**Hydration-safe semantic slang composition with typed EN/VI progress copy across ingest, canonicalization, quiz, and flashcard generation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-26T05:53:00Z
- **Completed:** 2026-07-26T06:03:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added reusable `useEventSlang` and `LocalizedSlangLine` with deterministic server output, stable unrelated rerenders, and semantic-event rotation.
- Extended shared progress composition without changing card, step, footer, progress-bar, or reduced-motion structure.
- Localized visible and assistive progress chrome for upload, conversion, canonicalization, quiz generation, and flashcard generation.
- Preserved server error detail, unknown format values, retry callbacks, counts, state unions, and no-slang error behavior.

## Task Commits

1. **Task 1: Add reusable stable contextual-copy composition** - `b29e220` (feat)
2. **Task 2: Localize and contextualize pipeline progress cards** - `b29fe31` (feat)

## Files Created/Modified

- `src/components/locale/LocalizedCopy.tsx` - Effect-driven stable slang hook and aria-hidden line.
- `src/components/locale/LocalizedCopy.test.tsx` - SSR, stability, semantic transition, locale, and suppression coverage.
- `src/components/processing/conversion-progress.tsx` - Optional personality slot and localized ARIA labels.
- `src/components/edit/new/import/IngestProgressCard.tsx` - Typed localized upload/conversion states.
- `src/components/canonical/CanonicalizeProgressCard.tsx` - Typed localized canonicalization progress.
- `src/components/quiz/QuizGenerateProgressCard.tsx` - Typed quiz progress, counts, warnings, retry, and slang contexts.
- `src/components/flashcards/FlashcardGenerateProgressCard.tsx` - Typed flashcard progress and known-format localization.
- `src/lib/locale/messages.ts` - EN/VI pipeline catalog and shared progress accessibility copy.
- `src/lib/locale/types.ts` - Closed typed pipeline message contract.

## Decisions Made

- Semantic event keys, not timer or repaint progress, control slang selection.
- Error state always suppresses supporting slang; dynamic server detail remains unchanged.
- Known flashcard formats localize through closed maps; unknown values remain verbatim.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Full lint gate remains blocked by two pre-existing `prefer-const` errors in `LoginClient.tsx` and `SignupClient.tsx`; unrelated files were left untouched.
- Typecheck, all 230 tests, and production build passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth, file-access, or schema boundary was introduced; planned plain-text supporting copy remains aria-hidden and error-suppressed.

## Next Phase Readiness

- Shared literal-plus-personality pattern is ready for import controls, review surfaces, practice feedback, results, dashboard, and toast plans.
- Phase lint debt remains outside this plan; final phase gate must address existing auth-file lint errors separately.

## Self-Check: PASSED

- All nine planned source/test files exist.
- Task commits `b29e220` and `b29fe31` exist.
- Focused locale suite passes 26 tests; full suite passes 230 tests.
- Typecheck and production build pass.

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-26*
