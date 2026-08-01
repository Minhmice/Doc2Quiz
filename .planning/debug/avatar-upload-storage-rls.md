---
status: awaiting_human_verify
trigger: "Debug current local Doc2Quiz Supabase error on avatar upload: `new row violates row-level security policy`. Inspect profile upload client path, bucket/storage migration policies, exact object path assumptions, auth browser client. Identify policy mismatch and implement minimum migration/fix necessary. Do not weaken to public bucket or remove RLS. Preserve unrelated dirty changes, no commit. Run tests/typecheck feasible. Return exact migration user must apply to cloud and any necessary SQL retry guidance."
created: 2026-07-31T17:44:00+07:00
updated: 2026-07-31T17:49:00+07:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Avatar upload is denied because current `doc2quiz_storage_insert_own` policy requires `storage.objects.owner = auth.uid()`, while client upload authorizes via JWT and stable path `${auth.uid()}/profile/avatar.<extension>`; Storage object ownership is not reliable predicate for this write path."
test: "Apply new path-scoped avatar policies, then upload and overwrite one avatar while signed URL remains private."
expecting: "Authenticated owner succeeds for canonical path; any other path or user remains denied."
next_action: "Apply `20260731180000_fix_profile_avatar_storage_rls.sql` to target Supabase project and retry avatar upload."

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

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "Baseline `storage.objects` owner-based policies do not authorize current browser avatar writes reliably. The profile client correctly uploads a canonical authenticated path, but no policy evaluates that path."
fix: "Added `20260731180000_fix_profile_avatar_storage_rls.sql`: authenticated users can select, insert, and update only their canonical avatar path in private `doc2quiz` bucket, based on UUID path segment equal to `auth.uid()`."
verification: "`npm run typecheck` passed. `npx vitest run src/lib/profile/profileValidation.test.ts` passed (2/2). `supabase status` could not start local executable, so runtime policy verification needs target Supabase retry."
files_changed: ["supabase/migrations/20260731180000_fix_profile_avatar_storage_rls.sql"]
