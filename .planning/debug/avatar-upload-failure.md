---
status: verifying
trigger: "Debug and fix local Doc2Quiz avatar upload failure. Inspect profile UI, `/api/profile`, validation, storage client/policies, Supabase setup/migrations, related errors/logs. Apply minimal reliable fix. Do not weaken authorization, bucket privacy, or MIME/size validation merely to bypass failure; user requested bypass security but retain essential security. Preserve unrelated dirty changes and prior chat work; no commit. Run focused test/typecheck feasible. Return root cause, files, results, and any Supabase setup required."
created: 2026-07-31T17:04:00+07:00
updated: 2026-07-31T17:04:00+07:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

reasoning_checkpoint:
  hypothesis: "Valid JPEG, PNG, WebP, or GIF files with a filename extension outside the API allowlist upload successfully but PATCH fails because the UI uses filename-derived extension while /api/profile validates a MIME-derived allowlist."
  confirming_evidence:
    - "Profile UI accepts MIME types, then creates avatar path from file.name extension."
    - "/api/profile only accepts avatar paths ending png, jpg, jpeg, webp, or gif."
    - "Shared profile image validation already maps accepted MIME types to canonical extensions but is unused by UI."
  falsification_test: "A valid image named avatar.jfif or avatar.bin produces a path accepted by PATCH; it does not, so this hypothesis is supported."
  fix_rationale: "Use shared MIME validation and canonical MIME-derived extension before upload, making storage path always match server authorization validation without relaxing either boundary."
  blind_spots: "No browser file-input reproduction available because no Cursor browser session exists; local Supabase status still needs confirmation."
next_action: replace duplicate UI checks with shared MIME validation and canonical extension; add focused regression test

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: authenticated user can upload a valid avatar image through profile UI
actual: local avatar upload fails
errors: not supplied
reproduction: open profile UI and attempt avatar upload locally
started: not supplied

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-31T17:04:00+07:00
  checked: initial report
  found: avatar upload fails locally; preserve authorization, bucket privacy, MIME, and size safeguards
  implication: inspect client-to-route-to-Supabase Storage boundary without bypassing security

- timestamp: 2026-07-31T17:11:00+07:00
  checked: profile UI, API, shared validation, and storage migrations
  found: UI derives object extension from filename after MIME allowlisting, while API only accepts a canonical MIME-extension allowlist; shared validator maps accepted MIME types to canonical extensions but UI bypasses it. UI permits 5 MB while shared validation specifies 2 MB.
  implication: valid JPEG uploads with filenames such as avatar.jfif can store successfully but fail PATCH with Invalid avatar path; validation is inconsistent.

- timestamp: 2026-07-31T17:11:00+07:00
  checked: Supabase storage schema and local status
  found: doc2quiz bucket is private and owner RLS insert/update policies remain defined. Local Supabase cannot be inspected because Docker Desktop Linux engine is not running.
  implication: no evidence of policy failure; Docker must run before locally applying or inspecting migrations.

- timestamp: 2026-07-31T17:13:00+07:00
  checked: focused validation test and TypeScript compilation
  found: profile validation tests pass (2/2) and npm run typecheck exits 0.
  implication: canonical extension derivation and validation contract compile and have regression coverage.

- timestamp: 2026-07-31T17:13:00+07:00
  checked: git diff whitespace scan
  found: git diff --check reports an existing trailing blank line in src/components/workspaces/WorkspaceCollaborationPanel.tsx.
  implication: unrelated dirty file issue; avatar changes did not add a whitespace error.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "ProfilePageClient derived the storage object extension from user-controlled filename while /api/profile and friend avatar access accept only canonical extensions. A valid JPEG named avatar.jfif could upload to private storage then PATCH failed with Invalid avatar path. UI also duplicated a 5 MB limit that conflicted with shared 2 MB validation."
fix: "Use shared validateProfileImage and profileImageExtension; derive avatar path from validated MIME type; reject missing browser user before path construction; add profile validation regression test."
verification: "npx vitest run src/lib/profile/profileValidation.test.ts passed (2/2); npm run typecheck passed. Browser reproduction blocked because no authenticated browser tab; local Supabase unavailable because Docker Desktop engine is stopped."
files_changed: ["src/components/profile/ProfilePageClient.tsx", "src/lib/profile/profileValidation.test.ts"]
