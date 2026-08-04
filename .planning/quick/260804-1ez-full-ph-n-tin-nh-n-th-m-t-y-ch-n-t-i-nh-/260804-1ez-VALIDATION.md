# Quick Task 260804-1ez Validation

**Task:** Direct-message media attachments and streak flame state
**Mode:** quick-full
**Created:** 2026-08-04

## Automated checks

- Shared attachment validation: exact 20 MiB accepted; one byte over and unsupported MIME rejected.
- Server upload route: authenticated multipart handling, private Storage upload, cleanup, ownership, and raw-path exclusion.
- Message route/client contracts: text-only compatibility, attachment-only and multiple attachments, signed URLs, RPC arguments, invalidation-only realtime.
- Conversation UI/controller: multi-file picker, previews, upload/send ordering, failure recovery, attachment rendering.
- Streak helper/button: bright state for zero/lost streak; existing tier class for active/recovered streak.
- Repository gates: `npm run typecheck`, `npm run lint`, focused Vitest, full Vitest.

## Human/deployment checks

Supabase CLI and Docker are unavailable locally. After migration deployment, run `supabase/tests/friends_messages_rls.sql` against configured Postgres with `ON_ERROR_STOP=1`, then perform authenticated two-user Storage/chat smoke verification. Confirm private bucket behavior, participant/block authorization, exact-limit upload, signed attachment URLs, no raw paths in API/realtime, text-only compatibility, and streak color transitions.

## Requirement mapping

- D-01 multiple image/video attachments: T1 upload/message contracts, T2 composer/rendering.
- D-02 Supabase Storage: T1 server-only private bucket upload/signing.
- D-03 20 MB per file: shared client/server validation and route tests.
- D-04 text-only and attachment-only: route, RPC, controller, UI, and SQL tests.
- D-05 bright zero/lost streak: pure helper and button tests.
- D-06 existing color after increase/recovery: tier fallback helper/button tests.
