# Phase 12: Study Together - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Source:** GSD exploration

<domain>
## Phase Boundary

Turn accepted friendships into a durable study loop. MVP delivers creator-owned asynchronous quiz challenges, immutable session snapshots, idempotent accept-and-start attempts, durable in-app notifications, responsive friend/messaging surfaces, and explicit remove-friend behavior.

</domain>

<decisions>
## Implementation Decisions

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
- First MVP source supports only creator-owned quizzes. Server transaction requires owner equals current user, `learning_outputs.status = 'ready'`, not deleted, and at least one question. No separate publish gate is needed.

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

### Friendship changes during challenges
- Removing a friend cancels pending invites, blocks new social actions, but preserves active and completed snapshot sessions through their normal terminal/result-reveal lifecycle.
- Blocking cancels pending and active sessions for both participants; completed results remain readable. It blocks all future contact and challenges.
- Creator attempt is created only when creator opens/starts the challenge, never automatically when sending.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product decisions
- `.planning/notes/study-together-social-model.md` — full social-loop decisions and lifecycle rules
- `.planning/todos/pending/study-together-social-system.md` — prioritized correction backlog
- `.planning/REQUIREMENTS.md` — SOCIAL-01 through SOCIAL-10
- `.planning/ROADMAP.md` — Phase 12 goal and success criteria

### Current social implementation
- `src/lib/server/friends/friends.ts` — existing social RPC error wrappers
- `src/lib/client/friends.ts` — social client request layer
- `src/lib/client/messages.ts` — direct message and reaction client layer
- `src/components/layout/FriendsMenu.tsx` — existing topbar launcher
- `src/components/friends/DirectMessageDialog.tsx` — existing desktop chat
- `src/components/friends/FriendActionMenu.tsx` — per-friend actions
- `src/components/friends/PlayfulReactionOverlay.tsx` — broadcast-only reaction UI
- `src/components/settings/SocialSafetySettings.tsx` — safety controls
- `supabase/migrations/20260730140400_phase10_social_safety.sql` — friendship/safety schema and RPCs
- `supabase/migrations/20260730170000_friends_messages_presence.sql` — messaging/presence schema and RPCs
- `supabase/migrations/20260731013000_direct_message_read_state.sql` — read state
- `supabase/migrations/20260731001500_friend_profile_shared_quizzes.sql` — friend quiz sharing

</canonical_refs>

<specifics>
## Specific Ideas

Recipient notification:

```text
Minh challenged you
“JavaScript Basics”
10 questions · due in 3 days

[Accept & start] [Decline]
```

After completion:

```text
You: 8/10 · 2m 41s
Minh: Waiting
```

</specifics>

<deferred>
## Deferred Ideas

- Live synchronized session implementation (schema type reserved now).
- Challenges using friend-shared quizzes.
- Email and external channels.
- Discord-like social features, reaction-first feeds, public profile browsing as primary loop.

</deferred>

---

*Phase: 12-study-together*
*Context gathered: 2026-07-31 via GSD exploration*
