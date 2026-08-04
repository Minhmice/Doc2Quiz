---
name: direct-message-media-and-streak-flame
description: Add private multi-file image/video attachments to direct messages and bright lost-streak flame state.
created: 2026-08-04
status: draft
mode: quick-full
depends_on: []
requirements: [D-01, D-02, D-03, D-04, D-05, D-06]
autonomous: true
must_haves:
  truths:
    - "Accepted friends can send text-only, attachment-only, or mixed direct messages with multiple allowed image/video attachments."
    - "Every attachment is uploaded through authenticated server code to private doc2quiz Storage, with exact 20 MiB per-file enforcement before Storage writes."
    - "Social authorization remains RPC-only and binds caller identity through auth.uid(); public JSON, realtime payloads, and logs never expose raw Storage paths."
    - "Streak flame uses bright state exactly when currentStreak === 0 || lostStreak > 0, and existing tier colors otherwise."
  artifacts:
    - path: "src/app/api/friends/messages/[conversationId]/attachments/route.ts"
      provides: "Authenticated multipart upload and derived-path cleanup boundary"
    - path: "src/app/api/friends/messages/[conversationId]/route.ts"
      provides: "RPC-backed message list/send with signed attachment DTO mapping"
    - path: "supabase/migrations/20260804010000_direct_message_attachments.sql"
      provides: "Attachment schema, RPC authorization, validation, and grants"
    - path: "src/components/friends/ConversationView.tsx"
      provides: "Shared multi-file composer, previews, rendering, and reconciliation"
    - path: "src/lib/streak.ts"
      provides: "Pure bright-flame state helper"
    - path: "src/components/layout/StreakButton.tsx"
      provides: "Top-bar flame class selection"
  key_links:
    - from: "ConversationView.tsx"
      to: "/api/friends/messages/[conversationId]/attachments"
      via: "uploadDirectMessageAttachments sends repeated multipart files before message RPC"
    - from: "attachments/route.ts"
      to: "doc2quiz Storage"
      via: "requireApiUser -> authorize_direct_message_upload -> server-derived path -> admin upload"
    - from: "[conversationId]/route.ts"
      to: "list_direct_messages/send_direct_message"
      via: "authenticated RPC calls followed by validated short-lived signing"
    - from: "src/components/layout/StreakButton.tsx"
      to: "isStreakFlameBright in src/lib/streak.ts"
      via: "bright class selection before existing streakTier class"
---

# Goal

Users can send zero or more validated image/video files with one direct message, including attachment-only messages, through private Supabase Storage while existing text-only messages keep working. Users see a bright flame when `currentStreak === 0 || lostStreak > 0`; active and recovered streaks keep current tier coloring.

# Requirements

- Support multiple image/video attachments in one direct message. (D-01)
- Use existing private Supabase Storage bucket `doc2quiz`; keep service-role operations server-only. (D-02)
- Enforce `20 * 1024 * 1024` bytes per file at browser and server trust boundaries; exact-limit files pass and larger files fail. (D-03)
- Preserve text-only sends and permit attachment-only sends, but reject empty messages with no attachments. (D-04)
- Keep direct-message authorization RPC-only, with sender derived from `auth.uid()`, participant/friend/block checks, no direct table grants, and no client-supplied Storage path authority.
- Store canonical attachment metadata and opaque IDs, not signed URLs. Return short-lived signed URLs from authenticated list/send responses and never expose raw Storage paths or URLs through realtime invalidation payloads.
- Keep timestamped migrations and canonical `supabase/schemas` mirrors consistent, including function signatures, revokes, and authenticated grants.
- Bright flame state applies when `currentStreak === 0 || lostStreak > 0`; existing `streakTier(currentStreak)` class applies only when both conditions are false. (D-05, D-06)
- Add focused Vitest, route, component/controller, pure streak, and SQL authorization coverage.

# Implementation tasks

<tasks>

<task id="T1" type="auto" tdd="true" wave="1" depends_on="[]">
  <name>Secure attachment upload and signed message path</name>
  <behavior>
    - Exact-limit files pass shared and server validation; one byte over, unsupported MIME, and bad content signatures fail before Storage writes.
    - Authenticated accepted participants can upload multiple files, persist only server-owned attachment metadata, and send text-only, attachment-only, or mixed messages; strangers and blocked users get the same generic unavailable result.
    - List/send responses contain signed URL DTOs without raw paths; message realtime broadcasts contain only an invalidation marker and recipient count invalidation remains intact.
  </behavior>
  <files>
    supabase/migrations/20260804010000_direct_message_attachments.sql
    supabase/schemas/60_social.sql
    supabase/schemas/70_functions.sql
    src/lib/messages/attachmentValidation.ts
    src/lib/messages/attachmentValidation.test.ts
    src/lib/server/messages/attachmentPaths.ts
    src/lib/server/messages/attachmentPaths.test.ts
    src/app/api/friends/messages/[conversationId]/attachments/route.ts
    src/app/api/friends/messages/[conversationId]/attachments/route.test.ts
    src/app/api/friends/messages/[conversationId]/route.ts
    src/app/api/friends/messages/[conversationId]/route.test.ts
    src/app/api/friends/friends.route.test.ts
    src/lib/client/messages.ts
    src/lib/client/messages.test.ts
  </files>
  <action>
    Wire one production-quality attachment-only path from client transport through authenticated upload, private Storage, RPC persistence, authenticated history, and signed response mapping (D-01, D-02, D-03, D-04). Keep `src/lib/messages/attachmentValidation.ts` client-safe: export `DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES`, `DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT`, `DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES`, `DirectMessageAttachmentInput`, `validateDirectMessageAttachment`, and `validateDirectMessageAttachmentMetadata`. Keep `buildDirectMessageAttachmentPath`, `parseDirectMessageAttachmentPath`, `directMessageAttachmentExtension`, and canonical `sanitizeDirectMessageAttachmentName` in server-only `src/lib/server/messages/attachmentPaths.ts`; never import path helpers into browser code. Add server content-signature validation for the allowlist `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, and `video/quicktime`. Client checks are UX; the route re-measures bytes, checks exact MIME, safe extension, sanitized display name, count, and content signature before Storage.

    Add migration `20260804010000_direct_message_attachments.sql` and mirror its final state in `60_social.sql` and `70_functions.sql`. Change `direct_messages.body` to support a null body only when a non-empty JSONB attachment array exists; add `attachments jsonb not null default '[]'::jsonb` with array/count/metadata checks. Add a server-owned private upload registry keyed by opaque attachment ID, uploader, conversation, canonical path, sanitized name, allowlisted MIME, measured size, safe extension, and upload/consumed state; expose only guarded RPCs for authorize, register, and discard uploads; define exact register and discard signatures, auth.uid()-derived ownership, and authenticated grants/revokes in the migration and schema/function mirrors. Add private path/extension helpers, `authorize_direct_message_upload(uuid)`, updated `list_direct_messages(uuid,timestamptz,integer)`, and updated `send_direct_message(uuid,text,uuid[])`; drop/revoke the obsolete two-argument send signature before granting only the new RPC signatures to `authenticated`. RPCs must bind caller through `auth.uid()`, repeat accepted-friend/block authorization, accept only opaque attachment IDs, resolve every ID to registry metadata owned by the caller and conversation, derive/verify paths as `{senderId}/messages/{conversationId}/{attachmentId}.{extension}`, verify derived objects exist in private bucket `doc2quiz`, consume IDs atomically with message insert, and return raw paths only inside server RPC results. Do not add broad Storage policies or direct social-table grants; preserve/reassert revokes on `direct_messages` and the upload registry for `public`, `anon`, and `authenticated`, and keep existing private bucket policy unchanged.

    Add authenticated `POST` and cleanup `DELETE` handlers at `src/app/api/friends/messages/[conversationId]/attachments/route.ts`. Both validate UUID and use RPC-only authorization before any Storage access; routes never query social tables directly. `POST` calls `authorize_direct_message_upload`, derives paths server-side, and uses `createSupabaseAdminClient().storage.from("doc2quiz")`; `POST` accepts repeated `files`, uses `upsert: false`, registers each object through a guarded server-owned RPC, deletes the object if registration fails, deletes all already-uploaded objects on partial failure, and returns only `{ id, name, mimeType, sizeBytes }`. `DELETE` accepts only opaque attachment IDs; a guarded discard RPC resolves server-owned metadata, validates ownership, re-derives each path server-side, and removes only those paths; it never accepts a raw path or treats client-provided path/extension as authority. Define named guarded RPC contracts `register_direct_message_upload(uuid, uuid, text, text, bigint, text)` and `discard_direct_message_uploads(uuid, uuid[])`, with ownership and metadata validation for authorization, registration, discard, and send so uploaded IDs cannot be rebound to another user/conversation. Add tests for unauthenticated access, malformed UUID, exact 20 MB acceptance, 20 MB plus one byte rejection before upload, unsupported MIME rejection, bad signatures, participant RPC authorization, private bucket upload options, partial cleanup, and raw-path absence.

    Extend the message route and client contracts with `DirectMessageAttachment`, `DirectMessageAttachmentInput`, `uploadDirectMessageAttachments`, `discardDirectMessageAttachments`, and `sendDirectMessage(conversationId, body, attachments = [])`. `DirectMessage` body becomes `string | null`; text-only response shape remains unchanged by omitting empty attachment fields, while attachment-only responses carry `body: null` plus attachment DTOs. The JSON route accepts optional trimmed body plus only opaque attachment IDs bounded by the shared count; it requires body or attachments, passes `p_attachment_ids` to the three-argument RPC, maps every authorized RPC attachment path through one server-side short-TTL `createSignedUrl` mapper, strips `path`, and returns URL DTOs. Text-only requests must keep their current JSON shape and RPC behavior. On send failure, best-effort cleanup must discard registry rows and remove derived uploaded objects; all upload, discard, signing, and send-failure logs may contain only opaque IDs and operation stages, never raw paths, filenames used as paths, or signed URLs. Broadcast only an invalidation marker such as `{ source: "message" }` on `social-messages:${conversationId}`; never broadcast the sent message, signed URLs, or attachment metadata. Preserve recipient `social-counts:${recipientUserId}` invalidation. Add route/client tests covering text-only compatibility, attachment-only and multiple attachments, malformed metadata/IDs, signed URL mapping, signing failure, RPC argument shape, no raw path in JSON, message-channel invalidation-only broadcast, and count invalidation.
  </action>
  <verify>
    <automated>npx vitest run src/lib/messages/attachmentValidation.test.ts src/lib/server/messages/attachmentPaths.test.ts src/app/api/friends/messages/[conversationId]/attachments/route.test.ts src/app/api/friends/messages/[conversationId]/route.test.ts src/app/api/friends/friends.route.test.ts src/lib/client/messages.test.ts</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint -- src/lib/messages/attachmentValidation.ts src/lib/server/messages/attachmentPaths.ts src/app/api/friends/messages/[conversationId]/attachments/route.ts src/app/api/friends/messages/[conversationId]/route.ts src/lib/client/messages.ts</automated>
  </verify>
  <done>One authenticated upload-to-send/list path works with private Storage and signed DTOs; server enforces size/MIME/content/ownership; RPC signatures and grants are updated; text-only, attachment-only, and multiple-attachment contracts are covered; no raw Storage path or signed URL reaches client realtime payloads.</done>
</task>

<task id="T2" type="auto" wave="2" depends_on="[T1]">
  <name>Expand ConversationView for multi-file composer and rendering</name>
  <files>
    src/components/friends/ConversationView.tsx
    src/components/friends/ConversationView.test.tsx
    supabase/tests/friends_messages_rls.sql
  </files>
  <action>
    Expand `ConversationTransport`, `createConversationController`, `mergeDirectMessages`, and `ConversationView` around the T1 contracts (D-01, D-03, D-04). Let controller send accept trimmed text plus selected `File[]`, upload all files before calling `sendDirectMessage`, retain composer state on failure, and call cleanup for uploaded IDs when send fails. Permit send when body is empty only if files exist; retain current text-only Enter/button behavior otherwise. Use native `<input type="file" accept="image/*,video/*" multiple>`, shared client validation, selected-file previews with `URL.createObjectURL`, remove controls, object URL revocation on removal/unmount, accessible labels, and recoverable inline errors. Render image attachments with `alt` from sanitized display name and video attachments with native controls; empty-body attachment messages must render as valid bubbles. Realtime callbacks remain invalidation-only and continue to reconcile through authenticated HTTP history. `mergeDirectMessages` must retain any message with a non-empty body or at least one attachment, including `body: null` attachment-only messages, and must not use truthiness of `body` as its sole acceptance check.

    Update `ConversationView.test.tsx` for attachment-only merge acceptance, multiple-file upload/send ordering, text-only preservation, selected-file removal and recoverable upload/send failure, and invalidation-triggered HTTP reconciliation. Keep desktop `DirectMessageDialog` and mobile `ConversationPageClient` on the shared `ConversationView`; do not create a second composer/controller.

    Extend `supabase/tests/friends_messages_rls.sql` with fixture objects for registered derived message paths and assertions that an accepted participant can authorize/register/upload/send/list attachment metadata, multiple attachments survive round-trip, attachment-only body is allowed, text-only body remains valid, caller identity comes from `auth.uid()`, attachment IDs cannot be rebound across users/conversations, direct table access remains denied, and stranger/blocked users receive generic failures for upload authorization, list, and send. Include a negative assertion for empty body plus zero attachments, stale/unconsumed attachment IDs, and mismatched ownership/path metadata; verify grants/signatures match the migration and schema mirror. Keep SQL test invocation after migration deployment because local Supabase CLI/Docker is unavailable.
  </action>
  <verify>
    <automated>npx vitest run src/components/friends/ConversationView.test.tsx src/lib/client/messages.test.ts</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint -- src/components/friends/ConversationView.tsx src/lib/client/messages.ts</automated>
    <automated>rg -n "send_direct_message|list_direct_messages|authorize_direct_message_upload|direct_messages|attachments" supabase/migrations/20260804010000_direct_message_attachments.sql supabase/schemas/60_social.sql supabase/schemas/70_functions.sql supabase/tests/friends_messages_rls.sql</automated>
  </verify>
  <done>Desktop and mobile conversations send and display multiple image/video files, attachment-only messages work, text-only messages remain unchanged, previews clean up correctly, realtime stays invalidation-only, and SQL authorization tests cover accepted, stranger, blocked, and direct-table-denied paths.</done>
</task>

<task id="T3" type="auto" wave="1" depends_on="[]">
  <name>Apply bright lost-streak flame state</name>
  <files>
    src/lib/streak.ts
    src/lib/streak.test.ts
    src/components/layout/StreakButton.tsx
    src/components/layout/StreakButton.test.tsx
  </files>
  <action>
    Implement D-05 and D-06 with pure helper `isStreakFlameBright(streak: Pick<LearningStreak, "currentStreak" | "lostStreak">): boolean` in `src/lib/streak.ts`, returning true exactly when `currentStreak === 0 || lostStreak > 0`. Update `StreakButton` to select an accessible bright muted-palette flame class (`text-amber-600 dark:text-amber-400`) from that helper, otherwise use the existing `tierClass[streakTier(streak.currentStreak)]`; do not alter tier thresholds or recovery behavior. Add a helper matrix for zero/no loss, zero/lost, active/lost, and active/no loss, proving active/recovered state returns to tier selection. Add `StreakButton.test.tsx` assertions that the bright class wins for zero/lost states and the existing `tierClass[streakTier(...)]` wins for active/recovered states.
  </action>
  <verify>
    <automated>npx vitest run src/lib/streak.test.ts src/components/layout/StreakButton.test.tsx</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint -- src/lib/streak.ts src/components/layout/StreakButton.tsx</automated>
  </verify>
  <done>Flame is bright for zero or lost streak, tier-colored for active/recovered streak, and pure helper tests cover every required state.</done>
</task>

</tasks>

# Dependencies

- `T1` defines server attachment contracts and must land first. It defines shared attachment validation, opaque attachment metadata, Storage path derivation, RPC signatures, route contracts, signed DTO mapping, and cleanup behavior.
- `T2` depends on `T1` because `ConversationView` and SQL authorization tests consume those exact contracts. `T2` cannot run in parallel with `T1` because it modifies client behavior and tests against T1 exports.
- `T3` is independent of chat work and can run in parallel with `T1`; no files overlap.
- Final validation runs after `T1`, `T2`, and `T3`.

# Verification

Validation artifact note: quick-task mode has no phase `VALIDATION.md`; RESEARCH.md supplies the Validation Architecture and all implementation tasks include runnable `<automated>` checks. Deployment-side SQL and two-user Storage/RLS smoke checks remain explicit human gates because Supabase CLI/Docker are unavailable locally.

Run focused checks first:

```bash
npx vitest run src/lib/messages/attachmentValidation.test.ts src/lib/server/messages/attachmentPaths.test.ts src/app/api/friends/messages/[conversationId]/attachments/route.test.ts src/app/api/friends/messages/[conversationId]/route.test.ts src/lib/client/messages.test.ts src/components/friends/ConversationView.test.tsx src/lib/streak.test.ts src/components/layout/StreakButton.test.tsx
```

Run repository gates:

```bash
npm run typecheck
npm run lint
npm test -- --run
```

Run SQL checks in configured Supabase/Postgres deployment with `ON_ERROR_STOP` enabled:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/friends_messages_rls.sql
```

Perform authenticated two-user smoke verification after migration deployment: accepted users can upload two allowed files and send them with or without text; exact 20 MB file passes; larger or unsupported file never reaches Storage; blocked/stranger access returns generic unavailable behavior; refresh shows signed attachment URLs while response JSON and realtime payloads contain no raw paths; text-only send still works; streak flame changes bright/tier color across zero, lost, active, and recovered states.

# Source audit

- GOAL: direct-message media attachments plus streak flame state — covered by T1, T2, and T3.
- REQ: no separate roadmap requirement IDs were supplied; quick-task requirements are traced to T1, T2, and T3.
- Context locked decisions: D-01/D-02/D-03/D-04 are implemented across T1/T2; D-05/D-06 are implemented in T3; no deferred ideas exist.
- CONTEXT D-01: multiple image/video files — T1 metadata/upload contract and T2 composer/rendering.
- CONTEXT D-02: Supabase Storage — T1 server-only admin upload/signing and private bucket preservation.
- CONTEXT D-03: 20 MB per-file limit — T1 shared/server validation and T2 picker behavior.
- CONTEXT D-04: text-only preservation and attachment-only messages — T1 RPC/route contract and T2 controller/UI/SQL tests.
- CONTEXT D-05: bright when current streak is zero or loss exists — T3 helper and button.
- CONTEXT D-06: existing tier color after increase/recovery — T3 helper matrix and unchanged tier selection.
- RESEARCH: RPC-only social authorization — T1/T2.
- RESEARCH: private Storage, derived paths, no raw paths, short-lived signed URLs — T1.
- RESEARCH: migration/schema mirror consistency, grants/signatures — T1/T2.
- RESEARCH: invalidation-only realtime — T1/T2.
- RESEARCH: orphan cleanup — T1/T2.
- RESEARCH: focused validation and deployment caveat — Verification section; remote SQL/Storage smoke is a required human gate after migration deployment.
- RESEARCH architectural tiers: picker/previews stay in `ConversationView`; multipart size/signature/auth/upload/signing stay in API routes; metadata ownership/participant authorization stays in RPC/database; flame state stays in client helper/button.

# Risks

- JSONB attachment metadata keeps one message atomic, but malformed or oversized metadata could amplify RPC/signing work; bounded count, metadata size, MIME, ID, and byte checks limit this path.
- Existing `doc2quiz` bucket is shared with workspace originals and avatars; no bucket-wide MIME restriction or broad authenticated Storage policy can be added without breaking unrelated objects, so all message access stays server-owned and path-derived.
- Upload and message persistence are separate operations; best-effort cleanup handles partial uploads and failed sends, while safe logs contain only opaque IDs/stages.
- Signed URLs expire; authenticated history must refetch and re-sign rather than persist URLs or trust realtime payloads.
- Supabase CLI and Docker are unavailable in current environment; SQL behavior and private Storage/RLS behavior require deployment-side `psql`/smoke validation after implementation.
- Browser MIME declarations can be spoofed; server uses measured size, exact allowlist, safe extension mapping, and content signatures before upload.
