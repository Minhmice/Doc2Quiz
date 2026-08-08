---
phase: 12-ide-themes
plan: 01
subsystem: ui
status: complete
tags: [nextjs, react, supabase, themes, ssr]

requires:
  - phase: profile-auth
    provides: authenticated profile API and Supabase server client
provides:
  - validated account-level IDE theme preference contract
  - server-authoritative theme selection before first paint
  - immediate client application with persistence, cross-tab sync, and rollback
  - safe system and malformed-value fallback
  affects: [12-ide-themes-02, settings, root-layout]

actuals:
  tokens: 1848
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - account preference is read with authenticated Supabase server client before rendering
    - inline pre-paint theme application is reconciled by one client preference controller
    - local storage is fallback for signed-out clients and cross-tab invalidation only

key-files:
  created: []
  modified:
    - supabase/migrations/20260731210000_profile_theme_preference.sql
    - src/app/layout.tsx
    - src/components/providers/ThemePreferenceProvider.tsx

key-decisions:
  - "Authenticated profile theme remains authoritative; local storage is used only when no authenticated server preference exists."
  - "System mode resolves to VS Code Dark or VS Code Light while named dark presets retain the compatibility dark class."

patterns-established:
  - "Theme preference trust boundary uses one shared allowlist and defaults malformed values to system."
  - "Theme changes apply optimistically, persist through PATCH /api/profile, and roll back on HTTP or network failure."

requirements-completed: [THEME-01, THEME-02, THEME-03]

coverage:
  - id: D1
    description: Account theme preference accepts only supported values and safely defaults malformed database values.
    requirement: THEME-01
    verification:
      - kind: unit
        ref: "src/lib/profile/themePreference.test.ts#themePreference"
        status: pass
      - kind: integration
        ref: "npm run test -- src/app/api/profile/route.test.ts --run"
        status: pass
    human_judgment: false
  - id: D2
    description: Authenticated server preference seeds root theme before hydration and system mode maps to VS Code light or dark.
    requirement: THEME-02
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "npx eslint src/app/layout.tsx src/components/providers/ThemePreferenceProvider.tsx"
        status: pass
    human_judgment: true
    rationale: First-paint flash behavior requires browser and OS color-scheme observation.
  - id: D3
    description: Client selection applies immediately, persists through profile PATCH, reconciles storage events, and rolls back safely.
    requirement: THEME-03
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: Cross-tab timing and visible optimistic rollback require interactive browser verification.

duration: 14min
completed: 2026-08-08
---

# Phase 12 Plan 01: Theme preference persistence and SSR controller Summary

**Validated account theme persistence now seeds an IDE palette before first paint and stays synchronized through one rollback-safe client controller.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-08T11:48:00Z
- **Completed:** 2026-08-08T12:02:14Z
- **Tasks:** 2/2
- **Files modified:** 3 implementation files plus this summary

## Accomplishments

- Hardened the populated-profile migration so reruns repair invalid values before enforcing the default, NOT NULL rule, and allowlist constraint.
- Kept the existing authenticated profile GET/PATCH contract and shared validator as the account persistence boundary.
- Read authenticated theme preference in the root server layout and applied the resolved named palette before body paint.
- Reconciled system changes, named dark-class compatibility, signed-out local fallback, cross-tab events, immediate updates, and network-safe rollback in one provider.

## Task Commits

1. **Task 1: Add account theme preference contract** — `e0cb6c4` — `fix(12-01): harden theme preference migration`
2. **Task 2: Apply server preference without hydration flash** — `c27a530` — `feat(12-01): apply persisted theme before paint`

**Plan metadata:** summary commit follows self-check.

## Files Created/Modified

- `supabase/migrations/20260731210000_profile_theme_preference.sql` — idempotent cleanup plus default, NOT NULL, and allowlist enforcement.
- `src/app/layout.tsx` — authenticated profile read and pre-paint named-theme resolution.
- `src/components/providers/ThemePreferenceProvider.tsx` — local fallback, system reconciliation, storage synchronization, persistence, and rollback.

Existing `src/lib/profile/themePreference.ts`, `src/lib/profile/themePreference.test.ts`, `src/app/api/profile/route.ts`, and `src/components/providers/app-root-providers.tsx` already contained the planned contract and wiring; verification confirmed them without churn.

## Validation

- PASS — `npm run test -- src/lib/profile/themePreference.test.ts --run` (2 tests)
- PASS — `npm run test -- src/app/api/profile/route.test.ts --run` (9 tests)
- PASS — `npm run typecheck`
- PASS — focused ESLint for all Plan 12-01 TypeScript files
- PRE-EXISTING FAILURE — repository-wide `npm run lint` retains 2 unrelated errors in `src/app/share/[token]/page.tsx` and `src/legacy/loading/PageTransitionProvider.tsx`, plus 45 unrelated warnings.

## Decisions Made

- Authenticated account preference overrides local storage on first paint; local storage remains signed-out fallback and cross-tab transport.
- `system` resolves against `prefers-color-scheme`; VS Code Dark, Monokai, and High Contrast keep `dark`, while VS Code Light removes it.
- Existing profile auth and own-row authorization remain unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made existing-column migration reruns enforce the full contract**
- **Found during:** Task 1
- **Issue:** `add column if not exists ... not null default` did not repair default or nullability when the column already existed with weaker attributes.
- **Fix:** Dropped the allowlist constraint before cleanup, normalized rows, then explicitly set default and NOT NULL before recreating the constraint.
- **Files modified:** `supabase/migrations/20260731210000_profile_theme_preference.sql`
- **Verification:** preference unit tests and profile route tests pass; SQL operation ordering permits populated-table repair.
- **Committed in:** `e0cb6c4`

**2. [Rule 3 - Blocking] Continued from pre-existing unscoped theme implementation**
- **Found during:** Task 1
- **Issue:** Theme utility, tests, API fields, provider, and root wiring already existed in broad commit `446922f` rather than atomic Plan 12-01 commits, so a new RED test passed before execution.
- **Fix:** Preserved working baseline files, verified their contracts, and committed only corrections needed to satisfy remaining acceptance criteria.
- **Files modified:** no extra files
- **Verification:** all focused tests, typecheck, and focused lint pass.
- **Committed in:** `e0cb6c4`, `c27a530`

**Total deviations:** 2 auto-handled (1 bug, 1 blocking baseline condition). **Impact:** No scope expansion; shortest corrective diff retained existing behavior.

## Issues Encountered

- Repository-wide lint failure is pre-existing and outside this plan. Changed-file lint passes.
- `STATE.md` had unrelated user changes and was intentionally left untouched. `ROADMAP.md` and `REQUIREMENTS.md` were also not modified per execution constraints.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authenticated-profile-read | `src/app/layout.tsx` | Root render now reads only current authenticated user's allowlisted theme field through existing RLS client. |
| threat_flag: inline-prepaint-script | `src/app/layout.tsx` | Inline script receives only JSON-serialized allowlisted constants and contains no user-controlled free text. |

## Known Stubs

None found in Plan 12-01 files.

## User Setup Required

Apply `supabase/migrations/20260731210000_profile_theme_preference.sql` through the project's normal Supabase deployment flow.

## Next Phase Readiness

Theme persistence and first-paint controller are ready for Plan 12-02 palette tokens and Settings selector verification. Browser UAT should check OS scheme switching, two signed-in tabs, cross-device persistence, and simulated PATCH failure rollback.

## Self-Check: PASSED

- Required migration, utility, tests, API route, layout, and provider files exist.
- Task commits `e0cb6c4` and `c27a530` exist in repository history.
- Focused tests, typecheck, and changed-file lint pass.
- Only Plan 12-01 summary will enter metadata commit; unrelated planning state remains unstaged.

---
*Phase: 12-ide-themes*
*Completed: 2026-08-08*
