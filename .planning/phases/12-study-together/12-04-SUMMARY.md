---
phase: 12-study-together
plan: 04
subsystem: ui
tags: [nextjs, react, vitest, localization, study-challenges]
requires:
  - phase: 12-02
    provides: authenticated challenge, attempt, and notification APIs
  - phase: 12-03
    provides: authoritative social count reconciliation
provides:
  - Typed challenge and notification HTTP clients
  - Snapshot-only keyboard-accessible challenge practice route
  - Durable notification mutation UI contracts
  - English and Vietnamese study challenge copy
affects: [12-05, 12-06, 12-08, 12-09]
tech-stack:
  added: []
  patterns: [safe DTO browser boundary, server-owned scoring, targeted notification reads]
key-files:
  created: [src/lib/client/studyTogether.ts, src/components/friends/StudyChallengePractice.tsx, src/components/friends/NotificationsMenu.tsx]
  modified: [src/lib/locale/types.ts, src/lib/locale/messages.ts, src/lib/locale/coverage.test.ts]
key-decisions:
  - "Challenge completion sends selected indices and duration only; score remains server-owned."
  - "Notification menu reads only acted-on records and reconciles authority after every mutation."
patterns-established:
  - "Creator and recipient navigate only through server-returned playHref values."
requirements-completed: [SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07]
duration: 9min
completed: 2026-07-31
---

# Phase 12 Plan 04: Snapshot Challenge Client and Play UI Summary

**Typed challenge transport, durable notification actions, and keyboard-accessible snapshot practice with server-owned scoring**

## Performance
- **Duration:** 9 min
- **Started:** 2026-07-31T11:23:00Z
- **Completed:** 2026-07-31T11:32:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added typed HTTP-only create, list, accept, decline, creator reopen, progress, completion, and notification clients.
- Added safe practice UI using answer-key-free DTOs, 1–4/Enter controls, progress persistence, retry states, and reveal-policy-aware results.
- Added notification mutation UI with targeted reads, explicit mark-all, post-success invite archive, and authoritative reconciliation.
- Added EN/VI copy parity and phase locale coverage proof.

## Task Commits
1. **Task 1: Typed challenge clients and localized safe states** - `0a2eb8a` (feat)
2. **Task 2: Ready-owned dialog and snapshot play route** - `fae090a` (feat)
3. **Task 2 lint correction** - `1a3b20b` (fix)

## Files Created/Modified
- `src/lib/client/studyTogether.ts` - Typed safe challenge and notification HTTP boundary.
- `src/components/friends/StudyChallengeDialog.tsx` - Recipient-locked ready quiz challenge composer.
- `src/components/friends/StudyChallengePractice.tsx` - Snapshot practice and server completion UI.
- `src/components/friends/NotificationsMenu.tsx` - Durable challenge notification actions.
- `src/app/(app)/friends/study/[sessionId]/play/` - Safe creator/recipient play route.
- `src/lib/locale/messages.ts` - English and Vietnamese challenge copy.

## Decisions Made
- Reused existing API and locale infrastructure; no dependency or alternate scoring path.
- Kept eligible quiz list as server-provided dialog input; UI filters ready/non-empty again but never treats filtering as authority.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed impure render-time clock initialization**
- **Found during:** Task 2 lint verification
- **Issue:** React lint rejected `Date.now()` during render.
- **Fix:** Initialize attempt timer when safe practice load starts.
- **Files modified:** `src/components/friends/StudyChallengePractice.tsx`
- **Verification:** Scoped ESLint and typecheck pass.
- **Committed in:** `1a3b20b`

**Total deviations:** 1 auto-fixed bug. No product scope added.

## Issues Encountered
- Repository-wide lint remains blocked by pre-existing errors in unrelated dirty files (`@ts-nocheck`, share-page JSX-in-try, legacy loading purity). Scoped Plan 12-04 lint passes.
- Runtime SQL/RLS proof remains blocked because `PHASE12_TEST_DATABASE_URL` is unset; no database connection attempted.

## Known Stubs
None.

## Threat Flags
None. Browser code uses existing authenticated routes and safe DTOs; no new network endpoint, schema, auth path, or file access surface.

## User Setup Required
None.

## Next Phase Readiness
- Challenge client and play UI ready for friends-hub integration.
- Disposable test database still required for runtime SQL/RLS proof.

## Self-Check: PASSED
- All planned files exist.
- Commits `0a2eb8a`, `fae090a`, and `1a3b20b` exist.
- Focused Vitest: 16/16 passed.
- TypeScript and scoped ESLint passed.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
