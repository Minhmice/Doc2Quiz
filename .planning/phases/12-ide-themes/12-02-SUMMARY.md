---
phase: 12-ide-themes
plan: 02
subsystem: ui
status: complete
tags: [nextjs, react, css, themes, accessibility]

requires:
  - phase: 12-ide-themes-01
    provides: account-backed theme preference and SSR-safe application controller
provides:
  - four named IDE-inspired semantic palettes across shell, quiz, and flashcard surfaces
  - accessible localized appearance selector backed by the shared theme preference provider
  - browser-verified system mapping, persistence, focus visibility, and responsive contrast
  affects: [settings, app-shell, quiz, flashcards]

actuals:
  tokens: 1386
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - named palettes override semantic variables at the document root and scoped study surface
    - custom radio cards use roving tabindex, arrow navigation, explicit selected state, and polite persistence feedback
    - settings consumes ThemePreferenceProvider through its public hook without duplicate preference state or fetches

key-files:
  created:
    - src/components/settings/AppearanceSettings.test.tsx
  modified:
    - src/app/globals.css
    - src/components/settings/AppearanceSettings.tsx

key-decisions:
  - "Palette selectors also target nested data-quiz-play-theme surfaces so their scoped defaults cannot mask the account theme."
  - "Existing Settings placement, localized copy, provider integration, and Settings-link quick control were retained; only missing study-surface inheritance and radio tabindex behavior required code changes."

patterns-established:
  - "Theme-specific study tokens inherit from the same named palette declaration as shell tokens."
  - "Single-tab-stop radio groups move and select with all four arrow keys while preserving visible text and checkmark state."

requirements-completed: [THEME-04, THEME-05]

coverage:
  - id: D1
    description: Four named palettes recolor semantic shell, quiz, and flashcard token surfaces with strong High Contrast boundaries.
    requirement: THEME-04
    verification:
      - kind: build
        ref: "npm run build"
        status: pass
      - kind: manual
        ref: "Task 3 human verification approved 2026-08-08"
        status: pass
    human_judgment: true
    rationale: Visible palette coherence and contrast across routes and viewport widths require browser judgment.
  - id: D2
    description: Settings exposes a localized account-backed selector with swatches, explicit selection, keyboard navigation, persistence feedback, and System OS mapping.
    requirement: THEME-05
    verification:
      - kind: unit
        ref: "src/components/settings/AppearanceSettings.test.tsx#AppearanceSettings"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: manual
        ref: "Task 3 human verification approved 2026-08-08"
        status: pass
    human_judgment: true
    rationale: Persistence across tabs, browsers, devices, OS schemes, and first-paint behavior requires interactive verification.

duration: 10min
completed: 2026-08-08
---

# Phase 12 Plan 02: IDE palette tokens and accessible appearance selector Summary

**Four account-backed IDE palettes now reach core shell and study surfaces through one accessible, localized Settings selector.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-08T12:08:00Z
- **Completed:** 2026-08-08T12:18:09Z
- **Tasks:** 3/3
- **Files modified:** 3 implementation/test files plus this summary

## Accomplishments

- Ensured VS Code Dark, VS Code Light, Monokai, and High Contrast token sets override nested quiz and flashcard Stitch surfaces instead of being masked by scoped defaults.
- Completed accessible radio-group behavior with one tab stop, four-arrow navigation, visible labels/swatches/checkmark, and polite save feedback.
- Preserved the existing public `useThemePreference` integration, localized EN/VI copy, Appearance-before-Language placement, and Settings-link quick control without duplicate state or network requests.
- Received human approval for desktop/mobile palettes, System under both OS schemes, reload and multi-context persistence, first paint, keyboard focus, route contrast, and non-color-only meaning.

## Task Commits

1. **Task 1: Define semantic VS Code-inspired token palettes** — `88be20b` — `fix(12-02): apply palettes to study surfaces`
2. **Task 2: Add accessible account-backed appearance selector** — `2597ecb` — `feat(12-02): add accessible theme selector`
3. **Task 3: Verify themed core routes** — human verification approved; no code commit required

**Plan metadata:** summary commit follows self-check.

## Files Created/Modified

- `src/app/globals.css` — named palette declarations now also override nested quiz/flashcard scoped tokens.
- `src/components/settings/AppearanceSettings.tsx` — standards-aligned roving tabindex plus normalized keyboard handling.
- `src/components/settings/AppearanceSettings.test.tsx` — focused proof for five radio options, one-tab-stop behavior, selected state, live region, labels, and arrow keys.

Existing `src/app/(app)/settings/SettingsPageClient.tsx`, `src/components/layout/ThemeToggle.tsx`, `src/components/layout/AccountMenu.tsx`, locale catalogs, and `ThemePreferenceProvider` already satisfied planned placement, quick-link, localization, and persistence contracts; they were verified without churn.

## Validation

- PASS — `npm run test -- src/components/settings --run` (2 files, 5 tests).
- PASS — `npm run typecheck`.
- PASS — focused ESLint for Plan 12-02 TypeScript files with 0 errors.
- WARNING — focused ESLint reports the pre-existing `@next/next/no-img-element` warning at `src/components/layout/AccountMenu.tsx:61`; Plan 12-02 did not modify that file.
- INCOMPATIBLE — `npm run lint -- src/app/globals.css` invokes ESLint, which ignores CSS because no matching CSS configuration exists; it returned 0 errors and one ignored-file warning, so it is not a CSS validator.
- UNAVAILABLE — direct `npx tailwindcss` validation was not used because installed Tailwind v4 does not expose that CLI package and no stylelint/PostCSS validation script exists; no tooling was invented or added.
- PASS — `git diff --check`.
- PASS — `npm run build`; production CSS compilation, TypeScript, and Next.js integration completed. Build was not rerun after approval because implementation state did not change.
- PASS — Task 3 human verification approved on 2026-08-08.

## Human Verification

Approved for desktop and mobile-width viewports across all four named presets and System under light and dark OS schemes. Approval covers reload, second tab, another browser/device, persistence, no wrong-theme flash or hydration warning, arrow-key selector behavior, visible focus, readable Settings/sidebar/topbar/quiz/flashcard surfaces, and interaction meaning beyond color alone.

## Decisions Made

- Extended each named palette selector to nested `[data-quiz-play-theme="stitch"]` surfaces rather than removing or refactoring existing scoped defaults.
- Added roving tabindex to the existing native button-based radio group instead of introducing a dependency or duplicate preference controller.
- Retained existing EN/VI catalog entries, Settings section ordering, and quick Settings link because they already met Plan 12-02 requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scoped study tokens masked account palette tokens**
- **Found during:** Task 1
- **Issue:** Later `[data-quiz-play-theme="stitch"]` rules overrode `--qp-*` values inherited from the document theme, so quiz and flashcard surfaces could retain the base Stitch palette.
- **Fix:** Applied each named palette declaration to both the document root and nested Stitch study scope.
- **Files modified:** `src/app/globals.css`
- **Verification:** production build passed and human route verification approved all presets.
- **Committed in:** `88be20b`

**2. [Rule 1 - Accessibility] Existing radio cards exposed every option in tab order**
- **Found during:** Task 2
- **Issue:** Arrow handling existed, but all native buttons remained tabbable instead of presenting standard radio-group roving focus.
- **Fix:** Selected option receives `tabIndex={0}` and unselected options receive `tabIndex={-1}`; focused test covers this contract and all arrow keys.
- **Files modified:** `src/components/settings/AppearanceSettings.tsx`, `src/components/settings/AppearanceSettings.test.tsx`
- **Verification:** focused settings tests, typecheck, focused lint, build, and human keyboard verification passed.
- **Committed in:** `2597ecb`

**3. [Rule 3 - Tooling] Planned CSS lint command cannot validate CSS**
- **Found during:** Task 1 verification
- **Issue:** Repository `lint` script is ESLint-only and ignores `src/app/globals.css`; no CSS linter or standalone Tailwind CLI script is installed.
- **Fix:** Recorded incompatibility, used `git diff --check`, and relied on the required production build for CSS compilation validation without adding tooling.
- **Files modified:** none
- **Verification:** `npm run build` passed.
- **Committed in:** no code change

**Total deviations:** 3 auto-handled (2 bugs/accessibility gaps, 1 tooling blocker). **Impact:** No scope expansion or new dependency; shortest corrective diff completed palette coverage and radio semantics.

## Hardcoded Token Exceptions

- Archived and decorative grid utilities retain hardcoded RGBA values; they are outside semantic theme scope and were intentionally not refactored.
- Quiz correctness/error and warning accents retain explicit red/amber Tailwind or HSL literals where color supplements text, borders, `aria-label`, or status copy.
- Some flashcard action text remains hardcoded white while action backgrounds use `--qp-*`; human verification confirmed readable contrast.
- Theme preview swatches intentionally use literal colors because they depict each named preset rather than consume the active theme.
- These exceptions match the v1 scope fence: shell, Settings, semantic UI, quiz, and flashcard token surfaces recolor; full legacy literal conversion remains out of scope.

## Issues Encountered

- CSS-specific lint tooling is absent; production build supplied applicable compilation validation.
- Build generated an unrelated `next-env.d.ts` working-tree change; it was preserved and excluded from Plan 12-02 commits.
- `.planning/STATE.md` contains orchestrator/user changes and remained untouched. `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and `.planning/phases/12-study-together` were not modified.

## Threat Flags

None. Plan changes are CSS and local presentation semantics; account persistence remains behind the existing authenticated profile API and allowlisted `ThemePreferenceProvider` contract.

## Known Stubs

None found in Plan 12-02 files.

## User Setup Required

None for Plan 12-02. Plan 12-01's Supabase migration deployment remains the account-persistence prerequisite.

## Next Phase Readiness

Phase 12 IDE Themes implementation and human verification are complete. Four named palettes and System behavior are ready for normal release flow.

## Self-Check: PASSED

- Required Plan 12-02 source, settings, layout, and test files exist.
- Task commits `88be20b` and `2597ecb` exist in repository history.
- Focused tests, typecheck, focused TypeScript lint, diff check, production build, and human verification passed.
- CSS-lint incompatibility, pre-existing warning, hardcoded exceptions, deviations, setup, threat flags, and stubs are documented.
- Only this summary is staged for metadata commit; unrelated `.planning/STATE.md` and `next-env.d.ts` changes remain unstaged.

---
*Phase: 12-ide-themes*
*Completed: 2026-08-08*
