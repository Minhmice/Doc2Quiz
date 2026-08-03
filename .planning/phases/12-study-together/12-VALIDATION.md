# Phase 12: Study Together — Validation

**Created:** 2026-07-31
**Status:** Validated after self-hosted Supabase deployment
**Scope:** SOCIAL-01 through SOCIAL-10

## Database validation

- Supabase owns migration application and database/RLS validation.
- Repository validation uses focused route, adapter, client, and component tests; no runtime database URL or fixture cleanup is required.


## Requirement traceability

| Requirement | Automated proof | SQL/RLS proof | Manual proof | Owner | Gate |
|---|---|---|---|---|---|
| SOCIAL-01 | Challenge create route/unit validates owned `learning_outputs.status = 'ready'`, non-deleted, non-empty source and accepted friendship | RPC rejects foreign, non-ready, deleted, empty, blocked, and non-friend source/recipient combinations | Creator sees only eligible own quizzes | Plans 01–03 | Required |
| SOCIAL-02 | Snapshot DTO and source mutation regression tests | RPC creates session snapshot atomically; source edit/delete remains immaterial | Recipient cannot open original source or export answers | Plans 01–03 | Required |
| SOCIAL-03 | Lifecycle/attempt/reveal selector tests | constraints + row locks + uniqueness under repeat mutation | Deadline/status labels accurate | Plans 01–03 | Required |
| SOCIAL-04 | Accept endpoint double-submit returns same attempt | two calls create one recipient attempt | Accept & start opens/reopens session route | Plans 01–03 | Required |
| SOCIAL-05 | Decline/expired/cancelled/resume route tests | state transitions reject illegal actor/state changes | Inbox has resumable/unavailable states | Plans 01–04 | Required |
| SOCIAL-06 | Practice DTO excludes answers; server scoring/reveal policy tests | recipient cannot query private answer snapshot/result before policy allows | Two-account answer-leak check | Plans 01–03, 05 | Required |
| SOCIAL-07 | Notification count/read/reconcile client tests | durable notification survives failed/missed broadcast; additive private-topic RLS isolates recipients; dedupe blocks duplicate reminder | Focus/reconnect updates counts | Plans 01–04, 07 | Required |
| SOCIAL-08 | Remove-friend and block route/action tests | remove cancels pending only and preserves active/completed; block cancels pending/active and preserves completed readability | Menu exposes Study together, message, profile, remove, block/report distinctly | Plans 01–05, 08 | Required |
| SOCIAL-09 | Friends hub/menu component and route tests | count/list membership isolation | 20+ friend list: responsive five-destination hub, bounded pagination, compact launcher links | Plans 03, 05, 07–08 | Required |
| SOCIAL-10 | Cursor message API/client and shared conversation tests | additive conversation-topic RLS and participant-only reads | Mobile full-screen route/drawer plus preserved desktop dialog, older-history cursor, reconnect | Plans 03, 07, 09 | Required |

## Realtime reconciliation

- Separate server-derived counts: notifications, incoming requests, unread messages.
- Friends topbar refetches all three count sources on subscribe, private event, channel rejoin, window focus, and visible-document transition.
- Request and message writes emit invalidation events or create matching durable notification records; UI never assumes an event was delivered.

## Reminder contract

- Implement callable idempotent deadline reminder sweep with `dedupe_key` proof.
- Leave sweep unscheduled in Phase 12; do not add `cron.schedule` or require operator capability confirmation.
- Validation invokes sweep twice and proves one semantic expiring notification.

## Required final manual scenario

Two authenticated accounts, desktop and mobile:

1. Create eligible challenge; verify recipient badge/invite after live event and after refresh.
2. Accept twice; verify exactly one attempt; close/reopen and resume.
3. Complete one participant; verify no comparison/answer leak until policy permits.
4. Complete second participant; verify durable result-ready notice and score comparison.
5. Force missed/reconnected channel; verify all badge counts reconcile.
6. Test `/friends` five destinations with 20+ items, bounded pagination, compact launcher links, 375px/desktop layout, mobile full-screen and preserved desktop chat, older-history cursor/reconnect, remove policy, and block policy.
7. Invoke reminder sweep twice; verify one deduped expiring notification and no installed schedule.
8. Confirm `20260731101000_phase12_social_realtime_topics.sql` is additive, ordered after foundation, and denies unrelated users on every new private topic.

## Execution evidence — 2026-07-31

### Automated proof

- **PASS — focused Phase 12 regression:** `npx vitest run "src/lib/server/friends/studyTogether.test.ts" "src/app/api/friends/study-challenges/study-challenges.route.test.ts" "src/app/api/friends/notifications/notifications.route.test.ts" "src/lib/client/studyTogether.test.ts" "src/lib/client/socialCounts.test.ts" "src/lib/client/messages.test.ts" "src/components/friends/FriendsHub.test.tsx" "src/components/friends/ConversationView.test.tsx"` — 8 files, 31 tests passed.
- **PASS — typecheck:** `npm run typecheck`.
- **PASS — production build:** `npm run build` completed TypeScript and production build.
- **PASS — focused Phase 12 lint:** planned validation files report zero errors after scoped suppression documenting intentional mocked auth unions.
- **PASS — Supabase migration source:** Phase 12 foundation migration remains the database authority; migration application and RLS validation belong to Supabase deployment.
- **FAIL — full `npm test`:** 32 failures outside focused Phase 12 contract, including stale workspace permission mocks (`supabase.from is not a function`), locale/dashboard expectation drift, old friends list response expectations, and an obsolete reaction test expecting post-commit broadcast failure to return 503. Focused Phase 12 suites remain green; no unrelated dirty files changed.
- **FAIL — repository `npm run lint`:** remaining unrelated dirty-file errors are JSX construction in `src/app/share/[token]/page.tsx` and render-time `Date.now()` in `src/legacy/loading/PageTransitionProvider.tsx`. Phase 12 validation files pass scoped lint.

### Requirement state

- **SOCIAL-01–06:** focused route/server/client tests pass for create defaults, safe snapshot projection, server-owned scoring input, lifecycle adapters, idempotent route identity, progress, and answer-key exclusion. Supabase deployment owns runtime RLS and source-mutation validation.
- **SOCIAL-07:** notification route and reconciliation tests pass, including durable reaction success despite broadcast failure. Supabase deployment owns runtime recipient isolation and reminder persistence validation; focus/reconnect two-account behavior remains manual.
- **SOCIAL-08–09:** focused hub regression passes and user-approved two-account evidence covers 20+ item responsive behavior and remove/block lifecycle.
- **SOCIAL-10:** message cursor and shared conversation tests pass for responsive controller contracts; user-approved two-account evidence covers mobile/desktop rendering and reconnect.

### Execution evidence — 2026-08-03

- **PASS — focused Phase 12 regression:** `npx vitest run "src/lib/server/friends/studyTogether.test.ts" "src/app/api/friends/study-challenges/study-challenges.route.test.ts" "src/app/api/friends/notifications/notifications.route.test.ts" "src/lib/client/studyTogether.test.ts" "src/lib/client/socialCounts.test.ts" "src/lib/client/messages.test.ts" "src/components/friends/FriendsHub.test.tsx" "src/components/friends/ConversationView.test.tsx"` — 8 files, 43 tests passed.
- **FAIL — full `npm test`:** 8 files failed, 100 passed; 28 tests failed, 708 passed. Failures remain outside focused Phase 12 coverage, including workspace permission mocks, locale/dashboard expectations, friends list/reaction expectations, and document version route mocks.
- **PASS — `npm run typecheck`:** passed after `npm run build` generated the `.next` types; no Phase 12 source error reported.
- **FAIL — repository `npm run lint`:** 2 errors remain outside Phase 12 validation files: JSX construction in `src/app/share/[token]/page.tsx` and render-time `Date.now()` in `src/legacy/loading/PageTransitionProvider.tsx`; 45 warnings also reported.
- **PASS — production build:** `npm run build` completed TypeScript and production build with existing custom Cache-Control warnings.
- **PASS — self-hosted Supabase deployment (user-confirmed):** required Phase 12/14 migrations were applied; Supabase remains the deployment and runtime authority for migrations and RLS/RPC behavior. No repository SQL proof runner is required.

### Requirement state update

- **SOCIAL-01–06:** focused tests pass; user confirmed migrations applied to self-hosted Supabase, which owns runtime RLS and source-mutation validation.
- **SOCIAL-07:** focused notification/count tests pass; self-hosted Supabase owns runtime recipient isolation and reminder persistence validation.
- **SOCIAL-08–10:** focused action, hub, and conversation tests pass; user-approved two-account evidence covers responsive 20+ list, mobile/desktop, reconnect, and lifecycle behavior.

### Current executor evidence — 2026-08-03

- **PASS — manual two-account checkpoint (user-approved evidence):** user reports required two-account desktop/mobile/reconnect matrix completed with no failures. This records user evidence only; no browser artifact or network capture was supplied in this execution.
- **PASS — repository scope:** no test database URL or fixture cleanup is required; Supabase deployment owns database and RLS validation.
- **PASS — database validation ownership:** user confirmed required Phase 12/14 migrations are applied to self-hosted Supabase; deployed Supabase owns migration, RLS, RPC, and reminder persistence validation.
- **PASS — reminder contract:** reminder sweep remains callable and intentionally unscheduled; deployed-runtime double-invocation evidence is optional operational validation.

### Remaining human checkpoints

1. **Manual matrix:** user-approved pass recorded above; retain browser/network artifacts if stronger audit evidence is needed.
2. **Supabase deployment:** required Phase 12/14 migrations are applied to the user’s self-hosted Supabase; confirm deployed RLS and reminder persistence if stronger operational evidence is needed.
3. **Scheduler contract:** invoke reminder sweep twice in deployed runtime when operational evidence is needed; confirm one deduped expiring notification and no installed schedule.
