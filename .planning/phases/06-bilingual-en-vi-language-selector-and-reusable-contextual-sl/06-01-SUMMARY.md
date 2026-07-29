---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 01
subsystem: ui
tags: [typescript, localization, vitest, localStorage, slang]
requires: []
provides:
  - Typed English and Vietnamese product-copy catalogs
  - Curated contextual slang catalogs for nineteen safe contexts
  - Deterministic no-repeat slang selector and session rotator
  - Validated locale persistence with English fallback
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [canonical typed catalog parity, injected RNG selection, validated browser storage boundary]
key-files:
  created: [src/lib/locale/types.ts, src/lib/locale/messages.ts, src/lib/locale/slang.ts, src/lib/locale/selectSlang.ts, src/lib/locale/localeStorage.ts]
  modified: []
key-decisions:
  - "English remains canonical catalog shape and SSR/storage fallback."
  - "Slang history stays session-only and is isolated by locale plus context."
patterns-established:
  - "Catalog parity: Vietnamese satisfies the closed English-compatible MessageCatalog contract."
  - "Rotation boundary: pure injected-RNG selection with no retry loops or render-time selection."
requirements-completed: [LOCALE-01, LOCALE-02, SLANG-01, SLANG-02, SLANG-03, SLANG-04]
duration: 7min
completed: 2026-07-26
---

# Phase 6 Plan 1: Bilingual Catalog and Slang Foundation Summary

**Typed EN/VI product catalogs, curated safe contextual slang, deterministic no-repeat rotation, and validated locale persistence**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-26T05:31:44Z
- **Completed:** 2026-07-26T05:38:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Closed TypeScript contracts enforce locale, message-domain, slang-context, entry, and catalog parity.
- Both locales provide literal copy and at least two curated phrases for every required safe slang context.
- Pure selector handles empty, singleton, no-repeat, and RNG boundary cases without loops.
- Locale storage validates browser-controlled values and safely falls back to English when unavailable or invalid.
- Eighteen focused tests cover parity, policy, deterministic selection, history isolation, and persistence.

## Task Commits

1. **Task 1: Define typed literal and slang catalogs** - `cf5cc3e` (feat)
2. **Task 2: Build deterministic no-repeat rotation and locale storage** - `88fc290` (feat)

## Files Created/Modified

- `src/lib/locale/types.ts` - Closed locale, message, slang, and catalog contracts.
- `src/lib/locale/messages.ts` - Typed English and Vietnamese literal UI catalogs.
- `src/lib/locale/slang.ts` - Curated plain-text slang allowlists.
- `src/lib/locale/selectSlang.ts` - Pure selector and locale/context rotator.
- `src/lib/locale/localeStorage.ts` - Validated localStorage boundary.
- `src/lib/locale/messages.test.ts` - Catalog parity and dynamic-message coverage.
- `src/lib/locale/slang.test.ts` - Context completeness, duplicates, and content policy coverage.
- `src/lib/locale/selectSlang.test.ts` - Selection edges and history isolation coverage.
- `src/lib/locale/localeStorage.test.ts` - Persistence, invalid input, and SSR fallback coverage.

## Decisions Made

- English defines server-safe fallback and shared catalog contract; Vietnamese must satisfy identical structure.
- Slang entries remain plain text with approved tone metadata; critical and unsafe copy classes have no slang contexts.
- Selection history remains in memory and keyed by locale plus context; persistence stores locale only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial storage test used an incomplete direct `Storage` cast. Replaced with explicit `unknown` bridge so TypeScript acknowledges intentional throwing test double.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. Implemented surfaces match plan threat model: static plain-text catalogs and validated non-sensitive locale storage.

## Next Phase Readiness

- Locale provider and selector plans can consume stable `messages`, `LOCALE_STORAGE_KEY`, `readLocale`, and `writeLocale` contracts.
- UI integrations can request event-stable slang through `createSlangRotator` without render-time randomness.

## Self-Check: PASSED

- All nine source/test files exist.
- Task commits `cf5cc3e` and `88fc290` exist.
- `npm test -- src/lib/locale --run` passes 18 tests.
- `npm run typecheck` passes.

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-26*
