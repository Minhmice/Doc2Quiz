# Friend Profile Extension — Locked Decisions

## Goal
Accepted friends can view a safe profile with avatar, streak, and creator-opted-in quiz cards.

## Avatar

- Render private signed avatar URL after friend authorization.
- Support static PNG/JPEG/WebP and animated GIF.
- Use plain `<img>` for GIF animation; do not route through image optimization.
- Align server validation with existing browser GIF support and keep size/type restrictions consistent.
- Never return raw `avatar_path` to browser.

## Streak

- Show current streak to all accepted friends by default; no visibility toggle.
- Add friend-only RPC/API projection. Do not query `learning_streaks` directly from browser.
- Hide streak for invalid, blocked, non-friend, or unavailable target with existing generic profile failure.

## Shared quizzes

- Each quiz has explicit owner-controlled “Chia sẻ với bạn bè” switch, default off.
- Friend profile lists only explicitly shared quiz outputs.
- Card contains title, type, question count, updated date only. Never expose score, progress, source files, workspace/member data, or edit controls.
- Empty state: “Chưa có quiz được chia sẻ”.
- Click opens read-only practice mode. No edit, source inspection, or copying into viewer library.
- Friendship alone does not grant quiz access; friend relationship plus per-quiz opt-in is required on every read.

## Security boundary

- Server RPC/API validates accepted friendship and bidirectional block state for profile, streak, listing, and practice payload.
- Do not reuse public opaque token share as a friend-list authorization shortcut.
- Existing generic unavailable response must cover missing, unshared, blocked, and non-friend content.
