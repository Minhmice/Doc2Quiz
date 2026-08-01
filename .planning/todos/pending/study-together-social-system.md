---
title: Build study-together social system
priority: high
created: 2026-07-31
status: pending
---

# Build study-together social system

## P0 durable social foundation

- Add `remove_friend` RPC/API/UI. Blocking must remain separate.
- Add durable notifications plus unread-count/read/read-all APIs and private realtime notification topic.
- Replace reaction-only broadcast delivery with persisted reaction events/notifications; broadcast failure cannot return failure after database commit.
- Create generic `study_sessions` foundation with `asynchronous_challenge` MVP, participants, immutable quiz snapshots, attempts, reveal policies, and result records.
- Enforce server-side source-quiz ownership/published/non-deleted/non-empty checks before snapshot creation.
- Build idempotent `Accept & start` transaction, resumable attempts, expiration/cancellation handling, and return route.
- Add full responsive chat route/drawer; remove desktop-only chat behavior.
- Add realtime request/message/badge refresh plus reconnect/focus reconciliation.

## P1 product shell and resilience

- Build `/friends` page: Friends, Requests, Invites, Messages, Blocked users.
- Simplify topbar dropdown into compact launcher: invites/results/messages/requests plus Add friend.
- Centralize social API error response mapping and typed Supabase RPC contracts.
- Move all social UI copy into locale files.
- Cache or proxy friend avatar URLs; avoid signing every avatar for every friends overview request.
- Implement cursor-based message history loading using existing `before` parameter.
- Presence vocabulary: online, recently active, offline; avoid exact false precision.

## P2 study experience

- Friend search, internal counts, last-message preview, last-active timestamp.
- Separate menu state from chat routing; support multiple conversation routes.
- Add chat mute, delete message, report, and block actions.
- Add deadline-minus-24h dedupe-keyed challenge reminder cron.

## Acceptance signal

A learner can choose one owned quiz, challenge an accepted friend, receive/reopen an in-app invite, practice an immutable snapshot, and see comparison only under its configured reveal policy. All challenge and notification state remains correct after missed realtime events or failed broadcasts.
