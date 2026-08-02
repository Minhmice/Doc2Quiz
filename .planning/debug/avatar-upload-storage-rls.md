---
status: awaiting_human_verify
trigger: "Debug current local Doc2Quiz Supabase error on avatar upload: `new row violates row-level security policy`. Inspect profile upload client path, bucket/storage migration policies, exact object path assumptions, auth browser client. Identify policy mismatch and implement minimum migration/fix necessary. Do not weaken to public bucket or remove RLS. Preserve unrelated dirty changes, no commit. Run tests/typecheck feasible. Return exact migration user must apply to cloud and any necessary SQL retry guidance."
created: 2026-07-31T17:44:00+07:00
updated: 2026-08-02T01:42:00+07:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "Private preview fails because POST returns only `{ uploaded: true }`, forcing `refreshAvatar()` to call GET, while GET signs through the authenticated cookie client whose self-host Storage authorization path already returns 403; service-role client is used for upload but never for signing."
  confirming_evidence:
    - "Human retry reports exact client message emitted only after POST succeeded and `refreshAvatar()` returned null."
    - "POST line 120 returns no avatar URL; client line 65 must issue GET before rendering."
    - "GET line 38 calls `createSignedUrl` on authenticated `auth.supabase`; prior runtime evidence proved this self-host authenticated Storage path returns HTTP 403, while authenticated POST upload and persistence now succeed through existing admin client."
    - "Admin and authenticated clients both use `getSupabaseUrl()`, ruling out different endpoint construction; admin additionally uses server-only service role with session persistence disabled."
  falsification_test: "Hypothesis is wrong if POST already returns a signed URL, GET signs with service role, or exact client message can occur after a non-null URL reaches image rendering. None is true in current code."
  fix_rationale: "Mint short-lived signed URLs server-side with existing admin client only after authenticated canonical-path lookup/upload, return URL from POST for immediate preview, and use same secure signer in GET for refresh. Keep canonical database path authoritative and append cache-buster to replacement URL."
  blind_spots: "Cannot execute real self-host signed URL request here; human browser check remains required. Existing focused mocks must be extended to assert admin signing and response/render contracts."
next_action: "User uploads a replacement avatar, confirms immediate profile/sidebar preview, refreshes page, and confirms private avatar remains visible; report exact UI error plus server stage if any failure remains."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: authenticated user uploads avatar to private `doc2quiz` bucket
actual: upload returns `new row violates row-level security policy`
errors: `new row violates row-level security policy`
reproduction: use current local profile avatar upload
started: current local environment

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "Avatar pathname extension mismatch causes reported storage RLS error"
  evidence: "Current client derives canonical extension from MIME and reported error is emitted by Storage INSERT before profile PATCH validates pathname."
  timestamp: 2026-07-31T17:47:00+07:00

- hypothesis: "Storage upload succeeded and `/api/profile` PATCH or response handling failed"
  evidence: "Exact displayed wording is emitted only when `supabase.storage.upload()` returns an error; available server logs contain no avatar PATCH request; focused PATCH contract test accepts canonical client path."
  timestamp: 2026-08-02T01:10:00+07:00

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-31T17:44:00+07:00
  checked: reported symptom
  found: storage INSERT is denied by Supabase RLS during authenticated avatar upload
  implication: trace exact storage object policy and browser session identity without weakening bucket privacy

- timestamp: 2026-07-31T17:46:00+07:00
  checked: ProfilePageClient upload path and browser client
  found: Browser client uses `@supabase/ssr` `createBrowserClient`; it gets authenticated user and uploads only `${user.id}/profile/avatar.${extension}` after MIME validation.
  implication: client passes JWT identity and canonical per-user path; no client path mismatch exists.

- timestamp: 2026-07-31T17:46:00+07:00
  checked: baseline and later Storage policies
  found: `doc2quiz_storage_insert_own` and update/select policies predicate on `owner = auth.uid()`; workspace policies later use path-derived authorization. No profile avatar write policy exists.
  implication: owner-column authorization is policy mismatch for avatar uploads; a narrow path-scoped policy is needed.

- timestamp: 2026-07-31T17:49:00+07:00
  checked: migration syntax and focused checks
  found: New migration authorizes only canonical authenticated `${auth.uid()}/profile/avatar.<allowed-extension>` objects in private `doc2quiz`; typecheck passes; profile validation tests pass (2/2).
  implication: code compiles and policy is least-privilege, but local Storage runtime validation is blocked by unavailable Supabase CLI process.

- timestamp: 2026-08-02T00:58:00+07:00
  checked: exact UI wording, compiled dev bundle, current source, and server logs
  found: `Profile photo upload failed. Try again.` is thrown specifically when Supabase Storage `upload()` returns an error in the compiled client currently served. No `PATCH /api/profile` appears in available server logs.
  implication: new wording does not indicate a later PATCH failure; execution still stops at Storage upload.

- timestamp: 2026-08-02T01:03:00+07:00
  checked: deployment classification and linked Supabase state
  found: `.env` targets a self-hosted/proxied Supabase endpoint; Supabase CLI has no linked project reference, so deployed policy state cannot be queried from this workspace.
  implication: self-host proxy/JWT forwarding and database migration state remain runtime blind spots; safe runtime evidence is required before another SQL change.

- timestamp: 2026-08-02T01:10:00+07:00
  checked: client/API contract and focused verification
  found: canonical client avatar path is accepted by PATCH; focused avatar tests pass 9/9; changed files lint with zero errors; full typecheck is blocked only by unrelated concurrent missing symbols in `DashboardLibraryHeader.tsx`.
  implication: avatar URL/path validation contract is not the failure; next evidence must come from Storage status/error class.

- timestamp: 2026-08-02T01:13:00+07:00
  checked: user overlay output, current line 80 call site, and source history
  found: Next.js overlay preserved the diagnostic label but serialized its second object argument as `{}`; current line 80 is uniquely the `storage-api` call after Storage `upload()` resolves with an error.
  implication: stage is now directly inferred as `storage-api`; object diagnostics are unusable in this overlay, while exact Storage status/error type and authorization subcause remain unknown.

- timestamp: 2026-08-02T01:15:00+07:00
  checked: diagnostic transport fix
  found: `logAvatarFailure` now emits one primitive string containing only stage, normalized status, and errorType, with `unknown` fallbacks; focused source test forbids the prior object argument.
  implication: next overlay cycle will preserve all safe fields and cannot repeat the empty-object failure mode.

- timestamp: 2026-08-02T01:17:00+07:00
  checked: focused verification after primitive-string fix
  found: `ProfilePageClient.test.tsx` passes 3/3 and focused ESLint exits cleanly with zero output.
  implication: diagnostic shape is regression-protected and lint-clean; runtime retry is needed only to collect status/errorType, not to identify stage.

- timestamp: 2026-08-02T01:18:00+07:00
  checked: human retry after reportedly applying latest narrow inline avatar policy
  found: browser upload fails at `storage-api` with HTTP 403 and `StorageApiError` before profile PATCH.
  implication: direct authenticated browser Storage authorization remains incompatible in this self-host deployment; exact internal JWT/policy integration detail remains unobservable, so another policy broadening loop is unsafe.

- timestamp: 2026-08-02T01:23:00+07:00
  checked: server architecture, auth helper, image validation, and admin client
  found: `requireApiUser` authenticates from server cookies; `createSupabaseAdminClient` is server-only and service-role backed; shared validation limits images to PNG/JPEG/WebP/GIF and 2 MB; canonical builder accepts only UUID user IDs.
  implication: `/api/profile` can securely own upload path derivation and privileged Storage write after authentication, with no client service key or RLS weakening.

- timestamp: 2026-08-02T01:27:00+07:00
  checked: secure server upload implementation
  found: multipart POST authenticates before admin creation, accepts only `file`, validates MIME, 2 MB size, and image magic bytes, derives canonical path from authenticated UUID, uses service role only for private Storage write, then persists path through authenticated user client. PATCH now rejects all client-supplied avatar paths; browser direct Storage code is removed.
  implication: service key remains server-only, arbitrary user/path input cannot influence destination, and database profile write retains user RLS.

- timestamp: 2026-08-02T01:28:00+07:00
  checked: automated verification
  found: focused tests pass 14/14; focused ESLint and `git diff --check` pass. Full typecheck reaches only unrelated concurrent friend presence type errors in `FriendsHub.tsx` and `FriendsMenu.tsx`; no avatar-file type errors remain.
  implication: auth boundary, server path derivation, type/size/signature validation, upload-before-persist ordering, Storage failure behavior, and absence of client direct Storage path are regression-protected.

- timestamp: 2026-08-02T01:34:00+07:00
  checked: human verification and exact client failure branch
  found: authenticated POST upload and persistence succeed; UI emits `Avatar saved, but private preview could not load. Refresh and try again.`, which occurs only when subsequent `refreshAvatar()` returns no URL before image rendering.
  implication: upload bug is fixed; active failure is isolated to private URL retrieval rather than file rendering or persistence.

- timestamp: 2026-08-02T01:38:00+07:00
  checked: POST/GET response flow, client refresh contract, Supabase client construction, and environment accessor usage
  found: POST returns only `{ uploaded: true }`; client therefore calls GET; GET signs with authenticated cookie client. Both authenticated and admin clients use the same normalized `NEXT_PUBLIC_SUPABASE_URL`, but only admin uses server-only service role. Exact failure occurs before `AvatarImage` receives a new URL.
  implication: authenticated Storage signing repeats the known incompatible self-host authorization path. Server must sign canonical private path with existing admin client and return that URL directly after upload; response shape and rendering are otherwise consistent.

- timestamp: 2026-08-02T01:41:00+07:00
  checked: minimum secure signed preview implementation
  found: GET now validates persisted avatar path belongs to authenticated user before admin signing; POST signs its server-derived canonical path after upload and persistence. Both use existing server-only service-role client, private bucket, five-minute expiry, and cache-busted returned URLs. Client consumes POST URL directly and updates shared sidebar avatar state.
  implication: canonical profile path remains source of truth, service key never reaches browser, arbitrary persisted paths cannot be privileged-signed, and replacements bypass stale browser caches.

- timestamp: 2026-08-02T01:42:00+07:00
  checked: final automated verification
  found: focused avatar tests pass 16/16; focused ESLint, full TypeScript typecheck, and `git diff --check` all pass.
  implication: secure signing boundary, short TTL, canonical-path guard, direct upload response, stage-specific signing failure, cache busting, and refresh rendering contracts are regression-protected; real self-host retrieval remains human verification.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Two-stage self-host Storage authorization mismatch. Direct authenticated browser upload returned 403, fixed by authenticated server upload using service role. Preview still failed because POST returned no URL and forced GET to call `createSignedUrl` with the same authenticated cookie client; that repeated the incompatible self-host Storage authorization path and returned no private URL despite successful upload and canonical path persistence."
fix: "Kept authenticated server upload and canonical path persistence. GET now validates stored avatar path belongs to authenticated user before using existing server-only admin client to mint a five-minute signed URL. POST mints and returns a five-minute signed URL immediately after upload/persistence; client renders it directly and updates shared avatar state. Returned URLs receive cache-busting query parameter for replacements. Added safe `avatar-sign`, `avatar-path-invalid`, and `avatar-sign-after-upload` server stages; bucket remains private and service key remains server-only."
verification: "Focused avatar tests pass 16/16. Focused ESLint, full `tsc --noEmit`, and `git diff --check` pass. Tests cover admin signing, five-minute TTL, canonical persisted-path guard, no path disclosure, direct POST signed response, cache busting, stage-specific signing failure, upload ordering, and client/shared-state rendering. Human browser verification against self-host runtime remains required."
files_changed: ["src/components/profile/ProfilePageClient.tsx", "src/components/profile/ProfilePageClient.test.tsx", "src/components/profile/DisplayNameProvider.tsx", "src/app/api/profile/route.ts", "src/app/api/profile/route.test.ts", "src/lib/profile/profileValidation.ts", "src/lib/profile/profileValidation.test.ts"]
