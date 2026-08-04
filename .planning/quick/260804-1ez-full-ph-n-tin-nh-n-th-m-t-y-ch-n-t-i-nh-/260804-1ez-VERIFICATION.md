---
quick_task: 260804-1ez
title: direct-message-media-and-streak-flame
verified: 2026-08-04T00:40:00+07:00
status: incomplete
score: 3/4 must-haves verified
requirements_coverage:
  D-01: verified
  D-02: partial
  D-03: verified
  D-04: verified
  D-05: verified
  D-06: verified
focused_tests: passed
focused_test_count: 34/34
typecheck: passed
focused_lint: passed
full_suite: failed
sql_verification: not_run
open_blockers:
  - Supabase/Postgres deployment smoke checks could not run because Supabase CLI and Docker are unavailable.
---

# Quick Task Verification Report

**Goal:** Users send zero or more validated image/video files with one direct message through private `doc2quiz` Storage, while text-only sends remain valid. Attachment-only messages work. Flame is bright when `currentStreak === 0 || lostStreak > 0`; active/recovered streaks retain tier color.

**Verdict:** INCOMPLETE. Focused TypeScript/UI/API checks pass, WebM signature and schema mirrors now match implementation intent. Deployment-owned SQL/RLS/Storage behavior remains unverified.

## Goal-Backward Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Accepted friends can send text-only, attachment-only, or mixed messages with multiple allowed image/video attachments. | VERIFIED (code/tests) | Text-only, attachment-only, multiple-file controller, route, UI paths, and raw WebM EBML signature validation exist; focused tests pass. |
| 2 | Every attachment uses authenticated server-only upload to private `doc2quiz` Storage with exact 20 MiB enforcement before Storage writes. | VERIFIED (code) / HUMAN DEPLOYMENT CHECK | `requireApiUser()` runs before Storage client creation; authorization RPC runs before `createSupabaseAdminClient().storage.from("doc2quiz")`; shared and server checks use `>` against `20 * 1024 * 1024`; `upsert: false` is used. Private bucket is declared in `supabase/schemas/90_storage.sql`. Real bucket behavior needs deployed smoke testing. |
| 3 | Authorization stays RPC-only, sender derives from `auth.uid()`, direct tables stay denied, and raw paths/signed URLs do not enter public JSON or realtime payloads. | VERIFIED (code) / HUMAN DEPLOYMENT CHECK | Route code calls only RPCs for social authorization/persistence and broadcasts `{ source: "message" }` invalidation markers. Migration and schema mirrors now include attachment constraints, duplicate-ID checks, derived paths, object checks, direct-table revokes, opaque-ID ownership checks, and signed DTO mapping. Deployment SQL tests were not runnable. |
| 4 | Flame bright state is exactly `currentStreak === 0 || lostStreak > 0`; active/recovered state uses existing tier class. | VERIFIED | `isStreakFlameBright()` implements exact predicate; `getStreakFlameClass()` selects bright class first and existing `tierClass[streakTier(...)]` otherwise. Focused helper/button tests pass. |

**Score:** 3/4 must-haves fully verified. D-02 is code-verified but deployment-unverified. Only deployment-owned SQL/Storage smoke checks remain open.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| D-01 multiple image/video attachments | INCOMPLETE | Multiple-file picker, upload ordering, message rendering, and attachment-only merge pass focused tests. Valid WebM is rejected by server signature check. JPEG/PNG/WebP/GIF/MP4 paths are statically present. |
| D-02 private `doc2quiz` Storage, server-only service role | PARTIAL | API route uses authenticated server code and private bucket; no browser service-role use found. Remote Storage/RLS behavior not tested. |
| D-03 exact 20 MiB per file | VERIFIED (code/tests) | Shared validation accepts exact limit and rejects one byte over; server route remeasures `File.size` and rejects before upload. Focused tests pass. |
| D-04 text-only, attachment-only, mixed; reject empty | VERIFIED (code/tests) | Client request, API route, controller, merge logic, and focused route/controller tests cover all states. SQL path is deployment-unverified. |
| D-05 bright zero/lost flame | VERIFIED | Pure helper and button tests pass. |
| D-06 existing tier color after active/recovered streak | VERIFIED | Existing tier mapping remains fallback; focused button tests pass. |

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `src/app/api/friends/messages/[conversationId]/attachments/route.ts` | VERIFIED (code/tests) | Auth, size/MIME/signature checks including raw WebM EBML bytes, private upload, registration, partial cleanup, and opaque DTO response exist. |
| `src/app/api/friends/messages/[conversationId]/route.ts` | VERIFIED (code) | RPC list/send, signed URL mapping, path checks, cleanup, generic errors, and invalidation-only broadcasts exist. Deployment behavior unverified. |
| `supabase/migrations/20260804010000_direct_message_attachments.sql` | VERIFIED (static) | Migration contains attachment registry, strict checks, RPC authorization, path/object checks, atomic consume, revokes, and authenticated grants. |
| `supabase/schemas/60_social.sql` | VERIFIED (static) | Attachment registry mirrors migration path/name/MIME/size/extension/status/consumed checks; direct-message attachment JSON validation is present. |
| `supabase/schemas/70_functions.sql` | VERIFIED (static) | RPC names/signatures/grants, duplicate-ID rejection, ownership checks, derived object checks, and consumed-state guards mirror migration intent. |
| `src/components/friends/ConversationView.tsx` | VERIFIED (code/tests) | Shared desktop/mobile composer, multiple picker, previews, cleanup, upload-before-send, failure recovery, attachment rendering, and invalidation reconciliation exist. |
| `src/lib/streak.ts` | VERIFIED | Exact bright predicate exists and tests cover zero/lost/active cases. |
| `src/components/layout/StreakButton.tsx` | VERIFIED | Bright class wins before existing tier class; focused component test passes. |

## Key Links

| From | To | Status | Evidence |
|---|---|---|---|
| `ConversationView.tsx` | attachment upload route | VERIFIED | `send()` uploads selected files before `sendDirectMessage`; client helper posts repeated `files`. |
| attachment route | private `doc2quiz` Storage | VERIFIED (code) | Auth, RPC authorization, server-derived path, admin Storage upload, `upsert: false`. |
| message route | `list_direct_messages` / `send_direct_message` | VERIFIED (code) | Authenticated RPC calls with `p_attachment_ids`; signed mapper strips `path`. |
| message route | realtime | VERIFIED (code) | Message broadcast carries only `{ source: "message" }`; recipient count invalidation remains separate. |
| `StreakButton.tsx` | `isStreakFlameBright` | VERIFIED | Helper controls bright-vs-tier selection. |
| migration | schema mirrors | VERIFIED (static) | `60_social.sql` and `70_functions.sql` now mirror final attachment constraints and RPC validation guards. |

## Cleanup Review

- Partial multipart upload cleanup removes all uploaded object paths.
- Successful registrations are discarded through guarded RPC on later failure.
- Message-send failure calls discard RPC, receives server-owned paths, and removes objects server-side.
- Cleanup paths do not enter responses or logs.
- Remaining concern: cleanup is best-effort by design; deployment test must confirm registry/object lifecycle under failure.

## Tests and Validation

| Check | Result |
|---|---|
| Focused Vitest: 8 files | PASS — 34/34 tests |
| `npm run typecheck` | PASS |
| Focused ESLint | PASS; no diagnostics on edited application and schema mirror files |
| Full `npm test -- --run` | FAIL — unrelated workspace permission mocks and reaction realtime expectations remain outside this task. |
| `git diff --check` | PASS |
| Supabase SQL/RLS tests | NOT RUN — `supabase` CLI unavailable; Docker unavailable |
| Authenticated two-user Storage smoke | NOT RUN — requires deployed Supabase/Postgres |

## Open Blockers

1. **Run deployment SQL and two-user smoke checks.** Execute `supabase/tests/friends_messages_rls.sql` with `ON_ERROR_STOP=1`, then verify private Storage, accepted/blocked/stranger authorization, exact-limit uploads, signed response URLs, raw-path-free JSON/realtime, and cleanup.

## Human Verification Required

- Deploy migration, run SQL fixture test, and inspect grants/signatures in live Postgres.
- Use two accepted users to upload two image/video files, attachment-only and mixed messages, then test blocked/stranger generic failures.
- Confirm exact 20 MiB passes and 20 MiB + 1 byte never reaches Storage.
- Confirm browser response contains signed URLs only and realtime payload contains invalidation marker only.
- Exercise zero, lost, active, and recovered streak UI states visually.

---

_Verified: 2026-08-04T00:40:00+07:00_
_Verifier: gsd-verifier_
