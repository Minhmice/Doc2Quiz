# Phase 14: Friend presence and chat layout repair — Validation

**Created:** 2026-08-01  
**Revision:** 2  
**Status:** Pre-execution validation contract  
**Scope:** SOCIAL-09, SOCIAL-10 and Phase 14 locked decisions D-01–D-03.

## Database validation

- Supabase owns migration application and database/RLS validation.
- Repository validation uses route, adapter, client, component, and source-contract tests; no runtime database URL is required.

## Wave 0 coverage before implementation

| Gap | Owner plan/task | Required first proof | Automated command |
|---|---|---|---|
| Bucket-before-keyset SQL and bucket-bound cursor | 14-01 Task 1 | RED adapter cursor/RPC assertions plus migration source-contract checks | `npx vitest run src/lib/server/friends/socialLists.test.ts` |
| Presence query boundary and browser URL DTO | 14-01 Task 2 | RED route parser/auth-order/adapter forwarding and `presence=online|offline` URL assertions | `npx vitest run src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts` |
| Current FriendsHub membership refresh after recovery/transition | 14-02 Task 1 | RED fake lifecycle/timer controller assertions: focus, visible, 60-second revalidation, earliest online `lastActiveAt + 5 minutes`, cleanup, stale-result guard, and current-bucket first-page replacement | `npx vitest run src/components/friends/FriendsHub.test.tsx` |
| Offline visual suppression and desktop dialog enum contract | 14-02 Task 1 | RED enum-only row model plus DirectMessageDialog header-status assertions for online versus recently_active/offline; typed dialog fixture has no `isOnline` contract | `npx vitest run src/components/friends/FriendActionMenu.test.tsx src/components/friends/DirectMessageDialog.test.tsx` |
| Shared desktop/mobile bubble wrapping | 14-02 Task 2 | RED incoming/outgoing normal and 2,000-character token class assertions | `npx vitest run src/components/friends/ConversationView.test.tsx` |

## Requirement and decision traceability

| Source | Required behavior | Plan/task | Automated proof | Manual proof |
|---|---|---|---|---|
| SOCIAL-09 / D-01 | Online returns only `online`; Offline returns only `recently_active`/`offline`; SQL filters bucket before keyset paging; cursor cannot cross buckets. | 14-01 Tasks 1–2 | `npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts` | With more than 20 accepted friends in each bucket, page each tab and confirm no gap, duplicate, or cross-tab row. |
| SOCIAL-09 / D-01 | Open Friends tab refreshes current server bucket after focus, visibility return, 60-second revalidation, and five-minute online threshold so either transition direction does not preserve stale membership. | 14-02 Task 1 | `npx vitest run src/components/friends/FriendsHub.test.tsx` | Keep Friends open, move accepted friend across active/inactive boundary, return focus/visibility or wait one cadence/boundary, confirm old row disappears from current bucket and appears only after opening other bucket. |
| D-02 | Online keeps current dot/status; `recently_active` and `offline` expose neither dot/ping nor online status text. Desktop dialog header derives `Đang hoạt động` only from `presence === "online"`; non-online enum values preserve `lastActiveAt` fallback. | 14-02 Task 1 | `npx vitest run src/components/friends/FriendActionMenu.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendsHub.test.tsx && npm run typecheck` | Open desktop dialog from launcher for online and non-online friends; verify current header treatment/fallback. |
| SOCIAL-10 / D-03 | Normal long text and 2,000-character unbroken text remain inside incoming/outgoing shared bubbles on desktop and mobile. | 14-02 Task 2 | `npx vitest run src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts` | Send both text shapes at 375px and desktop; confirm no horizontal viewport overflow after reload. |
| SOCIAL-10 | Durable history cursor, dedupe, reconnect, read, and send remain unchanged. | 14-02 Task 2 | `npx vitest run src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts` | Reopen desktop dialog and mobile route; load older history, reconnect, and verify persisted messages. |

## Realtime and presence refresh contract

- Tracer evidence: `PlayfulReactionOverlay` calls `/api/friends/activity` on focus, visible-document transition, and 60-second interval; API only invokes `touch_social_activity` for caller `last_active_at`.
- `createSocialCountsController` subscribes only notification/request/count topics and has no callback to `FriendsHub`; existing hub has no presence subscription or invalidation consumer.
- Phase 14 therefore adds no realtime transport. `FriendsHub` owns a bounded current-bucket first-page refresh on focus, visibility return, each 60-second revalidation cadence, and earliest displayed online expiry (`lastActiveAt + 5 minutes`). It must cancel lifecycle/interval/timer work on destination or bucket replacement/unmount and reject stale request completions.
- Presence event payloads remain non-authoritative. Every refresh fetches authenticated `/api/friends?presence=<current-bucket>&limit=20`, never moves membership locally.

## Per-plan gates

### Plan 14-01

```bash
npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts && npm run typecheck
```

Migration source inspection must cover `p_presence`, accepted/block predicates, authenticated grant, bucket predicate in `rows` before cursor/order/limit, `limit + 1`, and cursor bucket binding. Do not alter Phase 12 migration.

### Plan 14-02

```bash
npx vitest run src/components/friends/FriendsHub.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendActionMenu.test.tsx src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts src/lib/client/friends.test.ts && npm run typecheck && npm run lint
```

## Final automated gate

```bash
npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/friends.test.ts src/components/friends/FriendsHub.test.tsx src/components/friends/DirectMessageDialog.test.tsx src/components/friends/FriendActionMenu.test.tsx src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts && npm run typecheck && npm run lint && npm run build
```

## Final human scenario

1. Use two accepted accounts with more than 20 members in Online and Offline combined.
2. Confirm each tab starts from server-filtered first page and Load more remains in selected bucket without duplicates/skips.
3. Leave Friends open. Trigger focus/visibility recovery, wait one 60-second cadence, and cross five-minute threshold; confirm active bucket refetches and no stale membership remains.
4. Confirm non-online rows have no dot, ping, or status copy; Online retains existing treatment.
5. Send long normal and 2,000-character unbroken messages in both directions at 375px and desktop. Confirm no viewport overflow, reload history, load older messages, and reconnect.
