---
phase: 12-study-together
plan: 05
subsystem: social-api-ui
tags: [nextjs, zod, supabase-rpc, localization, vitest]
requires:
  - phase: 12-01
    provides: remove_friend RPC and challenge friendship lifecycle
  - phase: 12-03
    provides: authoritative separate social counts
  - phase: 12-04
    provides: study challenge client and localized challenge UI
provides:
  - Dedicated authenticated remove-friend HTTP and client contract
  - Safe friend overview avatar projection and bounded presence vocabulary
  - Localized distinct study, profile, message, remove, block, and report actions
affects: [12-08, 12-09]
tech-stack:
  added: []
  patterns: [auth-before-validation, distinct destructive social mutations, server-safe avatar projection]
key-files:
  created: [src/app/api/friends/[userId]/route.ts]
  modified: [src/app/api/friends/route.ts, src/app/api/friends/friends.route.test.ts, src/lib/server/friends/friends.ts, src/lib/client/friends.ts, src/components/friends/FriendActionMenu.tsx, src/components/layout/FriendsMenu.tsx, src/lib/locale/messages.ts, src/lib/locale/types.ts]
key-decisions:
  - "Remove friend uses its own DELETE route and typed remove_friend adapter; block remains a separate mutation."
  - "Friend overview strips avatarPath before serialization and exposes only online, recently active, or offline."
patterns-established:
  - "Destructive friend actions require explicit localized confirmation and refresh server authority after success."
requirements-completed: [SOCIAL-08, SOCIAL-09]
duration: 11min
completed: 2026-07-31
---

# Phase 12 Plan 05: Friend Repair Contracts Summary

**Dedicated remove-friend authority, safe avatar and presence projection, and localized distinct social actions with destructive confirmation**

## Performance
- **Duration:** 11 min
- **Started:** 2026-07-31T11:34:00Z
- **Completed:** 2026-07-31T11:45:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added authenticated UUID-validated `DELETE /api/friends/[userId]` backed only by `remove_friend`.
- Removed raw avatar paths from overview responses and added bounded presence vocabulary.
- Added localized separate Study together, profile, message, remove, block, report, and reaction actions.
- Added explicit remove/block confirmations and post-success friend/count refresh.

## Task Commits
1. **Task 1 RED: Remove and safe overview contracts** - `d0860dd` (test)
2. **Task 1 GREEN: Distinct remove endpoint and safe overview** - `b992ebb` (feat)
3. **Task 2: Distinct localized friend action menu** - `a684b46` (feat)

## Files Created/Modified
- `src/app/api/friends/[userId]/route.ts` - Dedicated authenticated remove-friend endpoint.
- `src/app/api/friends/route.ts` - Safe avatar projection, presence vocabulary, separate counts preserved.
- `src/app/api/friends/friends.route.test.ts` - Remove-only, validation, retry, avatar, and presence proofs.
- `src/lib/server/friends/friends.ts` - Typed `remove_friend` RPC adapter and shared error mapping.
- `src/lib/client/friends.ts` - Remove client and bounded accepted-friend presence type.
- `src/components/friends/FriendActionMenu.tsx` - Separate social actions and destructive confirmations.
- `src/components/layout/FriendsMenu.tsx` - Study action routing and authority refresh wiring.
- `src/lib/locale/messages.ts`, `src/lib/locale/types.ts` - English and Vietnamese action copy contract.

## Decisions Made
- Kept remove retry/unavailable behavior generic through existing social error vocabulary to avoid relationship disclosure.
- Routed Study together to the upcoming `/friends` hub contract with recipient query selection; no friend-shared quiz source was added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Rejected self-target remove requests**
- **Found during:** Task 1
- **Issue:** UUID validation alone permits authenticated caller ID as mutation target.
- **Fix:** Reject caller ID before RPC invocation.
- **Files modified:** `src/app/api/friends/[userId]/route.ts`, `src/app/api/friends/friends.route.test.ts`
- **Verification:** Focused route suite passes.
- **Committed in:** `b992ebb`

**Total deviations:** 1 auto-fixed missing critical validation. No product scope added.

## Issues Encountered
- Repository-wide `npm run lint` remains blocked by four pre-existing unrelated errors: two `@ts-nocheck` test files, JSX construction inside `try/catch` in public share page, and render-time `Date.now()` in legacy loading provider.
- Scoped Plan 12-05 lint passes with warnings only.
- Runtime SQL/RLS proof remains blocked because `PHASE12_TEST_DATABASE_URL` is unset; no database connection attempted.

## Known Stubs
None.

## Threat Flags
| Flag | File | Description |
|---|---|---|
| threat_flag: authenticated-api | `src/app/api/friends/[userId]/route.ts` | New cross-user mutation surface covered by auth, UUID/self validation, locked RPC, and generic unavailable response. |

## User Setup Required
None.

## Next Phase Readiness
- Plan 12-08 can consume distinct remove/block actions and safe overview status.
- `/friends` hub must consume `studyWith` recipient selection when its challenge composer is wired.
- Existing disposable database blocker remains for runtime SQL/RLS proof.

## Self-Check: PASSED
- All planned implementation files exist.
- Commits `d0860dd`, `b992ebb`, and `a684b46` exist.
- Focused Vitest: 31/31 passed.
- TypeScript: passed.
- Scoped ESLint: 0 errors; repository lint blocked only by pre-existing unrelated errors.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
