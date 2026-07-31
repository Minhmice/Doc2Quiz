# Phase 12: Study Together - Research

**Researched:** 2026-07-31
**Domain:** Durable asynchronous social quiz challenges on Next.js + Supabase
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Product loop
- Friends exist to help users study, compare progress, and return; chat, profile, and reactions are support layers.
- Primary loop: discover/add friend → accepted → see activity → share quiz/send challenge → recipient practices → result returns → react/message → repeat.
- `Study together` is per-friend main action.
- Topbar friends menu is compact launcher with Requests, Active friends, Study invites, and Unread messages; it is not full management.
- Full `/friends` owns Friends, Requests, Invites, Messages, and Blocked users.

### Challenge creation
- `Study together` opens drawer/modal with recipient preselected.
- Creator chooses one existing quiz, practice or score mode, deadline, optional message, then sends.
- Defaults: score challenge, no deadline, one attempt, reveal results after both finish.
- Deadline options: none, 24 hours, 3 days, 7 days, custom.
- First MVP source supports only creator-owned quizzes. Server transaction requires owner equals current user, published status, not deleted, and at least one question.

### Generic study-session foundation
- Model `study_sessions.type` now as `asynchronous_challenge | live_session`; implement asynchronous only.
- Session state: `pending | active | completed | expired | cancelled`.
- Participant state: `invited | not_started | in_progress | completed | declined`.
- Terminal session outcomes must be explicit. Challenger may start before recipient accepts.
- Persist challengers/recipients, immutable quiz snapshot/version/hash, mode, deadline, status, participant attempts, score/accuracy/duration, completion timestamps, and result visibility.

### Immutable source snapshot
- Authorize source then snapshot then create session/participants/notification in one transaction.
- Snapshot stores source quiz id, source owner id, version/hash, title/metadata, questions/answer keys, source type, timestamp.
- Source type supports `owned_quiz | friend_shared_quiz`; implement only `owned_quiz`.
- Source edits/deletion/ownership transfer never alter existing session. Future share revocation blocks new challenges only.
- Recipient receives session-snapshot access after accepting, not original quiz access; cannot export, duplicate, resend, edit, or read answer keys before submission.

### Acceptance and results
- `Accept & start` validates pending/non-expired invite; transitions recipient invited → in-progress and session pending → active; creates or reopens one recipient attempt; emits acceptance notification; commits; returns quiz route.
- Acceptance is idempotent. Double click returns same attempt. Failed navigation leaves resumable session in inbox.
- Existing attempt reopens. Browser close before answer keeps in-progress. Snapshot load failure retries; it never rolls back acceptance.
- Result visibility supports immediate, after both complete, after deadline. Default is after both complete to prevent answer leakage.

### Notifications and realtime
- Database notifications are source of truth. Flow: insert notification → commit → broadcast. Broadcast failure never fails previously committed action.
- MVP notification types: study_challenge_received, study_challenge_accepted, study_challenge_declined, study_challenge_completed, study_challenge_result_ready, study_challenge_expiring.
- Record has recipient, actor, type, entity type/id, display-only payload, created/read/archived timestamps, dedupe key.
- Topbar badge combines unread notifications and unread messages but internally retains separate counts.
- Opening dropdown never marks all as read; opening target marks targeted item read. Mark all as read exists. Accept/decline can archive invite notification.
- Routes: list notifications, read one, read all, unread count. Realtime topic: `social-notifications:{userId}`.
- Reconnect/window focus refetches unread count + newest page. Deadline-minus-24h reminder is dedupe-keyed, no email in MVP.

### Existing social fixes
- Add remove friend; blocking is distinct.
- Chat must be responsive; replace desktop-only floating chat limitation with mobile drawer/full-screen route.
- Persist reactions/notifications; no broadcast-only user-visible state.
- Realtime request/message badge updates.
- Centralize API error mapping and typed Supabase RPC contract.
- Move social copy into locale files.
- Cache avatar URLs or use safe stable proxy/public URLs.
- Use existing message cursor for infinite scroll.
- Presence vocabulary: online, recently active, offline; avoid false precision.

### Claude's Discretion
- Exact schema/table names, routes, component names, app-state shape, session practice route, and migration breakdown.
- UI implementation uses established product design system and accessible standard components.
- Define practical deadline custom validation and scheduler adapter after examining deployment capabilities.

### Deferred Ideas (OUT OF SCOPE)
- Live synchronized session implementation (schema type reserved now).
- Challenges using friend-shared quizzes.
- Email and external channels.
- Discord-like social features, reaction-first feeds, public profile browsing as primary loop.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SOCIAL-01 | Accepted friend receives async challenge from eligible owned quiz. | `private.social_are_accepted_friends`; source lookup and snapshot RPC. |
| SOCIAL-02 | Server authorization plus immutable snapshot. | Transactional `SECURITY DEFINER` RPC and snapshot-only practice DTO. |
| SOCIAL-03 | Lifecycle, attempts, metrics, deadline, reveal policy. | Dedicated session/participant/attempt tables with constraints and indexes. |
| SOCIAL-04 | Recipient accepts and starts idempotently. | Unique `(session_id,user_id)` attempt plus locked RPC. |
| SOCIAL-05 | Decline/resume/unavailable states. | Explicit statuses and session route DTO. |
| SOCIAL-06 | Reveal comparison only when allowed. | Server computes visibility and strips answer keys from recipient DTO. |
| SOCIAL-07 | Durable notification before realtime, reconcileable badge. | Notification table, DB trigger broadcast, refetch on focus/reconnect. |
| SOCIAL-08 | Separate friend actions. | Extend `FriendActionMenu`; add `remove_friend` RPC, do not reuse block. |
| SOCIAL-09 | Scalable `/friends` plus compact topbar. | Dedicated route and list endpoints; retain topbar launcher. |
| SOCIAL-10 | Durable responsive chat with safe realtime. | Existing cursor/message RPC and private channel reused behind mobile route/drawer. |
</phase_requirements>

## Summary

Existing quiz source is workspace-era `public.learning_outputs` (`kind = 'quiz'`, `status = 'ready'`, `deleted_at is null`) with `public.approved_questions` keyed by `output_id`; this is current canonical output surface. `approved_questions` stores `prompt`, four `choices`, `correct_index`, `explanation`, `source`, timestamps. The older `study_sets` path remains in practice client code, but its `approved_questions` definition uses `study_set_id`; Phase 12 must snapshot from current `learning_outputs` shape and must not couple challenge attempts to old `study_sessions`. [VERIFIED: codebase grep; `supabase/migrations/20260730150000_workspace_foundation.sql`; `supabase/migrations/20260725120000_v21_baseline.sql`]

Use new social tables and transaction RPCs, not browser writes. Existing social schema already hides tables behind `SECURITY DEFINER` RPCs, validates authenticated friendship in `private.social_are_accepted_friends`, locks mutation rows with `FOR UPDATE`, revokes default grants, then grants named RPCs to `authenticated`. Continue exact pattern. [VERIFIED: `supabase/migrations/20260730170000_friends_messages_presence.sql`; `supabase/migrations/20260730140500_phase10_social_list_respond_rpcs.sql`; CITED: https://supabase.com/docs/guides/database/functions]

Current broadcast helper is best-effort for messages but reaction route turns failure into HTTP 503 despite the DB action succeeding. Challenges and notifications must not copy that behavior: durable write commits first, then database trigger uses `realtime.send`; no caller waits for broadcast success. Client merges event as hint then refetches authoritative badge/newest page on subscribe recovery, focus, and visibility. [VERIFIED: `src/lib/server/friends/realtimeBroadcast.ts`; `src/app/api/friends/reactions/route.ts`; CITED: https://supabase.com/docs/guides/realtime/broadcast]

**Primary recommendation:** Create dedicated immutable `study_together_*` tables with security-definer RPC authority; build snapshot practice as a thin reuse/extraction of `QuizSession` interaction UI while server owns questions, progress, scoring, reveal, notifications, and all state transitions.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Challenge source authorization and immutable snapshot | Database / Storage | API / Backend | Source, friendship, snapshot, participant, notification must commit atomically. |
| Session lifecycle, attempts, scoring, reveal policy | Database / Storage | API / Backend | Prevent duplicate accepts, forged metrics, and answer leakage. |
| Challenge API validation and DTO shaping | API / Backend | Database / Storage | Next route validates request, invokes typed RPC, returns safe DTO. |
| Durable notification reconciliation | Database / Storage | Browser / Client | Database is authority; client queries and presents it. |
| Realtime acceleration | Database / Storage | Browser / Client | Trigger emits private broadcast after write; client treats it as invalidation hint. |
| Quiz interaction | Browser / Client | API / Backend | Existing keyboard-first interaction UI adapts to snapshot DTO; submits mutations server-side. |
| Friends hub and responsive chat | Browser / Client | API / Backend | Route/drawer owns responsive shell; existing API/RPC pagination remains source. |
| Deadline reminder | Database / Storage | API / Backend | Scheduled DB function scans/write-dedupes; scheduler must be deployment-confirmed. |

## Standard Stack

### Core

| Library / platform | Version | Purpose | Why standard |
|---|---:|---|---|
| PostgreSQL / Supabase RPC | Existing Supabase project | Atomic challenge, attempt, notification transitions | Existing social mutations already use controlled SQL RPCs. [VERIFIED: codebase migrations] |
| `@supabase/supabase-js` | `^2.110.8` installed | Browser private Realtime channels and RPC calls | Existing social clients use it. [VERIFIED: `package.json`] |
| Next.js route handlers | `^16.2.11` installed | Authenticated HTTP boundary, Zod validation, safe DTOs | Existing social routes use `requireApiUser`. [VERIFIED: `package.json`; codebase routes] |
| Zod | `^4.4.3` installed | Validate UUIDs, enum modes, deadline/message bounds | Existing friend message/reaction routes use it. [VERIFIED: `package.json`; `src/app/api/friends/messages/[conversationId]/route.ts`] |
| Vitest | `^3.2.4` installed | RPC adapter and route contract tests | Existing social route suite uses Vitest. [VERIFIED: `package.json`; `vitest.config.ts`; `friends.route.test.ts`] |

### Supporting

| Platform | Purpose | When to use |
|----------|---------|-------------|
| Supabase Realtime Broadcast | Private notification/message invalidation | After durable notification/message state write. [CITED: https://supabase.com/docs/guides/realtime/broadcast] |
| Supabase Cron / `pg_cron` | Deadline-expiring notification sweep | Only after project operator confirms/enables Cron. [CITED: https://supabase.com/docs/guides/cron/install] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated challenge attempt tables | Reuse legacy `study_sessions` | Reject. Legacy schema FK requires recipient-owned `study_sets`; snapshot IDs/questions do not satisfy it. [VERIFIED: `20260726150000_resumable_study_sessions.sql`] |
| DB-trigger broadcast | Server `httpSend` helper | Reject for notifications. Server helper is post-commit and can fail after write; DB trigger preserves durable-first semantics without changing action result. [VERIFIED: `realtimeBroadcast.ts`; CITED: broadcast docs] |
| Scheduled reminder | In-process timer | Reject. No durable multi-instance scheduler exists in app. [VERIFIED: codebase scheduler search] |

**Installation:** None. Existing platform and dependencies cover Phase 12. [VERIFIED: `package.json`]

## Architecture Patterns

### System Architecture Diagram

```text
Creator browser
  → POST /api/friends/study-challenges (Zod)
  → create_study_challenge RPC
      → auth.uid + accepted-friend check
      → lock/validate owner-owned ready non-deleted quiz
      → build canonical snapshot JSON + digest
      → insert session + two participants + creator attempt if started
      → insert recipient notification (unique dedupe key)
      → commit
      → notification AFTER INSERT trigger calls realtime.send
  → safe challenge DTO

Recipient browser
  → GET notifications/invites (durable source)
  → POST accept → accept_study_challenge RPC
      → lock session/participant
      → check pending and deadline
      → insert-or-return unique recipient attempt
      → update invited/in-progress and session active
      → insert acceptance notification → commit → broadcast
  → /friends/study/[sessionId]/play
  → GET snapshot practice DTO (no answer keys until submission)
  → PATCH attempt progress / POST complete
      → server scores against private snapshot answer keys
      → stores metrics + evaluates result visibility + durable notifications

Private Broadcast `social-notifications:{userId}`
  → connected browser invalidates/refetches unread count + newest notifications
  → focus / visibility / channel rejoin does same reconciliation
```

### Recommended Project Structure

```text
supabase/migrations/
└── 20260731xxxx_phase12_study_together.sql  # tables, constraints, RLS, RPCs, notification trigger
src/lib/server/friends/
├── studyTogether.ts                          # typed RPC result/error mapper
└── realtimeBroadcast.ts                      # retain for existing messages only
src/lib/client/
├── studyTogether.ts                          # HTTP client and safe DTO types
└── messages.ts                               # reuse cursor API, do not duplicate history logic
src/app/api/friends/
├── study-challenges/route.ts                 # list/create
├── study-challenges/[sessionId]/accept/route.ts
├── study-challenges/[sessionId]/attempt/route.ts
└── notifications/route.ts                    # list/count/read operations
src/app/(app)/friends/
├── page.tsx                                  # hub sections
└── study/[sessionId]/play/page.tsx           # snapshot practice route
src/components/friends/
├── StudyChallengeDialog.tsx
├── StudyChallengePractice.tsx
├── NotificationsMenu.tsx
└── DirectMessageDialog.tsx                   # desktop presentation; route/drawer reuses conversation logic
```

### Pattern 1: Snapshot format separates internal answer keys from recipient DTO

**What:** Persist a single JSON snapshot with question IDs, prompt, choices, correct index, explanation, source metadata, and SHA-256 digest. RPC returns two projections: participant practice payload excludes `correctIndex` and `explanation` until permitted; server scoring reads private snapshot. Snapshot question IDs must be new session-local IDs or positional IDs, never editable source IDs used as authority.

**When to use:** Every challenge read and attempt submit.

**Evidence:** `QuizSession` only needs `id`, prompt, four choices, and correct index for local behavior, but presently loads mutable bank directly and records browser-side completion. Therefore Phase 12 can reuse visual/keyboard interaction, not its data loading or completion persistence. [VERIFIED: `src/components/quiz/QuizSession.tsx`; `src/lib/client/activityTracking.ts`]

### Pattern 2: Mutation RPC owns state machine and idempotency

**What:** Put create, accept/start, decline, save progress, complete attempt, remove friend, notification read/all-read in named RPCs. Each begins with `auth.uid()`, validates inputs/states, locks target rows (`FOR UPDATE`), returns deterministic JSON DTO/error token, has `SECURITY DEFINER` with restricted `search_path`, revokes public/anon execute, then grants only `authenticated`.

**When to use:** Any mutation involving two users, source authorization, notification writes, or result policy.

**Example:**

```sql
-- Source: existing social RPC pattern + Supabase function security guidance.
create or replace function public.accept_study_challenge(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  -- Lock session + recipient participant; validate deadline/status.
  -- Insert attempt with unique(session_id, participant_id), returning existing on conflict.
  -- Update statuses and insert durable notification in same transaction.
  return jsonb_build_object('attemptId', v_attempt_id);
end;
$$;
revoke all on function public.accept_study_challenge(uuid) from public, anon;
grant execute on function public.accept_study_challenge(uuid) to authenticated;
```

[CITED: https://supabase.com/docs/guides/database/functions; VERIFIED: existing social RPC migrations]

### Pattern 3: Notification outbox is table plus DB trigger, not a server retry queue

**What:** `social_notifications` has durable display payload and a per-recipient non-null `dedupe_key` unique index. `AFTER INSERT` trigger calls `realtime.send(payload, 'notification', 'social-notifications:' || recipient_id, true)`. Payload contains notification ID only or safe non-sensitive summary. Client refetches by ID/list; it never trusts broadcast as full record.

**When to use:** Challenge received/accepted/declined/completed/result-ready/expiring. Reactions need same durable table or a separate durable `social_reactions` record before broadcast.

**Why:** Official docs identify `realtime.send` as custom-payload DB broadcast and document private channel/RLS matching. Current reaction flow violates phase decision by returning 503 after durable RPC succeeds when its best-effort broadcast fails. [CITED: https://supabase.com/docs/guides/realtime/broadcast; VERIFIED: `src/app/api/friends/reactions/route.ts`]

### Pattern 4: Reconciliation beats event delivery guarantees

**What:** On successful channel subscribe/rejoin, `window.focus`, and `document.visibilitychange` to visible, request `/api/friends/notifications?limit=...` plus `/unread-count`; merge by notification ID. Broadcast only schedules same refetch. Keep message history loading with existing `before` cursor; add a mobile page/drawer that uses same conversation client rather than two independent state implementations.

**Evidence:** Existing reaction overlay already listens to focus/visibility and cleans private channel; existing messages endpoint supports `before` and server RPC enforces limit 1–100. Current DM dialog only renders `md:flex`, hence entirely hidden on mobile. [VERIFIED: `PlayfulReactionOverlay.tsx`; `DirectMessageDialog.tsx`; `src/lib/client/messages.ts`; messaging migration]

### Anti-Patterns to Avoid

- **Write challenge/attempt directly from browser:** bypasses owner/friend/deadline/reveal authority and permits forged values. Use RPC/API only.
- **Return snapshot answer keys to recipient before completion:** client can inspect network payload. Project answer data must stay server-side until reveal permits it.
- **Use `learning_output_friend_shares` for challenge access:** Phase scope is creator-owned source only; shares are deferred and revocation behavior differs.
- **Treat `httpSend` success as action success:** failed broadcast must not convert committed durable action into error.
- **Mark all notifications read when menu opens:** contradicts locked notification behavior.
- **Duplicate DM history/realtime implementation for mobile:** reuse existing cursor and conversation authority.
- **Timer in Next process/browser for expiration:** restarts, closes, and multi-instance deployments lose it.

## Concrete Data and RPC Recommendation

### Tables and constraints

1. `public.study_together_sessions`
   - `id`, `type` check `asynchronous_challenge|live_session`, `source_type` check `owned_quiz|friend_shared_quiz`, `creator_id`, `source_output_id`, `source_owner_id`, `source_version`, `snapshot_hash`, `snapshot jsonb`, `mode` check `practice|score`, `deadline_at`, `result_reveal_policy` check `immediate|after_both_complete|after_deadline`, `status`, timestamps.
   - Check source type is `owned_quiz` in Phase 12 creation RPC; enum reserves deferred type without exposing it.
   - `snapshot` includes output title/metadata and ordered question objects. Validate non-empty question array in RPC. Hash canonical JSON after stable ordering. Hash detects accidental mismatch; stored snapshot itself is authority. [ASSUMED]

2. `public.study_together_participants`
   - `session_id`, `user_id`, `role` check `creator|recipient`, status, attempt limit default 1, completion metrics fields, timestamps; `unique(session_id,user_id)` and `unique(session_id,role)`.

3. `public.study_together_attempts`
   - `id`, `session_id`, `participant_id`, `attempt_number`, `status`, `answers jsonb`, `current_question_index`, `started_at`, `updated_at`, `completed_at`, computed-at-completion metrics.
   - `unique(session_id,participant_id,attempt_number)` enforces one attempt. Retain answers private; recipient’s result DTO exposes own answers only as product needs, never peer answer selections. [ASSUMED]

4. `public.social_notifications`
   - `id`, `recipient_id`, `actor_id`, constrained type/entity type, `entity_id`, `payload jsonb`, `dedupe_key`, `created_at`, `read_at`, `archived_at`.
   - Unique partial index `(recipient_id, dedupe_key) where archived_at is null` is insufficient for once-only reminder after archive; use full `unique(recipient_id, dedupe_key)` unless product deliberately permits repeat event. [ASSUMED]
   - Index `(recipient_id, read_at, created_at desc)` and `(entity_id, recipient_id)`.

5. `public.social_reactions` if reactions remain user-visible durable state: sender/recipient/reaction/entity/timestamps, dedupe/rate-limit contract. This avoids broadcast-only delivery. [ASSUMED]

### RLS and authorization

- Enable RLS and revoke direct authenticated table grants, as present social tables do. Expose participant-scoped read only through safe RPC DTOs initially; direct table policies may safely allow notification owner reads/updates only, but never raw snapshot/attempt records. [VERIFIED: social tables revoke direct grants; CONTEXT locked no answer leakage]
- `create_study_challenge` validates caller equals `learning_outputs.created_by`, `kind = 'quiz'`, `status = 'ready'`, `deleted_at is null`, source has `count(*) > 0`, and `private.social_are_accepted_friends(caller, recipient)`. Current output schema and social helper support each check. [VERIFIED: `20260730150000_workspace_foundation.sql`; `20260730170000_friends_messages_presence.sql`; `20260731001500_friend_profile_shared_quizzes.sql`]
- Lock output and friendship/request rows during create where relevant, then snapshot in same function. A friend removal/block occurring after commit cannot mutate prior snapshot; it can prevent future action. [ASSUMED: exact locking coverage requires schema decision]
- `accept_study_challenge` locks session and recipient participant and uses `INSERT ... ON CONFLICT` into attempts. On existing in-progress attempt, return it; on completed/declined/expired, return generic unavailable reason mapped at HTTP boundary. [VERIFIED: existing direct conversation uses `ON CONFLICT`; existing friend response uses `FOR UPDATE`; exact challenge contract is ASSUMED]
- `complete_study_attempt` locks attempt and rejects duplicate completion. It calculates score server-side from private snapshot answer keys, updates participant/session status, evaluates reveal policy, inserts all notifications inside same transaction. [ASSUMED: required implementation design based on locked policy]
- `remove_friend(p_other_user_id)` must change accepted `friend_requests` row to `cancelled` under lock, not insert a block. Existing friend relationship is represented solely by accepted request; `block_user` only cancels pending requests today and is distinct. [VERIFIED: social safety and messaging migrations; CONTEXT]

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic cross-user lifecycle | Sequential API inserts/updates | One Postgres RPC transaction | Existing source-of-truth logic already belongs in RPCs. |
| Quiz snapshot integrity | Client-generated question copy | Server-built JSON snapshot + stored digest | Client has mutable/untrusted source and can omit answer data. |
| Duplicate accept protection | Button disabling only | DB unique constraint + lock + idempotent RPC | Double clicks, retries, and multiple tabs bypass UI state. |
| Realtime reliability | Broadcast retry queue as authority | Durable notifications + reconciliation fetch | Broadcast is acceleration, not ledger. |
| Private topic authorization | Client-side topic naming checks | `realtime.messages` RLS and private channels | Server/client topic secrecy is not access control. [CITED: https://supabase.com/docs/guides/realtime/authorization] |
| Deadline execution | Browser/Node timers | Supabase Cron when provisioned | Timers are not durable across server restart/deploy. |
| Message infinite scroll | New pagination scheme | Existing `before` timestamp cursor, max 50/100 RPC | Existing contract already supports it. |

## Common Pitfalls

### Pitfall 1: Canonical schema mismatch
**What goes wrong:** Planner extends old `study_sets`/`approved_questions.study_set_id` practice flow, while current share/profile source queries `learning_outputs` and `approved_questions.output_id`.

**Why:** Repository contains both legacy baseline and workspace migrations; client quiz UI still loads `studySetId`.

**How to avoid:** Challenge create RPC reads current output schema only and creates standalone snapshot attempt schema. Snapshot route must not call `getApprovedBank(studySetId)`.

**Warning signs:** Migration fails on missing `output_id`, challenge source is editable/deleted in session, or recipient is asked for source study set access.

### Pitfall 2: Answer leakage through DTO or browser scoring
**What goes wrong:** Correct indices/explanations ship before submit, or client posts claimed score.

**Why:** Existing `PlaySession` keeps full `Question` including `correctIndex` and calculates correctness in browser.

**How to avoid:** Split internal snapshot from participant DTO; server scores submitted selected indices. Reuse interaction layout/keyboard behavior only.

**Warning signs:** Network response contains `correctIndex` prior to `complete`, or completion endpoint accepts `correctCount` as authority.

### Pitfall 3: Broadcast failure falsely reports mutation failure
**What goes wrong:** Creator sees send failed but invite exists, or client retries and creates duplicate semantic work.

**Why:** Current reaction route returns 503 when post-RPC `httpSend` returns false.

**How to avoid:** Notification insert and mutation commit in RPC; DB trigger broadcast cannot alter successful mutation response. Client refetches durable state after request error or focus.

**Warning signs:** HTTP error after session ID was generated, duplicate notification/event rows, or retry creates new attempt.

### Pitfall 4: Realtime topic exposes social state
**What goes wrong:** Any user subscribes to `social-notifications:{id}` or conversation topics.

**Why:** Topic string is predictable; privacy depends on `realtime.messages` RLS, not unguessability.

**How to avoid:** Add recipient-only `SELECT` policy restricted to `extension='broadcast'` and `realtime.topic() = 'social-notifications:' || auth.uid()::text`; use `{ config: { private: true } }`. Confirm project Realtime has Allow public access disabled. [CITED: https://supabase.com/docs/guides/realtime/authorization]

**Warning signs:** RLS policy is broad authenticated `using (true)`, topic prefix does not include authenticated user, or public channel configured.

### Pitfall 5: Scheduler assumed available
**What goes wrong:** Migration schedules reminder but deployed Supabase project lacks enabled `pg_cron`, or a job is never monitored.

**Why:** Repo contains no `supabase/config.toml`, `vercel.json`, scheduler dependency, Cron SQL, or deployment declaration.

**How to avoid:** Build reminder function and dedupe table/index in Phase 12; schedule only after human confirms Dashboard Cron module/service. The local Supabase CLI is installed (`2.109.1`), but no local project configuration proves hosted Cron availability. [VERIFIED: codebase search; local environment; CITED: https://supabase.com/docs/guides/cron/install]

**Warning signs:** No `cron.job`/dashboard job, reminder records missing, or duplicate reminders from rerun.

### Pitfall 6: Mobile chat is invisibility, not responsiveness
**What goes wrong:** Existing desktop dialog remains hidden on mobile.

**Why:** Root section has `hidden md:flex` while open.

**How to avoid:** Extract conversation body/controller or render a dedicated `/friends/messages/[conversationId]` page/full-screen drawer for small screens; preserve `listDirectMessages(before)` cursor and private channel contract.

**Warning signs:** Friend menu opens chat but no DOM is visible below `md` breakpoint.

## Code Examples

### Safe notification trigger

```sql
-- Source: Supabase Realtime Broadcast docs.
create or replace function public.broadcast_social_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('notificationId', new.id),
    'notification',
    'social-notifications:' || new.recipient_id::text,
    true
  );
  return new;
end;
$$;

create trigger social_notifications_broadcast_insert
  after insert on public.social_notifications
  for each row execute function public.broadcast_social_notification();
```

[CITED: https://supabase.com/docs/guides/realtime/broadcast]

### Client reconciliation shape

```typescript
useEffect(() => {
  const reconcile = () => void refreshNotifications();
  const channel = supabase
    .channel(`social-notifications:${userId}`, { config: { private: true } })
    .on("broadcast", { event: "notification" }, reconcile)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") reconcile();
    });

  window.addEventListener("focus", reconcile);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconcile();
  });
  return () => void supabase.removeChannel(channel);
}, [supabase, userId, refreshNotifications]);
```

This is proposed code. Existing channel setup/cleanup and focus/visibility pattern are in `DirectMessageDialog.tsx` and `PlayfulReactionOverlay.tsx`. [VERIFIED: codebase]

## State of the Art

| Old approach | Current approach | Impact |
|--------------|------------------|--------|
| Server calls `channel.httpSend` after mutation | DB `realtime.send` trigger for durable notification invalidation | Broadcast remains non-authoritative and cannot make a committed mutation fail. [CITED: https://supabase.com/docs/guides/realtime/broadcast] |
| Mutable source bank loaded by `studySetId` | Immutable session snapshot, safe projection, server scoring | Session survives source mutation and protects answers. [ASSUMED: required adaptation] |
| Floating desktop-only DM dialog | Shared conversation data logic plus mobile page/drawer | Responsive access without duplicate chat protocol. [VERIFIED: existing dialog hidden below `md`; implementation route is ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Snapshot digest should be SHA-256 of canonical JSON and acts as integrity signal, not authorization primitive. | Concrete Data and RPC Recommendation | Different digest/canonicalization convention needed. |
| A2 | Session-local question IDs/positions best prevent source IDs becoming authority. | Snapshot pattern | Migration/DTO field choice changes. |
| A3 | Attempt table should retain submitted answer records private and expose only permitted DTO slices. | Concrete Data and RPC Recommendation | UI/result payload scope needs product confirmation. |
| A4 | Full `(recipient_id, dedupe_key)` notification uniqueness best enforces once-only reminders. | Concrete Data and RPC Recommendation | Product may require repeated events with same semantic key. |
| A5 | Row locks should cover source and friendship membership during create. | RLS and authorization | Exact race semantics need SQL test proof. |
| A6 | Dedicated mobile message page/drawer can share current conversation transport cleanly. | Mobile chat | Component extraction scope may be larger than expected. |

## Open Questions

1. **What exposes “published” for current `learning_outputs`?**
   - What we know: current schema/source filters prove `kind='quiz'`, `status='ready'`, `deleted_at is null`; no `published` field was found in inspected migration/schema. [VERIFIED: `20260730150000_workspace_foundation.sql`; share migrations]
   - What's unclear: CONTEXT says published, but current data model uses ready status and no visible publish column.
   - Recommendation: Treat `status='ready'` as current eligible state only if product owner confirms it is intended published equivalent; otherwise add explicit publication state before challenge creation.

2. **Which scheduler is provisioned in deployed Supabase?**
   - What we know: local `supabase` CLI exists; repo has no scheduler config/job; Supabase Cron is supported only after module enablement. [VERIFIED: environment/codebase; CITED: https://supabase.com/docs/guides/cron/install]
   - What's unclear: hosted project Cron entitlement/enabled state and operator ownership.
   - Recommendation: Human checkpoint before creating `cron.schedule`; ship callable idempotent reminder sweep first.

3. **Does remove-friend cancel active sessions or only future social actions?**
   - What we know: locked context says remove is distinct from block and snapshots survive source changes/revocation.
   - What's unclear: participant access semantics after friendship removal/block for active session and chat history.
   - Recommendation: Lock explicit policy before writing RLS: preserve a valid active session to completion, but block all new challenges/messages; or cancel outstanding invites. Do not let implicit friend predicate silently revoke snapshot access.

4. **How should creator start their own one-attempt challenge?**
   - What we know: challenger may start before recipient accepts; default one attempt.
   - What's unclear: whether create immediately creates creator attempt or separate start action.
   - Recommendation: `start_study_challenge_attempt` uses same idempotent attempt primitive as accept, but creator can invoke it while pending. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next/Vitest project | ✓ | `v24.13.1` | — |
| npm | scripts/dependencies | ✓ | `11.6.2` | — |
| Supabase CLI | local migration/status investigation | ✓ | `2.109.1` | Dashboard/CI migration path |
| Docker | local Supabase runtime if configured | ✓ | `29.6.1` | hosted project |
| PostgreSQL `psql` | direct local SQL inspection | ✗ | — | Supabase CLI / Dashboard SQL editor |
| Supabase Cron | expiring reminder job | Unknown | — | callable sweep with operator-scheduled external trigger; do not claim feature complete without scheduler |

**Missing dependencies with no fallback:** None for code implementation. Hosted scheduler confirmation blocks automated deadline reminder activation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.4` |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/app/api/friends/friends.route.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SOCIAL-01/02 | create rejects self/nonfriend/nonowner/non-ready/deleted/empty source; stored snapshot unchanged after source mutation | SQL/RPC integration + route unit | `npx vitest run src/app/api/friends/study-challenges/*.test.ts` | ❌ Wave 0 |
| SOCIAL-03/04/05 | lifecycle transitions, duplicate accept returns same attempt, decline/expired/resume behavior | SQL/RPC integration | `npx vitest run src/lib/server/friends/studyTogether.test.ts` | ❌ Wave 0 |
| SOCIAL-06 | recipient practice DTO excludes answers; completion/reveal policy gates comparison | route/RPC unit | `npx vitest run src/app/api/friends/study-challenges/*.test.ts` | ❌ Wave 0 |
| SOCIAL-07 | notification unique dedupe, unread/read/all, broadcast failure does not alter committed RPC result | SQL integration + route unit | `npx vitest run src/app/api/friends/notifications/*.test.ts` | ❌ Wave 0 |
| SOCIAL-08/09 | separate remove/block actions and `/friends` destinations render | component/static route test | `npx vitest run src/components/friends/*.test.tsx` | Partial — social tests exist |
| SOCIAL-10 | message cursor preserved, mobile chat route/drawer renders, incoming realtime invalidates history | component/client test | `npx vitest run src/lib/client/messages.test.ts src/components/friends/*.test.tsx` | Partial — client test exists |

### Required SQL proof cases

- Two concurrent `accept_study_challenge` calls return one attempt ID and one recipient acceptance notification.
- A recipient cannot select snapshot or attempt rows/answer keys through direct tables/RPC DTO before allowed reveal.
- Creator cannot challenge accepted friend from someone else’s output, deleted output, non-ready output, or zero-question output.
- Source question edit/delete after create does not change returned snapshot practice content.
- Complete twice does not duplicate completion/result-ready notification.
- Re-running reminder sweep emits one `study_challenge_expiring` record per dedupe key.
- Realtime RLS permits only topic recipient and rejects a different authenticated user.

### Sampling Rate

- **Per task commit:** focused `npx vitest run <changed-test-files>`
- **Per wave merge:** `npm test && npm run typecheck && npm run lint`
- **Phase gate:** `npm test && npm run typecheck && npm run lint && npm run build`; manual two-account challenge, refresh/reconnect, and mobile chat matrix.

### Wave 0 Gaps

- [ ] Supabase migration integration harness or repeatable SQL fixture for two authenticated users and RLS/RPC concurrency tests.
- [ ] `src/lib/server/friends/studyTogether.test.ts` typed RPC/error contract tests.
- [ ] Challenge/notification route tests mirroring `src/app/api/friends/friends.route.test.ts`.
- [ ] Responsive mobile browser verification for `/friends` and conversation route/drawer.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `requireApiUser`, `auth.uid()` at every RPC. [VERIFIED: existing social routes/RPCs] |
| V3 Session Management | Yes | Supabase authenticated private channel; server session boundary. [CITED: https://supabase.com/docs/guides/realtime/authorization] |
| V4 Access Control | Yes | Accepted-friend/owner checks, participant-scoped safe DTOs, table RLS, explicit RPC grants. |
| V5 Input Validation | Yes | Zod route schemas plus SQL checks/normalization. [VERIFIED: current routes] |
| V6 Cryptography | Yes | Use PostgreSQL/Supabase-supported `pgcrypto` digest if hash retained; do not hand-roll. [ASSUMED: exact digest function choice] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Challenge another user with foreign/deleted/unready quiz | Elevation / Tampering | RPC source-owner/status/count validation and snapshot transaction. |
| Accept race / repeated completion | Tampering | `FOR UPDATE`, unique attempt/notification keys, idempotent RPC response. |
| Read answer keys through network or raw table | Information Disclosure | Private snapshot table; safe projections; server-side scoring; restrictive RLS/grants. |
| Subscribe to another user’s notification topic | Information Disclosure | Private channel plus recipient-bound `realtime.messages` RLS. |
| Broadcast outage causes duplicate action | Repudiation / Tampering | Durable writes first; event only invalidates; client reconciliation. |
| Block/remove race changes authorization mid-mutation | Tampering | Lock and validate relationship at mutation time; explicit policy for existing sessions. |
| Malformed IDs/body/deadline | Tampering / DoS | Zod UUID/enums/string bounds; SQL checks; bounded pages. |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260730150000_workspace_foundation.sql` — current output model (`learning_outputs`) and workspace-era provenance.
- `supabase/migrations/20260725120000_v21_baseline.sql` — legacy practice source/tables and direct owner RLS.
- `supabase/migrations/20260726150000_resumable_study_sessions.sql` — legacy resumable session constraints and optimistic revision pattern.
- `supabase/migrations/20260730170000_friends_messages_presence.sql` — accepted-friend helper, direct-message cursor RPC, realtime topic policies.
- `supabase/migrations/20260731013000_direct_message_read_state.sql` — unread count/read watermark pattern.
- `supabase/migrations/20260731001500_friend_profile_shared_quizzes.sql` — current quiz eligibility query and question output shape.
- `src/components/quiz/QuizSession.tsx` and `src/lib/client/activityTracking.ts` — mutable source/browser scoring limitation and reusable interaction behavior.
- `src/components/friends/DirectMessageDialog.tsx`, `src/components/friends/PlayfulReactionOverlay.tsx` — realtime lifecycle and mobile gap.
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) — definer/invoker, restricted search path, grant guidance.
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) — private channel RLS requirements.
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) — `realtime.send` and private broadcast semantics.
- [Supabase Cron](https://supabase.com/docs/guides/cron) and [install](https://supabase.com/docs/guides/cron/install) — scheduler capability and enablement.

### Secondary (MEDIUM confidence)
- `package.json`, `vitest.config.ts`, existing route tests — installed framework/test conventions.

### Tertiary (LOW confidence)
- None. All implementation design claims not directly evidenced are tagged `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies/platform patterns exist locally.
- Architecture: MEDIUM — source/social patterns verified; challenge schema and DTO details are new design.
- Pitfalls: HIGH — directly observed legacy/current schema split, reaction failure semantics, mutable browser scoring, and mobile hide rule.

**Research date:** 2026-07-31
**Valid until:** 2026-08-30
