# Phase 12: Study Together — Validation

**Created:** 2026-07-31
**Status:** Pre-execution validation contract
**Scope:** SOCIAL-01 through SOCIAL-10

## Test target safety

- SQL proof runs only against an explicit local Supabase test database started for this repository or a disposable dedicated test project.
- Refuse a database URL whose host does not match the chosen local/test target. Never run fixture cleanup against production or a developer shared database.
- Use per-run fixture UUIDs/usernames and delete only rows reachable from those fixture IDs after each test.
- Required setup decision before SQL proof: document the actual command and test-only connection source in the executing plan; if unavailable, retain automated route/unit coverage and mark SQL proof as blocked rather than guessing.

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
- **PASS — static SQL foundation contract:** `node scripts/verify-phase12-study-together-sql.mjs --migration supabase/migrations/20260731100000_phase12_study_together_foundation.sql` emitted `STATIC_SQL_PROOF_OK`.
- **BLOCKED — runtime SQL/RLS proof:** same guarded command emitted `SQL_PROOF_BLOCKED: PHASE12_TEST_DATABASE_URL is not set; static contract passed, runtime SQL/RLS proof not run` and exited 2. No database connection opened. Required next step: provide an explicitly approved repository-local Supabase database or disposable dedicated test target through `PHASE12_TEST_DATABASE_URL`; for a nonlocal disposable host also set matching `PHASE12_ALLOW_DISPOSABLE_TEST_HOST` and `PHASE12_DISPOSABLE_TEST_CONFIRM=YES`.
- **FAIL — full `npm test`:** 32 failures outside focused Phase 12 contract, including stale workspace permission mocks (`supabase.from is not a function`), locale/dashboard expectation drift, old friends list response expectations, and an obsolete reaction test expecting post-commit broadcast failure to return 503. Focused Phase 12 suites remain green; no unrelated dirty files changed.
- **FAIL — repository `npm run lint`:** remaining unrelated dirty-file errors are JSX construction in `src/app/share/[token]/page.tsx` and render-time `Date.now()` in `src/legacy/loading/PageTransitionProvider.tsx`. Phase 12 validation files pass scoped lint.

### Requirement state

- **SOCIAL-01–06:** focused route/server/client tests pass for create defaults, safe snapshot projection, server-owned scoring input, lifecycle adapters, idempotent route identity, progress, and answer-key exclusion. Runtime race/RLS and source mutation proof remains blocked by missing approved test DB.
- **SOCIAL-07:** notification route and reconciliation tests pass, including durable reaction success despite broadcast failure. Runtime recipient isolation and reminder dedupe proof remains blocked by missing approved test DB; focus/reconnect two-account behavior remains manual.
- **SOCIAL-08–09:** focused hub regression passes and distinct action contracts are present. 20+ item responsive behavior and remove/block lifecycle need manual two-account proof.
- **SOCIAL-10:** message cursor and shared conversation tests pass for responsive controller contracts. Real mobile/desktop rendering and reconnect need manual two-account proof.

### Remaining human checkpoints

1. **Two authenticated accounts unavailable:** execute all eight steps in `Required final manual scenario` at desktop and 375px. Record account-safe outcomes, browser/network evidence of no pre-reveal answer keys, duplicate-accept attempt identity, reconnect count convergence, cursor history, and separate remove/block behavior. No outcome claimed yet.
2. **Approved SQL target unavailable:** run guarded runtime fixtures only after explicit local/disposable target approval. Do not use production or shared developer database.
3. **Scheduler decision recorded:** reminder sweep remains callable, idempotent by contract, and intentionally unscheduled. Repository static proof rejects `cron.schedule`; runtime double-invocation dedupe still needs approved SQL target.
