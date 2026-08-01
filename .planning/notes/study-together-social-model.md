---
title: Study-together social model
date: 2026-07-31
context: Friend-system product exploration
status: decided
---

# Study-together social model

## Product thesis

Friends exist to help learners study, compare progress, and return. Chat, profiles, and reactions support that loop; they are not the destination.

## Primary loop

```text
Discover/add friend
→ request accepted
→ see friend activity
→ share quiz or send challenge
→ friend practices
→ result/progress returns
→ react or message
→ repeat
```

## Product hierarchy

1. Study invite/challenge
2. Quiz sharing
3. Presence/activity
4. Messaging
5. Reactions
6. Friend profile

Friends dropdown is a compact launcher: requests, active friends, study invites, unread messages. Full `/friends` page owns Friends, Requests, Invites, Messages, and Blocked users.

## Challenge MVP

`Study together` opens a challenge drawer with recipient preselected:

- choose creator-owned quiz
- choose practice or score challenge
- optional deadline: none, 24h, 3d, 7d, custom
- optional message
- send

Defaults: score challenge, no deadline, one attempt, results after both finish.

## Session model

Generic foundation:

```ts
type StudySessionType = "asynchronous_challenge" | "live_session";
```

MVP implements `asynchronous_challenge` only.

Session state:

```ts
type StudySessionStatus = "pending" | "active" | "completed" | "expired" | "cancelled";
```

Participant state:

```ts
type StudySessionParticipantStatus =
  | "invited"
  | "not_started"
  | "in_progress"
  | "completed"
  | "declined";
```

Terminal participant/session outcomes remain explicit. Challenger can begin before recipient accepts.

## Snapshot and authorization

Only source owner can send a challenge when quiz is ready, non-deleted, and has at least one question. This must be authorized in one RPC/API transaction before snapshot creation.

Snapshot includes source quiz ID/owner/version/hash, title/metadata, questions/answer keys, source type, and timestamp. Recipient accesses snapshot only after accepting. Original edits, deletion, or ownership changes never mutate an active session.

Model source type now:

```ts
type StudySessionSourceType = "owned_quiz" | "friend_shared_quiz";
```

Implement `owned_quiz` only. Existing sessions survive future share revocation because source access was checked at creation.

## Accept/start

`Accept & start` is idempotent RPC/API transaction:

```text
validate pending + not expired
→ recipient invited → in_progress
→ session pending → active
→ create or resume recipient attempt
→ create acceptance notification
→ commit
→ return session quiz route
```

Double click returns same attempt. If browser navigation fails after commit, inbox can resume. Snapshot failure retries without rolling back acceptance.

## Results

Store attempt score, accuracy, duration, and completion timestamp per participant. Reveal policy supports immediate, after both complete, and after deadline. Default: after both complete.

## Notifications

Persist notifications before broadcasting. Broadcast only accelerates delivery; failure never reverses a committed challenge.

MVP types:

```ts
study_challenge_received
study_challenge_accepted
study_challenge_declined
study_challenge_completed
study_challenge_result_ready
study_challenge_expiring
```

Notification fields: recipient, actor, type, entity type/id, display-only payload, created/read/archived timestamps, dedupe key. Badge is unread notifications + unread messages, derived server-side. Opening dropdown does not mark all read. Opening target marks it read; Mark all as read exists. Expiring reminder fires once at deadline minus 24 hours through a dedupe-keyed cron.
