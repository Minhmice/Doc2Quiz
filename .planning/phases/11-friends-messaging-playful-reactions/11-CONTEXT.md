# Phase 11 — Friends, Messaging & Playful Reactions

## Goal
Turn existing safe username-based friend requests into a navbar friend experience with accepted-friend lists, private 1:1 messaging, recent-activity presence, and preset playful reactions.

## Locked product decisions

- Use supplied person-plus icon in top-right navbar, immediately left of Ping AI.
- Trigger opens accessible dropdown.
- Dropdown has: add-friend entry point, incoming request badge/list, online friends then offline friends.
- Add friend opens dialog; user sends request using unique normalized username.
- Clicking friend opens action menu: View profile, Message, Playful reaction.
- Existing request flow stays approval-based.
- Message is in-app private 1:1 chat with durable history.
- Presence is recent activity: online only when active in last 5 minutes; offline includes last active time.
- Incoming friend requests show icon badge and appear in dropdown.
- Reactions use fixed 6–8 Vietnamese playful, non-targeted preset strings. No free text.
- Reactions enabled by default. Receiver can disable all reactions or block individual friends.
- Reaction animation is recipient-only: when recipient is actively using app, preset text starts at friend icon and moves around viewport for about 3 seconds. No replay for offline recipient.
- Receiver opt-out must be enforced server-side before send and client-side before render.
- Existing block relationship denies friend, message, presence, and reaction interaction.

## Scope fences

- No group chats.
- No public profile directory or username-autocomplete lookup.
- No arbitrary reaction/message HTML.
- No persistent reaction or animation history, analytics, or replay queue.
- No standalone Friends page in first release.
- Do not expose direct CRUD for social tables; use authorization-enforcing RPC/API routes.

## Existing foundation

- `friend_requests`, normalized unique usernames, request RPCs, block/report controls exist from Phase 10.
- Topbar action slot is `src/components/layout/AppTopBar.tsx`; Ping AI uses `ApiStatusButton`.
- Browser Supabase client exists. No current messages, presence, realtime subscriptions, or notification schema.
