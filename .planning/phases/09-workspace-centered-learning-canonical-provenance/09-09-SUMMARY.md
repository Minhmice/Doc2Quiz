---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 09
subsystem: testing
tags: [workspace, legacy-bridge, rls, sql, static-audit, compatibility]

requires:
  - phase: 09-08
    provides: flashcard legacy adapter on shared resolveLegacyStudySetBridge
provides:
  - Static compatibility audit for six retained legacy study-set adapters
  - Extended workspace_rls.sql backfill, RLS, resolver, and soft-delete assertions
  - verify:phase9-workspace npm script chaining audit + focused bridge tests
affects:
  - Phase 10 (must not expose sharing surfaces verified by audit)

tech-stack:
  added: []
  patterns:
    - verify:phase9-workspace runs static audit then 65 focused Vitest bridge tests
    - SQL assertions cover cardinality, dual-mode split, parent history immutability, soft-delete snapshots
    - Phase 10 UI patterns scanned in src/app and src/components

key-files:
  created:
    - scripts/verify-phase9-workspace-bridge.mjs
  modified:
    - supabase/tests/workspace_rls.sql
    - package.json

key-decisions:
  - "Static audit enforces explicit routeKind per adapter and forbids mutable legacy RPC imports"
  - "Human verification matrix documented for Task 2 checkpoint; no Phase 10 scope changes"

patterns-established:
  - "Phase 9 final gate: npm run verify:phase9-workspace before full CI chain"
  - "Soft-delete SQL gate: active documents hidden; output_source_snapshots remain readable"

requirements-completed: []

duration: 25min
completed: 2026-07-30
---

# Phase 09: Plan 09 Summary

**Static bridge audit, extended SQL compatibility assertions, and verify:phase9-workspace gate — awaiting human workspace lifecycle approval**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T07:04:00+07:00
- **Completed:** 2026-07-30T07:30:00+07:00 (Task 1 complete; Task 2 checkpoint pending)
- **Tasks:** 1 / 2 (automated complete)
- **Files modified:** 3

## Accomplishments

- Added `scripts/verify-phase9-workspace-bridge.mjs` auditing all six retained legacy adapters for `resolveLegacyStudySetBridge` + explicit `routeKind`, forbidding mutable legacy paths, and scanning for Phase 10 sharing UI
- Extended `supabase/tests/workspace_rls.sql` with workspace cardinality, shared `legacy_parent_study_set_id`, cross-kind denial, and soft-delete snapshot readability assertions
- Added `verify:phase9-workspace` npm script (static audit + 65 focused bridge Vitest tests — all passed)

## Task Commits

1. **Task 1: Add static compatibility audit and final SQL assertions** — `ad3eaa3` (feat)
2. **Task 2: Verify workspace provenance transition** — checkpoint (human-verify)

## Files Created/Modified

- `scripts/verify-phase9-workspace-bridge.mjs` — Static adapter + Phase 10 UI audit
- `supabase/tests/workspace_rls.sql` — Final backfill, RLS, resolver, soft-delete assertions
- `package.json` — `verify:phase9-workspace` script

## Human Verification Matrix (Task 2)

| # | WORK req | Step | Expected result | Pass? |
|---|----------|------|-----------------|-------|
| 1 | WORK-01 | Upload from `/create` while signed in | No title prompt; derived workspace title appears | ☐ |
| 2 | WORK-02 | Open dashboard card → document/version reader → output overview → practice | Navigation works; counts visible | ☐ |
| 3 | WORK-03 | Rename workspace; edit document metadata; replace source | Metadata persists; new immutable version `N+1` | ☐ |
| 4 | WORK-04 | Canonicalize same document version twice | Two versions with distinct provenance/date labels | ☐ |
| 5 | WORK-05 | Open canonical reader; scroll/load more | Progressive sections only; no full markdown dump | ☐ |
| 6 | WORK-06 | Select two completed canonical versions; generate quiz and flashcards | Generation succeeds from explicit selection | ☐ |
| 7 | WORK-07 | Open generated output via `/quiz/[setId]` and `/flashcard/[setId]` | Routes open; bridge setId works | ☐ |
| 8 | WORK-08 | Soft-delete a selected source; reopen output and study | Output still opens/studies from frozen snapshot | ☐ |
| 9 | WORK-09 | Scan UI for sharing controls | No invite, public-link, friend, anonymous, or member-management surfaces | ☐ |

**Pre-check (automated):** `npm run verify:phase9-workspace` — passed (65/65 tests, audit clean).

**Resume signal:** Type `approved` or describe failures.

## Decisions Made

- Human verification matrix maps each WORK requirement to a concrete UI step for Task 2 checkpoint
- Supabase SQL tests documented as blocked when Docker Desktop is unavailable; assertions are written and ready for `supabase db reset && supabase test db`

## Deviations from Plan

None for Task 1 implementation scope.

### Environment / Pre-existing Blockers (not auto-fixed — out of task file scope)

- **Supabase:** `supabase db reset` failed — Docker Desktop not running on executor host
- **Typecheck:** 7 pre-existing errors in `src/app/api/study-sets/[id]/route.test.ts` (`response` possibly undefined)
- **Lint / build:** Pre-existing errors in dirty workspace (`CanonicalMarkdownViewer.tsx`, `PageTransitionProvider.tsx`, `workspaceSummary.ts`) — unrelated to plan-declared files

## Issues Encountered

- Docker unavailable for local `supabase test db` execution; SQL assertions added but not executed on this host
- Full plan verification chain (`typecheck && lint && build`) blocked by pre-existing workspace issues outside plan-declared files

## User Setup Required

- Start Docker Desktop before running `supabase db reset && supabase test db`
- Run `npm run dev`, sign in, and complete Human Verification Matrix above

## Next Phase Readiness

- Automated Task 1 deliverables complete; bridge audit and focused tests green
- Phase 10 can proceed after human approval of workspace lifecycle (Task 2)

## Self-Check: PASSED

- FOUND: `scripts/verify-phase9-workspace-bridge.mjs`
- FOUND: `supabase/tests/workspace_rls.sql` (extended)
- FOUND: `package.json` (`verify:phase9-workspace`)
- PASSED: `npm run verify:phase9-workspace` (65 tests)
- BLOCKED: `supabase test db` (Docker)
- BLOCKED: full `typecheck && lint && build` (pre-existing)

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30 (Task 1)*
