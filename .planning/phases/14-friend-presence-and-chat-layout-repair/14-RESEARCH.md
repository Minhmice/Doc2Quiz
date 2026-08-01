# Phase 14: Friend Presence and Chat Layout Repair - Research

**Researched:** 2026-08-01
**Domain:** React/Tailwind social presence UI and responsive direct-message layout
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions
- Online friends must appear only in Online tab; offline friends only in Offline tab.
- Offline rows must not show online dot or online status.
- Long normal and unbroken chat text must remain inside bubbles without horizontal overflow.
- Preserve friend-list pagination, realtime presence, durable chat history, desktop/mobile behavior.
- Do not modify application code or git during research.

### Claude's Discretion
- Choose smallest contract/UI/test changes that preserve current social architecture.

### Deferred Ideas (OUT OF SCOPE)
- No redesign of social destinations, chat transport, presence model, or new package.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOCIAL-09 | `/friends` offers scalable friend destinations. | Keep keyset pagination and add presence bucket as validated friend-list query/cursor state; do not load all rows client-side. |
| SOCIAL-10 | Durable responsive chat with safe realtime updates. | Keep existing controller/realtime invalidation/history; add CSS-only bubble wrapping and focused render tests. |
</phase_requirements>

## Summary

Presence data already has server authority: `public.list_social_friends` calculates `presence_rank` from `private.social_activity.last_active_at`, returns `online`, `recently_active`, or `offline`, and `src/lib/server/friends/socialLists.ts` preserves `presenceRank` in its cursor. [VERIFIED: codebase grep] Current list API emits no `isOnline`, although `AcceptedFriendSummary` declares it and `FriendsMenu` filters by it. At runtime that missing field is falsy, placing even online rows into Offline. [VERIFIED: codebase grep]

`FriendsHub` has five destination links but no Online/Offline tabs or row-level presence rendering. Client-side filtering only current page cannot satisfy category pagination: a global page can contain no rows for selected category while later pages do. Add a validated server-side `presence` bucket (`online` versus all non-online states mapped to `offline`) to existing friends RPC/route/client cursor flow. [VERIFIED: codebase grep]

`ConversationView` has max bubble width but no word-break/overflow-wrap class. Flex intrinsic sizing plus a long unbroken token can overflow bubble/viewport. Tailwind documents `wrap-anywhere` specifically for flex children because it participates in intrinsic size calculation; add it with `min-w-0` to message bubble. [CITED: https://tailwindcss.com/docs/overflow-wrap]

**Primary recommendation:** Extend existing bounded friends contract with a presence bucket, render tabs/row state from same normalized bucket, and add `min-w-0 wrap-anywhere` to existing bubble; no new dependency or transport.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Presence classification and paged bucket selection | Database / Storage | API / Backend | RPC owns accepted-friend scope, five-minute threshold, stable ordering, and cursor predicate. [VERIFIED: codebase grep] |
| Query validation and opaque cursor forwarding | API / Backend | Browser / Client | `/api/friends` authenticates and parses query before `listSocialFriends`; browser must never create cursors. [VERIFIED: codebase grep] |
| Presence tabs and offline visual suppression | Browser / Client | — | React owns selected tab, row rendering, focus/accessibility, and URL state. [VERIFIED: codebase grep] |
| Chat bubble wrapping | Browser / Client | — | Existing client view renders message text; CSS governs wrapping in both desktop and mobile shells. [VERIFIED: codebase grep] |
| Realtime/history reconciliation | Browser / Client | API / Backend | Existing controller treats private broadcast as invalidation and refetches authenticated durable history. [VERIFIED: codebase grep] |

## Project Constraints (from .cursor/rules/)

- No `.cursor/rules/` directory exists. [VERIFIED: codebase filesystem]
- No project-specific rule files apply.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | `19.2.8` installed | Existing stateful social UI | Existing app components already use React hooks. [VERIFIED: package.json] |
| Next.js | `16.2.11` installed | Existing authenticated route and App Router UI | Existing `/friends` route and API route remain authority boundary. [VERIFIED: package.json] |
| Tailwind CSS | `4.x` installed | Bubble wrapping utility | `wrap-anywhere` is official utility for flex-safe unbroken text wrapping. [CITED: https://tailwindcss.com/docs/overflow-wrap] |
| Supabase/Postgres RPC | existing project stack | Presence bucket, keyset pagination | Existing RPC is participant-scoped and cursor-backed. [VERIFIED: codebase grep] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `3.2.4` installed | Focused component/contract tests | Extend social-list and conversation tests. [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-filtered presence pages | Fetch all friends then filter in browser | Breaks bounded paging/scalability and can produce false empty selected tabs. [VERIFIED: codebase grep] |
| `wrap-anywhere` | `break-all` | `break-all` forces all word breaks; `wrap-anywhere` preserves normal wrapping and breaks long tokens while enabling flex shrink. [CITED: https://tailwindcss.com/docs/overflow-wrap] |

**Installation:** None. Existing stack covers phase. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```text
Friend-tab URL / launcher open
  -> FriendsHub selected presence bucket
  -> listAcceptedFriendPage(cursor, presence)
  -> GET /api/friends?limit=20&presence=online|offline&cursor=opaque
  -> parse/validate query + requireApiUser
  -> listSocialFriends RPC adapter
  -> list_social_friends: accepted/allowed rows + bucket predicate + keyset page
  -> page items / nextCursor
  -> tab renders only matching rows and correct offline visuals

Private broadcast/focus/visibility
  -> ConversationView controller invalidates
  -> existing authenticated message-history API
  -> merge by message ID/order
  -> same desktop dialog or mobile route bubble with min-w-0 + wrap-anywhere
```

### Exact Files and Symbols

| File | Symbol / region | Current role | Minimal Phase 14 change |
|------|-----------------|--------------|-------------------------|
| `supabase/migrations/<new_phase14>_friend_presence_bucket.sql` | `public.list_social_friends` | Builds accepted-friend rows, presence rank, keyset page. [VERIFIED: codebase grep] | Add optional validated bucket argument and apply predicate before page/order; preserve `limit + 1`, sort tuple, authorization, grants. |
| `supabase/schemas/70_functions.sql` | schema mirror `list_social_friends` | Mirrors live social function. [VERIFIED: codebase grep] | Mirror migration exactly if repository schema policy requires it. |
| `src/lib/server/friends/socialLists.ts` | `SocialFriend`, `listSocialFriends`, cursor encode/decode | Owns opaque destination-bound cursor and `limit + 1`. [VERIFIED: codebase grep] | Add typed `PresenceBucket`; bind bucket/version to friends cursor so Online cursor cannot replay in Offline query; pass RPC arg. |
| `src/lib/server/friends/socialListQuery.ts` | friend-list query parser | Existing shared limit/cursor validation. [VERIFIED: source import] | Parse `presence` only for friends route; reject invalid value before RPC. |
| `src/app/api/friends/route.ts` | `GET` | Authenticates, parses, delegates. [VERIFIED: codebase grep] | Forward typed presence bucket; retain generic errors and limit behavior. |
| `src/lib/client/friends.ts` | `AcceptedFriendSummary`, `listAcceptedFriendPage` | Browser contract presently declares absent `isOnline`. [VERIFIED: codebase grep] | Remove/stop relying on phantom boolean; expose normalized `presence` and requested bucket. |
| `src/components/friends/FriendsHub.tsx` | `FriendsHub`, `load`, friends destination rendering | Paged hub with no presence sub-tabs/visual state. [VERIFIED: codebase grep] | Add URL-authoritative Online/Offline tabs only for friends destination, reset/page per tab, show visual only for online rows. |
| `src/components/layout/FriendsMenu.tsx` | `online`, `offline` filters | Compact launcher filters by absent `isOnline`. [VERIFIED: codebase grep] | Derive from `presence === "online"`; pass explicit online boolean/bucket into row component. |
| `src/components/friends/FriendActionMenu.tsx` | `FriendActionMenu` row | Always renders grey dot and `presenceLabel`. [VERIFIED: codebase grep] | Render dot/status only when online; offline row renders avatar/name/actions without online-affordance. |
| `src/components/friends/ConversationView.tsx` | message `<p>` at map | Shared bubble used both shells; lacks breaking utility. [VERIFIED: codebase grep] | Add `min-w-0 wrap-anywhere` (and preserve normal newline behavior only if product wants it). |
| `src/components/friends/FriendsHub.test.tsx` | current destination-only test | Insufficient coverage. [VERIFIED: codebase grep] | Add tab URL/query, filtered page/cursor, visual assertions, no cross-tab rows. |
| `src/components/friends/ConversationView.test.tsx` | conversation controller tests | Covers history/reconnect, not bubble layout. [VERIFIED: codebase grep] | Add rendered long normal/unbroken message class assertions for shared desktop/mobile view. |
| `src/lib/server/friends/socialLists.test.ts` | cursor/page test | Proves limit+1 but not bucket scope. [VERIFIED: codebase grep] | Prove bucket-bound cursor and RPC args. |
| `src/app/api/friends/social-lists.route.test.ts` | query test | Only limit/cursor parser assertions. [VERIFIED: codebase grep] | Prove default, online/offline accepted, invalid rejected before adapter. |

### Pattern 1: Presence is one normalized enum

**What:** Use server-provided `presence` as sole rendering/filter source. Define UI buckets as `online` if value is exactly `online`; `offline` otherwise (`recently_active` and `offline`). Do not retain a second `isOnline` field. [VERIFIED: codebase grep]

**When to use:** Every Friends Hub tab, compact launcher count/group, and `FriendActionMenu` visual.

**Example:**

```typescript
const isOnline = friend.presence === "online";
const bucket = isOnline ? "online" : "offline";
```

### Pattern 2: Filter before keyset paging

**What:** SQL applies selected presence bucket in `rows` before cursor predicate, `ORDER BY`, `limit + 1`, and `nextCursor` generation. Cursor must carry/bind bucket identity. [VERIFIED: codebase grep]

**When to use:** Online and Offline tabs with more than 20 rows.

**Example:**

```typescript
const items = rows
  .filter((row) => bucket === "online" ? row.presenceRank === 0 : row.presenceRank !== 0)
  .sort(compareStablePresenceTuple)
  .slice(0, limit + 1);
```

This is conceptual only; production filtering remains SQL/RPC, never browser memory. [VERIFIED: codebase grep]

### Pattern 3: Shared bubble CSS only

**What:** Apply wrapping in `ConversationView`, not desktop dialog or mobile page shell, because both render same component. [VERIFIED: codebase grep]

**Example:**

```tsx
<p className="min-w-0 max-w-[75%] wrap-anywhere rounded-2xl px-3 py-2 text-sm leading-5">
  {message.body}
</p>
```

Source: [Tailwind overflow-wrap documentation](https://tailwindcss.com/docs/overflow-wrap).

### Anti-Patterns to Avoid

- **Client-only page filtering:** Never classify a global 20-row page then label it a complete Online/Offline page. Later matching rows become inaccessible until unrelated pages are fetched. [VERIFIED: codebase grep]
- **Boolean/enum contract drift:** Do not filter by `isOnline` when bounded RPC returns `presence`/`presenceRank` only. [VERIFIED: codebase grep]
- **Reuse a cursor across buckets:** Cursor position is valid only for exact ordered/filter result set. Bind bucket into encoded friends cursor. [VERIFIED: codebase grep]
- **Duplicate chat data controller:** Do not touch `createConversationController`, `before` cursor, merge logic, subscription, or read reconciliation for a layout bug. [VERIFIED: codebase grep]
- **`break-all` by default:** It harms normal word layout; reserve only if explicit product requirement calls for aggressive breaking. [CITED: https://tailwindcss.com/docs/word-break]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive text breaking | JS token splitter / `&shy;` inserter | Tailwind `wrap-anywhere` | Browser CSS handles normal and unbroken text, including flex intrinsic sizing. [CITED: https://tailwindcss.com/docs/overflow-wrap] |
| Presence state | New websocket/presence store | Existing `last_active_at` RPC-derived presence vocabulary | Existing model is authorization-scoped and already updates presence by activity. [VERIFIED: codebase grep] |
| Pagination | Offset paging or client full-list cache | Existing opaque keyset cursor + `limit + 1` adapter | Existing adapter binds destination/version and prevents duplicates/skips. [VERIFIED: codebase grep] |
| Realtime chat merge | A second message subscription/history protocol | Existing invalidation + durable reconcile controller | Existing controller dedupes/order messages and reconciles on reconnect/focus/visibility. [VERIFIED: codebase grep] |

## Common Pitfalls

### Pitfall 1: Missing `isOnline` makes every menu row offline

**What goes wrong:** `FriendsMenu` checks `friend.isOnline`, but Phase 12 bounded RPC output contains `presence` and `presenceRank`, not `isOnline`. Undefined is falsy. [VERIFIED: codebase grep]

**How to avoid:** Make `presence` sole typed contract and derive `isOnline` locally only from strict equality. Test an API-shaped online row through menu/hub rendering. [VERIFIED: codebase grep]

### Pitfall 2: Offline rows still look active

**What goes wrong:** `FriendActionMenu` unconditionally renders dot and presence text. [VERIFIED: codebase grep]

**How to avoid:** Gate both dot and online label on normalized online condition. Do not pass/display `recently active` in Offline tab under Phase 14 requirement. [ASSUMED]

### Pitfall 3: Tab filtering breaks pagination

**What goes wrong:** Current hub loads one generic friend page and can only filter what it has. [VERIFIED: codebase grep]

**How to avoid:** Server filters before cursor/page construction. Clear accumulated items when presence tab changes; use only returned cursor for same bucket. [VERIFIED: codebase grep]

### Pitfall 4: Long token resists width constraint

**What goes wrong:** `max-w-[75%]` limits preferred width but does not instruct a long unbroken token to wrap. [VERIFIED: codebase grep]

**How to avoid:** Add `min-w-0 wrap-anywhere` directly to bubble in shared component. Verify desktop dialog and 375px mobile route. [CITED: https://tailwindcss.com/docs/overflow-wrap]

### Pitfall 5: Realtime update changes category

**What goes wrong:** A friend can cross five-minute threshold or activity update while Online tab is open, leaving stale membership until refetch. Existing social refresh occurs when menu opens, while hub currently has no presence subscription. [VERIFIED: codebase grep]

**How to avoid:** Preserve existing activity/realtime architecture. Planner must locate active social presence invalidation source before adding any listener; on known refresh/invalidation, refetch current bucket from first page rather than moving a row locally. [ASSUMED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy friend overview emits `isOnline` | Phase 12 bounded RPC emits `presence` + `presenceRank` and opaque pages | Phase 12 migration `20260731102000` | UI must consume enum, not obsolete boolean. [VERIFIED: codebase grep] |
| Desktop-only direct-message dialog | Shared `ConversationView` with desktop dialog and mobile full-screen route | Phase 12 Plan 09 | One bubble CSS fix covers both layouts. [VERIFIED: Phase 12 summary] |
| Browser message event as display data | Event invalidates; authenticated history refetches | Phase 12 Plan 09 | Layout fix must not alter transport/reconcile behavior. [VERIFIED: Phase 12 summary] |

**Deprecated/outdated:** `AcceptedFriendSummary.isOnline` as source of truth is stale against current paged `/api/friends` DTO. Replace consumer dependence with `presence`. [VERIFIED: codebase grep]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Offline tab should treat `recently_active` as offline and suppress its label. | Presence pattern / Pitfall 2 | Product may instead require a third tab or “last active” copy; obtain planner/user confirmation if ambiguity matters. |
| A2 | Existing activity/realtime invalidation can trigger/refetch Friends Hub without new transport. | Pitfall 5 | Planner may need a narrowly scoped refresh hook; do not invent WebSocket protocol without evidence. |

## Open Questions (RESOLVED)

1. **Does Offline include `recently_active`? — Resolved**
   - `recently_active` belongs in Offline. It must not render an online ping, dot, or status copy. Confirmed by locked context: friends with `presence === "offline"` or `presence === "recently_active"` appear only in Offline. [VERIFIED: 14-CONTEXT.md locked decision]
2. **Where does presence refresh enter FriendsHub? — Resolved**
   - `FriendsHub` owns bounded refresh. As specified by Plan 14-02, it refetches active bucket first page on focus, visible-document transition, and each 60-second interval; it also schedules a refetch at earliest displayed online `lastActiveAt + 5 minutes`, then cleans up stale callbacks, timers, and listeners on bucket/destination changes or unmount. No online ping/status or realtime transport change. [VERIFIED: 14-02-PLAN.md]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vitest/Next checks | Yes | `v24.11.0` | — [VERIFIED: local shell] |
| npm | Test commands | Yes | `11.6.2` | — [VERIFIED: local shell] |
| Vitest | Focused tests | Yes, project dev dependency | `3.2.4` | — [VERIFIED: package.json] |
| Tailwind CSS | CSS utility compile | Yes, project dependency | `4.x` | Arbitrary `[overflow-wrap:anywhere]` already used elsewhere if utility unavailable. [VERIFIED: package.json] |
| Approved disposable Supabase SQL target | Runtime RPC proof | Not confirmed | — | Static/unit contract tests; SQL execution waits for approved `PHASE12_TEST_DATABASE_URL`. [VERIFIED: `.planning/STATE.md`] |

**Missing dependencies with no fallback:** None for implementation; live SQL behavior still needs approved disposable test target. [VERIFIED: `.planning/STATE.md`]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `3.2.4` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` should be confirmed by planner before execution. [ASSUMED] |
| Quick run command | `npx vitest run src/components/friends/FriendsHub.test.tsx src/components/friends/ConversationView.test.tsx src/lib/server/friends/socialLists.test.ts src/app/api/friends/social-lists.route.test.ts` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOCIAL-09 | Online fetch shows online only; offline fetch shows non-online only; bucket cursor cannot cross-filter; valid paging remains bounded. | unit/route/component | `npx vitest run src/lib/server/friends/socialLists.test.ts src/app/api/friends/social-lists.route.test.ts src/components/friends/FriendsHub.test.tsx` | Extend existing |
| SOCIAL-09 | Offline row has no status dot/text; online row retains both. | component | `npx vitest run src/components/friends/FriendsHub.test.tsx` | Add/extend focused row test |
| SOCIAL-10 | Unbroken 2,000-character body and space-separated long body render bubble `min-w-0 wrap-anywhere`; desktop/mobile both reuse view. | component | `npx vitest run src/components/friends/ConversationView.test.tsx` | Extend existing |
| SOCIAL-10 | History cursor, message dedupe, reconnect, read/send remain unchanged. | unit | `npx vitest run src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts` | Existing |

### Required Test Cases

1. API/RPC adapter: default or explicit `online` passes correct bucket; `offline` passes non-online bucket; invalid query fails before RPC. [VERIFIED: codebase grep]
2. Cursor: online cursor decoded for offline request throws generic `social_unavailable`; equal usernames/presence retain stable user-ID tie breaker. [VERIFIED: codebase grep]
3. Hub: tab switch resets prior rows/cursor and starts selected bucket; Load more appends only returned matching page, deduped. [VERIFIED: codebase grep]
4. Row rendering: online has existing dot/status; offline/recently-active has neither. [VERIFIED: codebase grep]
5. Message rendering: whitespace-normal sentence wraps; long no-space token has `wrap-anywhere`; test view in mobile route class and desktop dialog shell. [CITED: https://tailwindcss.com/docs/overflow-wrap]
6. Manual two-account: transition an accepted friend through active/inactive threshold, refresh/reopen pages, paginate >20 in each bucket, send 2,000-char no-space and normal long message at 375px and desktop. [ASSUMED]

### Sampling Rate

- **Per task commit:** focused Vitest command above.
- **Per wave merge:** `npm run typecheck && npm run lint`.
- **Phase gate:** `npm run build`, focused two-account desktop/mobile check, and approved SQL proof when test DB exists.

### Wave 0 Gaps

- [ ] Extend `FriendsHub.test.tsx`; current file only tests five destination constants. [VERIFIED: codebase grep]
- [ ] Add/extend row-presence rendering test for `FriendActionMenu`. [VERIFIED: codebase grep]
- [ ] Extend `ConversationView.test.tsx` with DOM rendering/layout-class assertions; it currently tests controller/class shell only. [VERIFIED: codebase grep]
- [ ] Add SQL proof for bucket behavior only when `PHASE12_TEST_DATABASE_URL` is explicitly approved. [VERIFIED: `.planning/STATE.md`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Preserve `requireApiUser` before list parsing/adapter call. [VERIFIED: codebase grep] |
| V3 Session Management | Yes | Existing authenticated Supabase session and private channel remain unchanged. [VERIFIED: codebase grep] |
| V4 Access Control | Yes | RPC keeps `auth.uid()` accepted-friend/block predicate and authenticated-only grants. [VERIFIED: codebase grep] |
| V5 Input Validation | Yes | Validate presence enum, cursor, and limit before RPC. [VERIFIED: codebase grep] |
| V6 Cryptography | No new crypto | No new cryptography; do not change existing opaque cursor encoding security boundary. [VERIFIED: codebase grep] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-bucket cursor replay | Tampering / Information disclosure | Include presence bucket in cursor payload/version validation; reject mismatch generically. [VERIFIED: codebase grep] |
| Client-selected friend membership | Information disclosure | Keep bucket predicate inside `auth.uid()`-scoped RPC; never accept user ID filter. [VERIFIED: codebase grep] |
| Unsafe message rendering | Tampering | Continue React plain-text interpolation; no HTML rendering or token splitting. [VERIFIED: codebase grep] |
| Realtime payload becomes authoritative | Tampering / Repudiation | Keep event-as-invalidation and authenticated durable history reconcile. [VERIFIED: Phase 12 summary] |

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS overflow-wrap](https://tailwindcss.com/docs/overflow-wrap) — `wrap-anywhere` semantics and flex-container guidance.
- `supabase/migrations/20260731102000_phase12_bounded_social_lists.sql` — actual presence ranks, social page RPC, cursor order, access grants. [VERIFIED: codebase grep]
- `src/lib/server/friends/socialLists.ts`, `src/app/api/friends/route.ts`, `src/lib/client/friends.ts` — current bounded list contract. [VERIFIED: codebase grep]
- `src/components/layout/FriendsMenu.tsx`, `src/components/friends/FriendActionMenu.tsx`, `src/components/friends/FriendsHub.tsx` — actual UI defect sites. [VERIFIED: codebase grep]
- `src/components/friends/ConversationView.tsx` — shared desktop/mobile bubble source. [VERIFIED: codebase grep]
- `.planning/phases/12-study-together/12-08-SUMMARY.md`, `12-09-SUMMARY.md` — established pagination and durable chat constraints. [VERIFIED: project plans]

### Secondary (MEDIUM confidence)
- [Tailwind CSS word-break](https://tailwindcss.com/docs/word-break) — `break-all` tradeoff. [CITED: https://tailwindcss.com/docs/word-break]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages are already installed; no install required. [VERIFIED: package.json]
- Architecture: HIGH — exact current SQL/API/client/component chain inspected. [VERIFIED: codebase grep]
- Pitfalls: HIGH — contract mismatch and unconditional row UI visible in source; presence-refresh hook scope remains MEDIUM. [VERIFIED: codebase grep]

**Research date:** 2026-08-01
**Valid until:** 2026-08-31
