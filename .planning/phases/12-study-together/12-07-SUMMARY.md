---
phase: 12-study-together
plan: 07
subsystem: database
tags: [postgresql, supabase, realtime, rls, security]
requires:
  - phase: 12-01
    provides: durable notification topic and guarded SQL proof runner
provides:
  - Recipient-bound request and social-count realtime authorization
  - Participant-bound direct-message realtime authorization
  - Static additive migration ordering and isolation proof
affects: [12-03, 12-06, 12-09]
tech-stack:
  added: []
  patterns: [additive realtime RLS migration, authenticated topic binding, guarded static SQL proof]
key-files:
  created:
    - supabase/migrations/20260731101000_phase12_social_realtime_topics.sql
  modified:
    - scripts/verify-phase12-study-together-sql.mjs
key-decisions:
  - "Request and count topics bind directly to auth.uid(); message topics bind to active accepted-friend conversation participants."
  - "Plan 12-01 retains sole ownership of social notification topic authorization."
patterns-established:
  - "Private broadcast topics require matching SELECT and INSERT RLS policies without broad true predicates."
requirements-completed: [SOCIAL-07, SOCIAL-09, SOCIAL-10]
duration: 6min
completed: 2026-07-31
---

# Phase 12 Plan 07: Private Social Realtime Topics Summary

**Additive Supabase Realtime RLS binds request and count topics to recipients and message topics to accepted conversation participants, with migration-order proof**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-31T11:04:00Z
- **Completed:** 2026-07-31T11:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added recipient-only read/send authorization for `social-requests:{userId}` and `social-counts:{userId}`.
- Replaced legacy conversation read policy additively and added participant-only read/send authorization for `social-messages:{conversationId}`.
- Extended guarded proof to reject broad policies, confirm migration ordering, preserve foundation notification ownership, and retain prior foundation checks.

## Task Commits

1. **Task 1: Add additive private-topic realtime migration** - `266ebb9` (feat)
2. **Task 2: Prove topic isolation and migration ordering** - `b3e06bf` (test)

## Files Created/Modified
- `supabase/migrations/20260731101000_phase12_social_realtime_topics.sql` - Private request, count, and conversation broadcast RLS.
- `scripts/verify-phase12-study-together-sql.mjs` - Additive migration ordering, ownership, and isolation checks.

## Decisions Made
- User topics use exact `auth.uid()` suffix matching; predictable topic names provide no authority.
- Conversation topics require caller membership plus existing accepted-friend authority for both receive and send.
- Notification policy stays unchanged in foundation migration and is forbidden in additive migration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Runtime SQL/RLS fixture proof remains safely blocked because `PHASE12_TEST_DATABASE_URL` is unset. Static topic isolation and ordering proof passed; no database connection opened.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: realtime-authorization | `supabase/migrations/20260731101000_phase12_social_realtime_topics.sql` | New authenticated private broadcast read/send surface, covered by T-12-21 recipient and participant predicates. |

## User Setup Required

None. Runtime integration proof requires an explicitly approved local or disposable test database when available.

## Next Phase Readiness
- Plans 12-03 and 12-09 can consume request/count/message private topics.
- Runtime SQL/RLS proof remains blocked pending approved disposable target.

## Known Stubs

None.

## Self-Check: PASSED
- Migration and proof runner exist.
- Commits `266ebb9` and `b3e06bf` exist.
- Additive realtime static SQL proof passed.
- Foundation static SQL proof regression passed.
- Runtime proof stopped safely with exit code 2 because no approved target was configured.

---
*Phase: 12-study-together*
*Completed: 2026-07-31*
