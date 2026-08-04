# Quick Task: Direct-message media attachments and streak flame state — Research

**Researched:** 2026-08-04
**Domain:** Next.js App Router, Supabase Storage, RPC-only social messaging, streak UI
**Confidence:** HIGH for existing codebase contracts; MEDIUM for Supabase deployment behavior

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Allow multiple image/video files in one message.
- Use Supabase Storage.
- Enforce 20 MB maximum per file at client and server trust boundaries.
- Preserve text-only messages.
- Use bright state when `currentStreak = 0` or `lostStreak > 0`.
- Return to existing tier color after streak increases or recovery restores it.

### Claude's Discretion
- Attachment metadata shape and database migration details.
- Storage bucket/path policy implementation.
- Preview and sending UX within existing conversation layout.
- Exact bright color, chosen to remain accessible and consistent with existing palette.

### Deferred Ideas (OUT OF SCOPE)
- None listed.
</user_constraints>

## Summary

[VERIFIED: codebase] Direct messages currently store trimmed text in `public.direct_messages`, expose data only through `list_direct_messages` and `send_direct_message` security-definer RPCs, and render through the shared `ConversationView` used by desktop and mobile. Direct table grants are revoked, so attachment persistence must extend the RPC contract rather than add direct table access.

[VERIFIED: codebase] Existing `doc2quiz` Storage bucket is private. It already contains workspace and profile-avatar path conventions, but no message-attachment convention. Existing avatar work demonstrates this deployment's safer pattern: authenticate at a Next route, upload/sign with the server-only Supabase admin client, persist only a canonical path, and return a short-lived signed URL. Do not expose service-role credentials or raw Storage paths to the browser.

[CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads] Supabase standard upload accepts explicit `contentType`; docs recommend resumable upload above 6 MB for reliability, while the requested 20 MB ceiling remains within standard-upload capability. This task can use one multipart server route per file without adding an upload library, but should treat upload failure as retryable/user-visible.

**Primary recommendation:** upload each validated file through an authenticated Node route, persist safe attachment metadata in a `jsonb` array on `direct_messages` through an RPC, and sign stored paths server-side when listing/sending messages. Keep realtime invalidation-only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| File picker, previews, local size/type rejection | Browser / Client | Frontend Server | UX belongs in `ConversationView`; browser checks improve feedback but are not authority. |
| Authenticated multipart upload and 20 MB enforcement | Frontend Server / API | Storage | Route can inspect `File.size`, MIME, auth, and path before using server-only Storage client. |
| Attachment metadata and participant authorization | Database / RPC | API | Social tables are RPC-only; RPC must bind sender and conversation participant, not trust caller IDs. |
| Private object storage | Database / Storage | Frontend Server | `doc2quiz` is private; path policy and server-side signing protect objects. |
| Signed attachment DTOs | Frontend Server / API | Storage | API returns short-lived URLs; client never receives service key or needs raw path authority. |
| Streak flame state/color | Browser / Client | API | `StreakButton` owns fetched `LearningStreak`; `streakTier` already owns tier selection. |

## Existing Contracts and Constraints

- [VERIFIED: `src/components/friends/ConversationView.tsx`] `ConversationView` owns composer state, scrolling, controller state, and desktop/mobile shared rendering. `createConversationController.send` currently rejects empty text and calls `transport.send(conversationId, body)`.
- [VERIFIED: `src/lib/client/messages.ts`] `DirectMessage` currently has `id`, `senderId`, `body`, and `createdAt`; client request helper sends JSON to `/api/friends/messages/[conversationId]`.
- [VERIFIED: `src/app/api/friends/messages/[conversationId]/route.ts`] GET validates UUID/cursor then calls `list_direct_messages`; POST trims/limits text with Zod then calls `send_direct_message`; failures map to generic 404 `social_unavailable`.
- [VERIFIED: `supabase/migrations/20260730170000_friends_messages_presence.sql`] `direct_messages.body` currently requires 1–2000 trimmed characters. `send_direct_message` derives sender from `auth.uid()`, locks the conversation, checks accepted-friend status, inserts, updates `last_message_at`, and returns JSON.
- [VERIFIED: `supabase/migrations/20260731013000_direct_message_read_state.sql`] Conversation participants are created/maintained by `open_direct_conversation`; read state is participant-scoped.
- [VERIFIED: `src/lib/server/friends/realtimeBroadcast.ts`] Server realtime broadcasts use an admin client, but project state says chat events are invalidation-only and authenticated HTTP history is display authority. Attachment URLs must not be broadcast as display truth.
- [VERIFIED: `src/components/layout/StreakButton.tsx`] Top-bar flame fetches `LearningStreak`, computes `streakTier(streak.currentStreak)`, and applies `tierClass`.
- [VERIFIED: `src/components/dashboard/StreakFlameChip.tsx`] Dashboard flame chip currently receives only hover state and uses `var(--d2q-accent)`; no current source call site was found. Any new streak props need an explicit caller before this component can reflect lost state.

## Standard Stack

### Core

- `@supabase/supabase-js` — existing Storage/RPC client. [VERIFIED: `package-lock.json`] installed lockfile version is `2.110.8`; no dependency change needed. [CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads]
- `zod` — existing API boundary validator. [VERIFIED: `package.json`] use for message envelope, attachment metadata, and UUID/path-shaped values.
- Native `File`, `FormData`, `URL.createObjectURL`, and `<input type="file" accept="image/*,video/*">` — no new package required. [VERIFIED: codebase] profile upload already uses native multipart and server `File` parsing.

### Supporting

- Existing server-only `createSupabaseAdminClient` — use for private Storage upload/signing because current avatar implementation already centralizes this boundary. [VERIFIED: `src/app/api/profile/route.ts`]
- Existing Vitest 3.x test setup — focused unit/route tests fit current project scripts. [VERIFIED: `package.json`, `package-lock.json`]

### Alternatives Considered

- Direct browser upload with Storage user JWT: do not use for this task. [VERIFIED: `.planning/debug/avatar-upload-storage-rls.md`] prior self-hosted avatar evidence showed authenticated browser Storage requests returning 403 while server admin upload succeeded.
- New attachment table: defer unless future attachment lifecycle/search/delete needs justify it. A `jsonb` array matches “multiple files per message” and keeps the smallest RPC/schema diff. [ASSUMED] This assumes attachment count and per-file metadata remain bounded by the message request rather than needing independent pagination.
- New Storage bucket: do not add one now. Existing private `doc2quiz` bucket is already used for private workspace originals and avatars; a separate bucket would add deployment/config surface. [ASSUMED] This assumes bucket-level restrictions cannot be changed globally without affecting existing document/avatar objects.

## Recommended Attachment Contract

- [RECOMMENDED] Add `direct_messages.attachments jsonb not null default '[]'::jsonb` with a DB check that value is a JSON array. Store one object per file: `{ id, path, name, mimeType, sizeBytes }`.
- [RECOMMENDED] `id` is a generated UUID or random opaque token; `path` is server-generated; `name` is display-only sanitized basename; `mimeType` comes from the server allowlist; `sizeBytes` is measured from the uploaded `File`. Never accept a client-provided Storage path.
- [RECOMMENDED] Keep `body` nullable only if schema/RPC validation changes support attachment-only messages. Preserve the existing text-only path by accepting `body` absent/empty only when at least one valid attachment exists. Keep the 2000-character bound for non-empty text.
- [RECOMMENDED] Keep raw `path` internal to the API/server. RPC can return it to the authenticated route because RPC already authorizes the participant; route maps it to `{ id, name, mimeType, sizeBytes, url }` using short-lived signed URLs and removes `path` before JSON response.
- [RECOMMENDED] Bound request attachment count and aggregate metadata size even though user only specified per-file size. A small count cap prevents unbounded JSON and signing work; exact cap is implementation discretion and should be documented in shared constants. [ASSUMED]

## Recommended Upload and Send Flow

1. [VERIFIED: codebase pattern] Browser selects multiple files, validates each `size <= 20 * 1024 * 1024` and allowed image/video MIME, creates previews with object URLs, and permits text-only or attachment-only send. Revoke object URLs on removal/unmount.
2. [RECOMMENDED] Client posts each file as `multipart/form-data` to a dedicated authenticated endpoint such as `/api/friends/messages/{conversationId}/attachments`. Avoid sending 20 MB files inside the JSON message endpoint.
3. [VERIFIED: codebase pattern] Route calls `requireApiUser()` first, validates UUID, parses a single `File`, measures `file.size` server-side, checks exact MIME allowlist, and rejects `file.size > 20 * 1024 * 1024` before Storage. Do not trust browser validation, filename, or client-supplied path.
4. [RECOMMENDED] Route verifies conversation access through a participant/accepted-friend RPC before upload, or uses a dedicated guarded RPC that returns an upload authorization token/path. Derive path from authenticated user, conversation ID, and random attachment ID, for example `{userId}/messages/{conversationId}/{attachmentId}.{ext}`; never use raw filename as a path component.
5. [VERIFIED: `src/app/api/profile/route.ts`] Upload bytes with server-only admin client to `doc2quiz`, passing validated `contentType`, `upsert: false`, and a cache-control value. Use unique paths so retries do not overwrite another object and stale CDN content is avoided.
6. [RECOMMENDED] Client collects returned internal attachment IDs/metadata, then sends one JSON message request containing `{ body, attachments }`. The message RPC must revalidate attachment ownership/path, MIME, size, and conversation binding before inserting. Do not treat “uploaded object” as “sent message” until RPC persistence succeeds.
7. [RECOMMENDED] If message persistence fails after upload, best-effort delete orphaned objects with the server admin client and show send failure. If deletion fails, log only safe attachment ID/stage; do not expose Storage URL/path.
8. [RECOMMENDED] GET/list and POST/send responses pass through one server mapper that signs only paths returned by the authorized RPC, with a short TTL such as existing social avatar TTL (one hour) or shorter. Client renders `url`; signed URL expiry triggers normal reconcile/refetch.
9. [VERIFIED: project state] Realtime remains invalidation-only. Broadcast an invalidation event without attachment URLs or path metadata; `ConversationView` reconciles through authenticated HTTP history.

## Storage and Database Migration Guidance

- [VERIFIED: `supabase/schemas/90_storage.sql`] `doc2quiz` bucket is `public = false`; existing policies authorize workspace paths and profile-avatar paths. Keep it private.
- [CITED: https://supabase.com/docs/guides/storage/security/access-control] Supabase Storage uses RLS on `storage.objects`; path-scoped policies can bind a first folder to the authenticated subject. Service-role clients bypass Storage RLS and must remain server-only.
- [CITED: https://supabase.com/docs/guides/storage/security/access-control] Upsert requires additional SELECT/UPDATE policy coverage. Use unique paths and `upsert: false` to avoid overwrite policy and race complexity.
- [RECOMMENDED] Add a migration defining a strict message-attachment path parser/helper and, if authenticated direct access is retained, policies scoped to the canonical message path. Since this task’s safest flow uses server admin upload and signing, do not add broad authenticated SELECT/INSERT policies that would let users list or fetch arbitrary `doc2quiz` objects.
- [RECOMMENDED] Add `attachments` to both canonical social schema (`supabase/schemas/60_social.sql` or matching schema source) and a timestamped migration. Update both `list_direct_messages` and `send_direct_message` definitions plus grants/signatures consistently; project keeps schema mirrors and migrations.
- [RECOMMENDED] RPC should return attachment metadata only for conversation participants after the same accepted-friend/block checks already used for body history. Blocked users must receive generic unavailable behavior, not a distinguishable attachment error.
- [RECOMMENDED] Do not store signed URLs in DB. They expire and would become stale; store canonical path plus immutable display metadata.

## Common Pitfalls

- **Client-only size validation:** server must re-measure `File.size`; browser checks are UX only. [VERIFIED: user constraint; codebase trust-boundary pattern]
- **Using `>=` accidentally:** requirement says reject files above 20 MB; use `>` against one shared `20 * 1024 * 1024` constant so exactly-limit files remain allowed. [VERIFIED: user specifics]
- **Allowing empty body without attachment guard:** preserve text-only messages while permitting attachment-only messages; enforce `trimmed body non-empty OR attachments.length > 0` in route and RPC.
- **Trusting MIME/filename:** MIME and filename are untrusted. Use an exact server MIME allowlist, safe extension mapping, random IDs, and preferably lightweight magic-byte checks for supported image/video containers. [RECOMMENDED; exact container set is implementation discretion]
- **Uploading before participant authorization:** authorize conversation before any Storage write, otherwise blocked/stranger callers can create orphaned objects.
- **Returning raw Storage paths:** paths reveal user/conversation structure and create a client-side authorization problem. Return signed URLs only after server-side path validation.
- **Using public URLs:** private bucket must stay private. [CITED: https://supabase.com/docs/guides/storage/serving/downloads]
- **Using a broad bucket MIME restriction:** existing `doc2quiz` bucket stores PDFs, Office originals, markdown, and avatars; a bucket-wide image/video restriction would break unrelated uploads. [VERIFIED: `src/lib/workspaces/createWorkspaceIngest.ts`, `src/app/api/profile/route.ts`]
- **Broadcasting signed URLs:** signed URLs are bearer-like temporary access and are unnecessary in invalidation events. Re-fetch authorized history instead.
- **Orphan objects after failed send:** upload and DB insert are not one transaction. Delete failed-message objects best-effort and add safe cleanup logging.
- **Streak condition only checks zero:** bright state must be `currentStreak === 0 || lostStreak > 0`; restored/active state uses existing `streakTier(currentStreak)` class.
- **Changing only `StreakFlameChip`:** current top-bar flame is `StreakButton`; update its color selection first. `StreakFlameChip` has no current source caller and cannot receive state until a caller is wired.

## Don't Hand-Roll

- **Storage transport/signing:** use existing Supabase Storage client methods; do not construct object URLs or sign URLs manually. [CITED: https://supabase.com/docs/guides/storage/serving/downloads]
- **Auth/session:** use `requireApiUser`; do not accept `senderId` or user ID from request body. [VERIFIED: existing route/RPC pattern]
- **Message authorization:** extend existing security-definer RPC checks; do not add direct table queries from browser or grant table access. [VERIFIED: `supabase/migrations/20260730170000_friends_messages_presence.sql`]
- **Path naming:** use random IDs and server-side MIME-to-extension mapping; do not sanitize arbitrary original filenames into authoritative paths.
- **Signed URL persistence:** generate URLs at response time; do not store expiring URLs.

## Code Examples

### Server-side size and type boundary

[VERIFIED: existing profile route pattern; adapted for planning]

```typescript
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"]);

if (!(file instanceof File) || !allowedMimeTypes.has(file.type) || file.size > MAX_ATTACHMENT_BYTES) {
  return NextResponse.json({ error: "invalid_attachment" }, { status: 400 });
}
```

### Private asset response mapping

[CITED: https://supabase.com/docs/guides/storage/serving/downloads]

```typescript
const signed = await admin.storage.from("doc2quiz").createSignedUrl(attachment.path, 60 * 60);
if (signed.error || !signed.data?.signedUrl) throw new Error("attachment_unavailable");
return { id: attachment.id, name: attachment.name, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, url: signed.data.signedUrl };
```

### Streak state selection

[VERIFIED: `src/lib/streak.ts`, `src/components/layout/StreakButton.tsx`; adapted for planning]

```typescript
const bright = streak.currentStreak === 0 || streak.lostStreak > 0;
const flameClass = bright ? "text-amber-600 dark:text-amber-400" : tierClass[streakTier(streak.currentStreak)];
```

## Affected Files and Tests

### Likely implementation files

- `src/components/friends/ConversationView.tsx` — multiple-file picker, previews, attachment-only send, render image/video attachments, cleanup object URLs.
- `src/lib/client/messages.ts` — `DirectMessage` attachment DTO and upload/send/list client contracts.
- `src/app/api/friends/messages/[conversationId]/route.ts` — JSON envelope accepts optional attachments; list/send maps private paths to signed URLs; realtime stays invalidation-only.
- New upload route under `src/app/api/friends/messages/[conversationId]/attachments/route.ts` — auth, participant authorization, MIME/size validation, server upload.
- New shared validation helper under `src/lib/messages/` — one MIME map and `20 * 1024 * 1024` constant shared by client/server.
- `supabase/migrations/` and `supabase/schemas/60_social.sql` — attachment JSONB shape, checks, RPC input/output, and grants.
- `src/lib/streak.ts` — pure helper for bright-vs-tier flame state, if useful to avoid duplicate condition logic.
- `src/components/layout/StreakButton.tsx` — apply bright state for zero/lost streak; preserve tier classes otherwise.
- `src/components/dashboard/StreakFlameChip.tsx` — only if a real caller is added or existing hidden/removed caller is restored; add state prop rather than reading API inside presentational component.

### Required focused tests

- `src/lib/client/messages.test.ts`: text-only, attachment-only, multiple attachment JSON contract, DTO strips raw path if mapping is client-visible.
- New validation test: exact 20 MB accepted, 20 MB + 1 byte rejected, unsupported MIME rejected, image/video allowlist accepted.
- New message route test: unauthenticated response; malformed conversation UUID; oversized server `File` rejected before RPC/Storage; unsupported type rejected; text-only preserved; attachment-only accepted; RPC receives validated attachment IDs/metadata; raw path never returned.
- `src/components/friends/ConversationView.test.tsx`: merge preserves attachment metadata; text-only and attachment-only send paths; multiple selected files; failed upload leaves composer state/error recoverable; realtime event triggers HTTP reconcile rather than trusting payload.
- `supabase/tests/friends_messages_rls.sql`: accepted participant can list/send attachment metadata; stranger and blocked participant cannot list/send; sender comes from `auth.uid()`; body constraint remains enforced.
- New Storage SQL test if migration adds user-facing object policies: canonical message path allowed only where intended; unrelated bucket paths denied; bucket remains private. [RECOMMENDED]
- `src/lib/streak.test.ts`: helper matrix for `(0,0)`, `(0,lost>0)`, `(active,lost>0)`, and `(active,0)` tier classes/state.

## State of the Art

- [CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads] Standard upload remains suitable for a 20 MB ceiling, but Supabase recommends resumable upload above 6 MB for better reliability. For this quick task, keep route complexity low; add resumable upload only if real network failures justify it.
- [CITED: https://supabase.com/docs/guides/storage/security/access-control] Private Storage is RLS-controlled; service-role bypass is appropriate only inside trusted server code. This project’s self-hosted avatar incident makes server-owned upload/signing the safer current deployment choice.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A bounded `jsonb` attachment array is sufficient; no independent attachment table is needed now. | Recommended Attachment Contract | Future deletion, moderation, pagination, or analytics could require normalized rows. |
| A2 | Existing private `doc2quiz` bucket should host message media rather than adding a new bucket. | Alternatives, Storage Guidance | Bucket-level policy/config changes may be easier or safer with a dedicated bucket in deployment. |
| A3 | Exact supported video MIME set can be limited to common browser types (`mp4`, `webm`, `quicktime`) without a product requirement for all video formats. | Upload Flow, Pitfalls | Users may expect additional video containers. |
| A4 | A small attachment count cap is acceptable though not specified by user. | Metadata Contract | Too-low cap could reject intended multi-file messages. |

## Open Questions (RESOLVED)

1. **Should attachments use existing `doc2quiz` or a dedicated private bucket?** **RESOLVED**
   - Decision: use existing private `doc2quiz` bucket. Keep message paths server-owned and do not change bucket-wide MIME restrictions or add broad Storage policies.

2. **Which image/video MIME containers are product-supported?** **RESOLVED**
   - Decision: allow JPEG, PNG, WebP, GIF, MP4, WebM, and QuickTime. Enforce exact MIME plus content signatures server-side; extend only with tests.

3. **How should cleanup work for orphaned uploads?** **RESOLVED**
   - Decision: delete partial uploads immediately and best-effort delete/discard objects and registry rows when message persistence fails. Defer scheduled cleanup until volume requires it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Next API multipart route/tests | ✓ | 24.15.0 | — |
| npm | package scripts | ✓ | 11.12.1 | — |
| `@supabase/supabase-js` | Storage/RPC client | ✓ | 2.110.8 lockfile | Existing client; no upgrade needed |
| Vitest | focused tests | ✓ | 3.2.7 installed | — |
| Supabase CLI | local SQL migration/test execution | ✗ | — | Review SQL statically; deployment-owned Supabase validation |
| Docker | self-hosted/local Supabase runtime | ✗ | — | Use configured remote/self-hosted endpoint and human verification |

**Missing dependencies with no fallback:** None for code/test planning. [VERIFIED: environment probe]
**Deployment caveat:** Real Storage/RLS behavior cannot be proven locally without Supabase CLI/Docker. [VERIFIED: environment probe]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 3.2.7 installed; package range `^3.2.4` |
| Config file | Existing repository Vitest setup; inspect nearest tests before adding files |
| Quick run command | `npx vitest run <focused-files>` |
| Full suite command | `npm test -- --run` |

### Requirement-to-test map

- **Multiple image/video files:** component/controller test with two files; verify both upload metadata entries reach send.
- **20 MB per-file limit:** shared validation unit test plus route test proving oversized server file rejects before RPC/Storage.
- **Supabase Storage/private access:** route/storage mocks verify private bucket upload and signed URL mapping; SQL test verifies path authorization where policies are added; remote deployment check remains required.
- **Text-only compatibility:** existing `sendDirectMessage` contract test remains green; message RPC accepts no attachments.
- **Attachment-only message:** route/RPC test verifies empty body plus at least one attachment succeeds and empty body plus zero attachments fails.
- **Streak bright/tier state:** pure helper test covers zero, lost, active, and restored states; component source/test verifies `StreakButton` applies selected class.

### Sampling Rate

- Per changed module: `npx vitest run <focused-files>`.
- Per change set: `npm run typecheck` and `npm run lint`.
- Phase gate: focused tests, full suite, typecheck, and lint green; then deploy migration and perform authenticated two-user Storage/chat smoke test.

### Wave 0 Gaps

- [ ] New attachment validation helper and tests.
- [ ] New message attachment upload route tests.
- [ ] New message route tests; no existing test file was found for `src/app/api/friends/messages/[conversationId]/route.ts`.
- [ ] Extend `supabase/tests/friends_messages_rls.sql` and add Storage policy test only if migration adds user-facing object policies.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Yes | `requireApiUser()` before upload/list/send; sender from `auth.uid()`. |
| V3 Session Management | Yes | Use existing Supabase SSR/browser session; never accept user ID as authority. |
| V4 Access Control | Yes | RPC participant/accepted-friend checks; path bound to authenticated user/conversation; private bucket. |
| V5 Input Validation | Yes | Zod envelope validation, exact MIME allowlist, measured byte limit, body/attachment invariant, safe path generation. |
| V6 Cryptography | Yes | Supabase `createSignedUrl`; never hand-roll signatures or expose service role. |

### Known Threat Patterns

- **Arbitrary Storage path injection — Tampering/Elevation:** derive path server-side from auth user, conversation, random ID, and validated extension; reject client path input.
- **Unauthorized conversation media read — Information disclosure:** list RPC checks participant and accepted-friend/block state; API signs only paths returned by that RPC.
- **Oversized multipart request — Denial of service:** reject per-file size before upload; cap file count and request/metadata size; configure route/runtime limits if deployment supports them.
- **MIME spoofing — Tampering:** exact server allowlist; use safe extension mapping and magic-byte validation where practical; do not rely on filename.
- **Stale or leaked signed URLs — Information disclosure:** short TTL, no realtime payload URLs, no DB URL persistence, and no raw path DTOs.
- **Orphaned objects — Availability/cost:** best-effort delete after DB send failure; add future cleanup only when needed.

## Sources

### Primary (HIGH confidence)

- [VERIFIED: `src/app/api/profile/route.ts`] Existing server-owned private Storage upload/signing and File validation pattern.
- [VERIFIED: `supabase/schemas/90_storage.sql`] Existing private `doc2quiz` bucket and Storage policy conventions.
- [VERIFIED: `supabase/migrations/20260730170000_friends_messages_presence.sql`] Social table, RPC-only messaging, participant authorization, and realtime topic policy.
- [VERIFIED: `src/components/friends/ConversationView.tsx`, `src/lib/client/messages.ts`, `src/components/layout/StreakButton.tsx`, `src/lib/streak.ts`] Current client/message/streak integration points.
- [CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads] Standard upload and content-type guidance.
- [CITED: https://supabase.com/docs/guides/storage/security/access-control] Storage RLS and service-role guidance.
- [CITED: https://supabase.com/docs/guides/storage/serving/downloads] Private bucket signed URL guidance.

### Secondary (MEDIUM confidence)

- [CITED: https://supabase.com/docs/guides/storage/buckets/creating-buckets] Bucket-level MIME and file-size restriction capability; fetched search result, direct page fetch timed out during this session.
- [VERIFIED: `.planning/debug/avatar-upload-storage-rls.md`] Self-hosted runtime evidence supporting server-owned Storage operations.

### Tertiary (LOW confidence)

- None used for implementation decisions.

## Metadata

**Confidence breakdown:**
- Existing architecture: HIGH — directly read current routes, RPCs, migrations, components, tests, and prior debug evidence.
- Supabase Storage behavior: MEDIUM/HIGH — official docs fetched for upload, RLS, and signed URLs; deployment-specific behavior still needs remote smoke test.
- Attachment metadata choice: MEDIUM — minimal `jsonb` design is a recommendation based on current scope, not a locked user decision.
- Streak integration: HIGH — current state source and tier helper are directly present; dashboard chip caller absence is verified by source search.

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 for stable codebase findings; verify Supabase behavior again before deployment if SDK/storage versions change.
