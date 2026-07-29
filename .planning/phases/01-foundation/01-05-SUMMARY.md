---
phase: 01-foundation
plan: 05
subsystem: auth
tags: [requireUser, logout, studySetDb, pipeline_stage]
requires:
  - phase: 01-01
    provides: pipeline_stage column on study_sets
  - phase: 01-02
    provides: Supabase browser client and auth guard
provides:
  - Protected app layout
  - Server logout route
  - Real studySetDb client layer
  - pipelineStage types
affects: [dashboard, all app routes]
tech-stack:
  added: []
  patterns: [POST /logout form submit, pipelineStage dashboard classification]
key-files:
  created: [src/lib/client/studySetDb.ts]
  modified:
    - src/types/studySet.ts
    - src/app/(app)/layout.tsx
    - src/app/(auth)/logout/route.ts
    - src/components/layout/AppTopBar.tsx
    - src/lib/ui/studySetActionLabels.ts
key-decisions:
  - "Dashboard ready state maps to pipelineStage quiz/flashcards (replaces draft/ready)"
  - "Approved bank queries remain stubs until Phases 4/5"
patterns-established:
  - "AppTopBar logout via hidden form POST to /logout"
requirements-completed: [CORE-AUTH-01, CORE-AUTH-02, CANON-09]
duration: 20min
completed: 2026-07-25
---

# Phase 1 Plan 05: Auth UI + studySetDb Summary

**Protected app shell, server logout, and Supabase-backed study set metadata complete the auth loop.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/3 automated + 1 human checkpoint documented
- **Files modified:** 11

## Accomplishments

- Updated types to `PipelineStage`; removed `StudySetStatus` draft/ready
- Implemented real `studySetDb` queries against `study_sets`
- `(app)/layout.tsx` calls `requireUser()` before rendering
- Restored POST `/logout` with server `signOut`
- Fixed `AppTopBar` logout to POST `/logout` (not client-only `/login` redirect)
- `npm run build` passes

## Task Commits

1. **Tasks 1–2: Types, studySetDb, auth wiring** - `6fbbc7d` (feat)

## Human Verification (Task 3 — documented, pending user)

Requires `.env.local` with Supabase credentials and manually applied baseline SQL on hosted projects:

1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Apply `20260725120000_v21_baseline.sql` if using hosted Supabase
3. `npm run dev` — unauthenticated `/dashboard` → `/login?next=...`
4. Sign in with email/password → dashboard loads; navigation preserves session
5. Log out → `/login`; `/dashboard` redirects to login again

**Status:** Automated build gate passed; human smoke test not yet confirmed.

## Known Stubs

| File | Stub | Future plan |
|------|------|-------------|
| `src/lib/client/studySetDb.ts` | `getApprovedBank` / flashcard bank return empty | Phase 4/5 |
| `src/lib/client/studySetDb.ts` | `getDocument` / `putDocument` no-op | Phase 3 |

## Deviations from Plan

None — checkpoint documented per orchestrator instruction to continue implementation.

## Verification

- `npm run typecheck` — PASS
- `npm run build` — PASS

## Self-Check: PASSED
