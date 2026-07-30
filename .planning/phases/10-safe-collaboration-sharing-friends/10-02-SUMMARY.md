---
phase: 10-safe-collaboration-sharing-friends
plan: 02
subsystem: api
tags: [supabase, rpc, workspace, collaboration, invitations, rls]

requires:
  - phase: 10-safe-collaboration-sharing-friends
    plan: 01
    provides: workspace role helpers, schema contract, hardened RLS
provides:
  - Owner-controlled invitation and membership mutation RPCs
  - Share metadata persistence with digest-only storage
  - requireWorkspacePermission intent guard
  - Protected collaboration API routes and route tests
affects:
  - 10-03 public share resolver
  - 10-09 content-route editor authorization migration

tech-stack:
  added: []
  patterns:
    - "Owner-only collaboration mutations via SECURITY DEFINER RPCs with auth.uid()"
    - "Recipient-bound invitation acceptance with row lock and idempotent membership upsert"
    - "Share create stores SHA-256 digest; list responses omit digest and token"

key-files:
  created:
    - supabase/migrations/20260730150300_phase10_collaboration_mutations.sql
    - src/lib/server/workspaces/permissions.ts
    - src/lib/server/workspaces/collaboration.ts
    - src/lib/server/workspaces/collaboration.test.ts
    - src/app/api/workspaces/[id]/members/route.ts
    - src/app/api/workspaces/[id]/invitations/route.ts
    - src/app/api/workspaces/[id]/shares/route.ts
    - src/app/api/invitations/[id]/accept/route.ts
    - src/app/api/workspaces/collaboration.route.test.ts
  modified: []

key-decisions:
  - "Migration timestamp 150300 used instead of plan 140100 (must run after 150200 authorization)"
  - "Invitation acceptance binds stored recipient_user_id to auth.uid(); no share-token path"
  - "Share create returns one-time plaintext token to owner; list/revoke omit digest and token"
  - "Content-route editor checks remain in Plan 10-09; not migrated here"

patterns-established:
  - "requireWorkspacePermission queries membership through RLS-backed client as intent guard"
  - "Collaboration routes delegate all mutations to RPC wrappers with stable domain errors"

requirements-completed: [COLLAB-01, COLLAB-02, COLLAB-04]

duration: 35min
completed: 2026-07-30
---

# Phase 10 Plan 02: Collaboration Mutations Summary

**Owner-controlled invitation, membership, and share-metadata APIs with recipient-bound acceptance RPCs**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-30T08:41:00Z
- **Completed:** 2026-07-30T08:48:00Z
- **Tasks:** 2/2
- **Files modified:** 9

## Accomplishments

- `workspace_invitations` and `workspace_shares` tables with owner-only RLS and transactional RPCs
- `requireWorkspacePermission` intent guard (view/edit/manage_members/manage_shares)
- Typed collaboration service mapping RPC errors to stable codes
- Protected routes for members, invitations, shares, and invitation acceptance
- 17 focused unit/route tests passing; typecheck clean

## Task Commits

1. **Task 1: Define server permission and collaboration RPC contracts** - `3f83cfb` (feat)
2. **Task 2: Expose owner membership and invitation APIs** - `f9d6f14` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `supabase/migrations/20260730150300_phase10_collaboration_mutations.sql` - Tables, RLS, invitation/member/share RPCs
- `src/lib/server/workspaces/permissions.ts` - Role intent guard via RLS membership query
- `src/lib/server/workspaces/collaboration.ts` - RPC wrappers and CollaborationError mapping
- `src/lib/server/workspaces/collaboration.test.ts` - Permission and invitation acceptance tests
- `src/app/api/workspaces/[id]/members/route.ts` - Owner list/change/revoke members
- `src/app/api/workspaces/[id]/invitations/route.ts` - Owner create/list/revoke invitations
- `src/app/api/workspaces/[id]/shares/route.ts` - Owner create/list/revoke share metadata
- `src/app/api/invitations/[id]/accept/route.ts` - Recipient-bound invitation acceptance
- `src/app/api/workspaces/collaboration.route.test.ts` - Route auth, validation, and authorization tests

## Decisions Made

- Used migration timestamp `20260730150300` because plan `140100` would run before Phase 9/10 authorization foundation
- Share create issues one-time token to owner; public resolver and DTO projection deferred to Plan 10-03
- Phase 9 content routes not migrated; Plan 10-09 owns editor authorization on content mutations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration timestamp ordering**
- **Found during:** Task 1
- **Issue:** Plan specified `20260730140100_phase10_collaboration_mutations.sql` but must run after `20260730150200_phase10_workspace_authorization.sql`
- **Fix:** Created `20260730150300_phase10_collaboration_mutations.sql` following Plan 10-01 collision precedent
- **Files modified:** `supabase/migrations/20260730150300_phase10_collaboration_mutations.sql`
- **Committed in:** 3f83cfb

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for correct migration ordering; no behavioral change.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: endpoint | `src/app/api/workspaces/[id]/members/route.ts` | Owner membership mutation surface |
| threat_flag: endpoint | `src/app/api/workspaces/[id]/invitations/route.ts` | Owner invitation lifecycle |
| threat_flag: endpoint | `src/app/api/workspaces/[id]/shares/route.ts` | Owner share metadata create/list/revoke |
| threat_flag: endpoint | `src/app/api/invitations/[id]/accept/route.ts` | Recipient-bound membership grant |

## Issues Encountered

None blocking. Remote Supabase migration apply confirmed by user prior to execution.

## User Setup Required

Apply `20260730150300_phase10_collaboration_mutations.sql` to remote Supabase if not yet applied:

```bash
supabase db push
```

## Next Phase Readiness

- Plan 10-03 can build public share resolver on `workspace_shares` digest lookup
- Plan 10-09 can migrate content-route editor checks using `requireWorkspacePermission`

## Self-Check: PASSED

- FOUND: supabase/migrations/20260730150300_phase10_collaboration_mutations.sql
- FOUND: src/lib/server/workspaces/permissions.ts
- FOUND: src/app/api/invitations/[id]/accept/route.ts
- FOUND: commit 3f83cfb
- FOUND: commit f9d6f14

---
*Phase: 10-safe-collaboration-sharing-friends*
*Completed: 2026-07-30*
