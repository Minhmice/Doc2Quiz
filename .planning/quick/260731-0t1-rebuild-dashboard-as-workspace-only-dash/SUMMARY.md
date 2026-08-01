---
status: complete
quick_task: 260731-0t1-rebuild-dashboard-as-workspace-only-dash
subsystem: ui
tags: [dashboard, workspaces, localization, accessibility]
requires:
  - phase: 09
    provides: workspace summaries and learning-output bridges
provides:
  - workspace-only dashboard model and recommendations
  - compact localized workspace dashboard UI
  - focused model and locale coverage
tech-stack:
  added: []
  patterns: [pure dashboard selectors, stale-while-revalidate dashboard hook]
key-files:
  created:
    - src/components/dashboard/workspaceDashboardModel.ts
    - src/components/dashboard/workspaceDashboardModel.test.ts
  modified:
    - src/hooks/useDashboardHome.ts
    - src/components/dashboard/DashboardHomeClient.tsx
    - src/components/dashboard/DashboardHero.tsx
    - src/components/dashboard/DashboardLibraryHeader.tsx
    - src/components/layout/AppTopBar.tsx
    - src/lib/locale/types.ts
    - src/lib/locale/messages.ts
    - src/lib/locale/coverage.test.ts
key-decisions:
  - "Dashboard status uses pending/processing/generating as Processing and ready as Ready; unknown output states never become Ready."
  - "Legacy URL type/practice parameters are ignored while search, status, and sort remain safe and durable."
requirements-completed: []
completed: 2026-07-31
---

# Quick Task: Workspace-only dashboard summary

**Workspace-only re-entry dashboard with deterministic status/resume models, compact three-column cards, and bilingual workspace copy.**

## Accomplishments

- Replaced mixed study-set dashboard state with pure workspace card, status, filter, sort, review, and resume contracts.
- Rebuilt dashboard hero and cards around one primary Continue studying action and requested workspace metadata.
- Localized dashboard and top-bar workspace copy in English and Vietnamese; removed runtime-unused `DashboardLibraryClient.tsx`.

## Task Commits

1. **Task 1: Establish workspace dashboard contracts and focused logic** — `d8c76b0`
2. **Task 2: Recompose hero and workspace grid** — `1a2d54f`
3. **Task 3: Align localized shell copy and retire dead legacy dashboard code** — `f817082`

## Verification

- `npm test -- --run src/components/dashboard/workspaceDashboardModel.test.ts src/hooks/useDashboardHome.test.ts src/lib/locale/coverage.test.ts` — 3 files, 11 tests passed.
- Focused ESLint via direct file arguments — passed with no warnings.
- `npm run typecheck` — passed.
- Plan-specified `npm run lint -- --file ...` — blocked by repository ESLint flat config rejecting `--file`; equivalent focused invocation used.

## Deviations from Plan

### Auto-fixed Issues

- **[Rule 3 - Blocking] Updated existing dashboard URL tests** after removing obsolete type/practice return fields.
- **[Rule 3 - Blocking] Retained legacy locale members consumed by `DashboardStudySetCard` and `CommandPalette`** so repository-wide typecheck stays green without unrelated cleanup.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access, schema, or dependency surface added.

## Pre-existing Blockers

- Working tree contained broad unrelated modified/untracked work, including generated `.next` output. Those files were not staged by path.
- `AppTopBar.tsx`, `messages.ts`, and `types.ts` already had overlapping user edits. They remain present.

## Self-Check: PASSED

Created model/test files exist. Task commits `d8c76b0`, `1a2d54f`, and `f817082` exist. Focused tests, lint, and typecheck pass.
