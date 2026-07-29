---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 02
subsystem: ui
tags: [react, localization, hydration, localStorage, accessibility]
requires:
  - phase: 06-01
    provides: Typed EN/VI catalogs, validated locale storage, and deterministic slang rotation
provides:
  - Hydration-safe app-level locale context with English SSR fallback
  - Persistent cross-tab EN/VI selection and document language synchronization
  - Reusable account-menu and Settings language selectors
  - Localized top bar and command palette chrome
affects: [06-03, 06-04, 06-05, 06-06, 06-07]
tech-stack:
  added: []
  patterns: [post-mount preference hydration, typed provider copy, event-driven slang API]
key-files:
  created: [src/components/locale/LocaleProvider.tsx, src/components/locale/LocaleProvider.test.tsx, src/components/locale/LanguageSelector.tsx]
  modified: [src/components/layout/AppProviders.tsx, src/components/layout/AppTopBar.tsx, src/components/layout/CommandPalette.tsx, src/app/(app)/settings/page.tsx, src/lib/locale/messages.ts, src/lib/locale/types.ts]
key-decisions:
  - "Locale state starts in English and upgrades from validated storage only after mount."
  - "Language controls share one provider and preserve existing routes, auth behavior, content data, and shell geometry."
patterns-established:
  - "Hydration boundary: no localStorage or random slang selection during initial render."
  - "Shell localization: literal typed catalog copy only for navigation, account, and accessibility surfaces."
requirements-completed: [LOCALE-01, LOCALE-02, LOCALE-03, LOCALE-04, LOCALE-05, SLANG-04]
duration: 8min
completed: 2026-07-26
---

# Phase 6 Plan 2: Hydration-Safe Locale Shell Summary

**Persistent EN/VI provider with cross-tab synchronization, explicit account/settings controls, and localized shared app shell**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-26T05:42:30Z
- **Completed:** 2026-07-26T05:50:30Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- English remains deterministic server and first-client output; validated browser preference applies after mount and updates `<html lang>`.
- Locale preference persists through `doc2quiz.locale`, synchronizes through filtered storage events, and changes UI without reload.
- Reusable explicit `English (EN)` and `Tiếng Việt (VI)` selectors serve account dropdown and Settings with selected semantics and 44px targets.
- Top bar and command palette use typed literal EN/VI copy while preserving routes, shortcuts, deferred palette ordering, study metadata, logout, and shell geometry.
- Provider exposes memoized event-driven slang selection with no random selection during render.

## Task Commits

1. **Task 1: Implement hydration-safe locale provider contract** - `161e67d` (feat)
2. **Task 2: Add selectors and localize shared app shell** - `55e9eeb` (feat)

## Files Created/Modified

- `src/components/locale/LocaleProvider.tsx` - Hydration-safe locale state, storage sync, document language, and slang-event API.
- `src/components/locale/LocaleProvider.test.tsx` - Server fallback, storage validation, document language, and event filtering tests.
- `src/components/locale/LanguageSelector.tsx` - Compact account and full Settings EN/VI controls.
- `src/components/layout/AppProviders.tsx` - App-level locale provider wiring preserving mount order.
- `src/components/layout/AppTopBar.tsx` - Localized shell copy and compact account selector.
- `src/components/layout/CommandPalette.tsx` - Localized headings, actions, input, empty state, and shortcut copy.
- `src/app/(app)/settings/page.tsx` - Full application language preference.
- `src/lib/locale/messages.ts` - Shared-shell EN/VI literal catalog additions.
- `src/lib/locale/types.ts` - Typed shared-shell catalog contract.

## Decisions Made

- Keep static root `lang="en"`; provider upgrades document language post-hydration from validated localStorage.
- Keep slang event-driven and absent from account, settings, navigation, logout, errors, and accessibility copy.
- Use Base UI radio-menu semantics in account dropdown and explicit radio semantics in Settings without new dependencies.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- None. Focused provider tests, full suite, typecheck, and production build passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. Storage values are closed-union validated; shell copy is static literal text; no new network, auth, file, or schema surface was introduced.

## Next Phase Readiness

- Shared provider and selector contract ready for reusable localized supporting-copy integration in Plan 06-03.
- Full automated gate passed: 34 test files, 226 tests, TypeScript, and Next.js production build.

## Self-Check: PASSED

- All nine planned source/test files exist.
- Task commits `161e67d` and `55e9eeb` exist.
- Focused provider tests pass (4 tests).
- Full suite passes (226 tests), typecheck passes, and production build passes.

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-26*
