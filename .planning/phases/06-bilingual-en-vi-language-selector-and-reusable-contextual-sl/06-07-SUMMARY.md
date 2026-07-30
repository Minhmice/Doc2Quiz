---
phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl
plan: 07
subsystem: testing
tags: [vitest, localization, audit, coverage, bilingual]

requires:
  - phase: 06-04
    provides: Bilingual workflow chrome and literal critical-copy policy
  - phase: 06-05
    provides: Practice/results integration with event-stable slang
  - phase: 06-06
    provides: Dashboard localization without geometry changes
provides:
  - Phase-wide locale/slang coverage unit gate aggregating catalog parity, forbidden categories, integration markers, and suite reachability
  - Repeatable hard-coded listed-context audit script with explicit exclusions and unsafe-render detection
  - Documented human EN/VI route, hydration, safety, accessibility, and layout verification matrix
affects: [phase-6-sign-off, locale-governance, 07-normalize-app-ia]

tech-stack:
  added: []
  patterns: [contract-based coverage gate, allowlisted copy audit, representative integration markers]

key-files:
  created: [src/lib/locale/coverage.test.ts, scripts/verify-locale-coverage.mjs]
  modified: []

key-decisions:
  - "Coverage gate asserts contracts and safety properties instead of brittle full-copy snapshots."
  - "Copy audit uses an explicit listed-file allowlist plus unsafe-scan surface regex rather than whole-repo string matching."
  - "Phase 6 completion requires human browser matrix approval after plan-specific automated gates pass."

patterns-established:
  - "Phase gate: node scripts/verify-locale-coverage.mjs plus locale test suite before human route matrix."
  - "Forbidden slang categories validated both in coverage.test.ts and human error/destructive review."

requirements-completed: [LOCALE-01, LOCALE-02, LOCALE-03, LOCALE-04, LOCALE-05, SLANG-01, SLANG-02, SLANG-03, SLANG-04]

duration: 12min
completed: 2026-07-30
---

# Phase 6 Plan 7: Locale Coverage Gate and Human Verification Summary

**Contract-based EN/VI coverage tests plus a repeatable listed-context copy audit, with human route matrix pending approval**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-30T06:42:00Z
- **Completed:** 2026-07-30T06:54:00Z (automated tasks; human checkpoint open)
- **Tasks:** 1/2 automated complete, 1/2 awaiting human verification
- **Files modified:** 0 (artifacts pre-existing; verified in this execution)

## Accomplishments

- Verified `coverage.test.ts` enforces EN/VI message-domain parity, slang context completeness/uniqueness, banned content policy, forbidden critical slang categories, representative integration markers, and reachability of no-repeat/storage/hydration suites.
- Verified `scripts/verify-locale-coverage.mjs` passes with zero findings for hard-coded listed-context copy, render-path `Math.random()`/`getRandomSlang()`, and slang `dangerouslySetInnerHTML`.
- Plan-specific automated gates green: audit script, locale/component locale tests (31 tests), and `npm run typecheck`.
- Documented the full 11-step human EN/VI verification matrix for checkpoint Task 2.

## Task Commits

1. **Task 1: Add phase-wide locale/slang coverage and hard-coded-copy audit** — `77e86b3` (pre-existing; verified unchanged in this execution)

**Plan metadata:** pending (this summary commit)

## Automated Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Copy audit | `node scripts/verify-locale-coverage.mjs` | ✅ Pass |
| Locale suite | `npm test -- src/lib/locale src/components/locale --run` | ✅ 31/31 pass |
| Typecheck | `npm run typecheck` | ✅ Pass |
| Lint | `npm run lint` | ❌ 3 errors (pre-existing, out of plan scope) |
| Full tests | `npm test -- --run` | ❌ 1 failure (pre-existing `quizGenerate` capacity test) |
| Production build | `npm run build` | ❌ `layout.tsx` type instantiation depth (pre-existing) |

### Pre-existing workspace gate failures (deferred)

- `src/components/canonical/CanonicalMarkdownViewer.tsx` — `react-hooks/rules-of-hooks` on `useEffectEvent`
- `src/legacy/loading/PageTransitionProvider.tsx` — `react-hooks/purity` on `Date.now()` in `useRef`
- `src/lib/pipeline/quizGenerate.test.ts` — capacity metadata test rejects with `INSUFFICIENT_VALID_QUESTIONS`
- `src/app/(app)/layout.tsx` — TypeScript "excessively deep" instantiation during `next build`

These are outside Plan 06-07 file scope per dirty-workspace execution rules.

## Files Created/Modified

- `src/lib/locale/coverage.test.ts` — Phase-wide catalog/slang/integration coverage gate (5 tests).
- `scripts/verify-locale-coverage.mjs` — Read-only listed-context copy and unsafe slang render audit.

## Decisions Made

- Treated existing committed artifacts as Task 1 deliverables after verification rather than re-authoring identical gates.
- Scoped full-repo lint/test/build failures as deferred workspace debt; plan-specific locale gates are the execution boundary for this backfill run.

## Deviations from Plan

None for Task 1 implementation — artifacts match plan contracts. Full-repo gate red status documented as deferred pre-existing workspace issues, not plan deviations.

## Human Verification Checklist (Task 2 — blocking)

Run after `node scripts/verify-locale-coverage.mjs` and locale tests pass. Resume with **"approved"** or report failures.

1. Open app with cleared `doc2quiz.locale`; confirm first render English and browser console has no hydration warning.
2. Switch to VI in account menu. Confirm top bar, command palette, and Settings update without reload; `<html lang>` becomes `vi`.
3. Reload and open second tab; confirm VI persists/synchronizes. Set invalid storage value manually, reload, and confirm safe EN fallback.
4. Check account dropdown and Settings at 375px and desktop widths: no clipped choices, changed top-bar height, wrapped primary action row, lost keyboard focus, or touch target below 44px.
5. Run file/paste/YouTube import through upload/conversion/canonicalization and both quiz/flashcard generation. Literal progress appears first; slang appears only as secondary support, stays stable during unrelated repaint, and does not repeat immediately across semantic transitions.
6. Trigger validation failure, generation failure/retry, and any serious error available. Confirm factual recovery copy remains literal and no slang appears in errors.
7. Complete quiz with one correct and one wrong answer. Confirm explanation/literal feedback precedes optional reaction; wrong reaction is gentle; score, progress, badges, retry, mistakes, and done result localize; keyboard controls still work.
8. Complete flashcard session. Confirm front/back content unchanged, Space/arrows/focus work, progress/actions/done page localize, and ARIA announcements stay literal.
9. Check dashboard loading, empty/filter-empty, populated cards, stats, streak, badges, mobile nav, rename, and delete dialog. Confirm delete/account/accessibility copy has zero slang and all existing actions/routes work.
10. Switch EN/VI while viewing existing study content. Confirm study-set titles, filenames, canonical content, MCQs/options/explanations, and flashcard faces/backs never translate.
11. At mobile and desktop widths, compare existing screens: no card/grid geometry change, overflow, hidden controls, reordered content, or reduced-motion regression.

## Issues Encountered

- Dirty workspace prevents full lint/test/build gate from passing; plan-specific locale automation is green.
- Human checkpoint intentionally blocks Phase 6 sign-off until browser matrix approval.

## User Setup Required

None.

## Next Phase Readiness

- Automated locale governance gates are in place for ongoing regression detection.
- Phase 6 cannot be marked fully complete until Task 2 human matrix is approved.
- After approval, resolve deferred workspace lint/test/build failures before `/gsd-verify-work` on the full milestone gate.

## Self-Check: PASSED

- FOUND: `src/lib/locale/coverage.test.ts`
- FOUND: `scripts/verify-locale-coverage.mjs`
- FOUND: `77e86b3` (Task 1 artifact commit)

---
*Phase: 06-bilingual-en-vi-language-selector-and-reusable-contextual-sl*
*Completed: 2026-07-30 (automated portion)*
