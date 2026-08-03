---
quick_task: 260804-1ez
title: direct-message-media-and-streak-flame
completed: 2026-08-04
status: complete
requirements: [D-01, D-02, D-03, D-04, D-05, D-06]
---

# Summary

Added multi-file image/video attachments to direct messages through authenticated server routes, private Supabase Storage, guarded RPCs, signed response DTOs, and cleanup paths. Text-only, attachment-only, and mixed messages remain supported; each file is capped at 20 MiB with MIME and content-signature validation.

Updated streak flame selection to use bright muted styling when `currentStreak === 0 || lostStreak > 0`, otherwise retaining existing streak-tier colors.

Synchronized migration/schema/function mirrors and extended SQL authorization coverage for attachment ownership, duplicate IDs, object existence, direct-table denial, and accepted/blocked/stranger behavior.

## Verification

- Focused Vitest: 8 files, 34/34 tests passed.
- `npm run typecheck`: passed.
- Focused lint diagnostics: none.
- `git diff --check`: passed.
- Supabase/Postgres deployment smoke checks remain pending because Supabase CLI and Docker are unavailable locally.
- Full repository test suite retains unrelated pre-existing failures outside this task.

## Key Files

- `src/components/friends/ConversationView.tsx`
- `src/app/api/friends/messages/[conversationId]/attachments/route.ts`
- `src/app/api/friends/messages/[conversationId]/route.ts`
- `src/lib/messages/attachmentValidation.ts`
- `src/lib/server/messages/attachmentPaths.ts`
- `src/lib/streak.ts`
- `src/components/layout/StreakButton.tsx`
- `supabase/migrations/20260804010000_direct_message_attachments.sql`
- `supabase/schemas/60_social.sql`
- `supabase/schemas/70_functions.sql`
- `supabase/tests/friends_messages_rls.sql`
