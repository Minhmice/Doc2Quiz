# Desktop Friend Chat — Locked Decisions

## Goal
Replace current friend message dialog with one persistent desktop chat box fixed at lower-right, matching supplied visual direction.

## Layout

- Desktop only for first release. Mobile explicitly out of scope.
- One active conversation box. Opening another friend replaces active conversation.
- Close hides box only; reopening preserves loaded history and scroll position for active conversation.
- Position: fixed lower-right, above app chrome, responsive within desktop viewport.
- Sender message: right-aligned bubble, sender avatar at bubble outer edge.
- Recipient message: left-aligned bubble, recipient avatar at bubble outer edge.
- Use current user's avatar when available; fallback to existing default avatar. Do same for friend.
- Avatar image must preserve animated GIF via plain `<img>` and private signed URL; never expose raw storage path.

## Activity and notifications

- Header shows recipient name and existing 5-minute presence: Online or last active relative time.
- Friend list remains source of recent activity. No typing indicator.
- When chat is closed and new message arrives, show unread count badge on friend icon.
- Opening active conversation marks received messages read; durable unread/read state needs server authority, not client-only state.

## Scope fences

- No mobile UI in this iteration.
- No multi-window chat, window resize, drag, typing status, calls, attachments, reactions, or group chat.
- Do not alter direct-message friendship/block authorization.
- Do not add a standalone chat route.

## Existing foundation

- `DirectMessageDialog` currently loads/sends durable direct messages and subscribes to private conversation Broadcast.
- `list_accepted_friends` provides `isOnline` and `lastActiveAt` from 5-minute recent activity.
- Direct messages have no read/unread columns yet; add message receipt/read tracking or per-conversation participant read timestamp for badge authority.
