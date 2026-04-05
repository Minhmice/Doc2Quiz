# Code Review: Unified External Cloud Manager (Phases 2–4)

**Scope**: Backend (migrations, dispatch, execute, file-access, stream routes, storage-accounts, contracts) and frontend (Vault Add menu, explorer context, create/upload dialogs, FileGrid badges, i18n).

**Reviewer**: Code Reviewer (per `.cursor/agents/specialists/code-reviewer/SKILL.md`)

---

## Critical (must fix before completion)

*None.* The earlier risk that `explorerContext` might not reach `VaultActionsDropdown` is addressed in the current code: `VaultHeader` declares `explorerContext` in its props and passes it to `VaultActionsDropdown`, and `VaultClient` passes `explorerContext` into `VaultHeader`. The dropdown uses `effectiveExplorerContext` for null safety. No critical open items.

---

## Major (strong recommendation)

### 2. Share stream: no token invalidation on provider errors for split files

**Location**: `lib/file-access/service.ts` — `accessFileContentForShare`

**Issue**: For owned file access, when a provider download returns 401/403 we call `markAccountTokenInvalid`. In `accessFileContentForShare`, the split-file loop has no try/catch around provider downloads, so owner-token invalidation never runs on share access failures. Behavior is inconsistent and can leave broken tokens undiscovered.

**Suggestion**: Wrap each provider download in the split-file branch in a try/catch; on `ApiError` with 401/403 (or `OAUTH_TOKEN_INVALID`), call `markAccountTokenInvalid(supabase, resolved.userId, part.driveId, ...)` before rethrowing, mirroring `accessFileContent`.

---

### 3. Migration backfill assumes single active account per user

**Location**: `supabase/migrations/20260316000000_linked_accounts_default_write_overflow.sql`

**Issue**: The backfill does `UPDATE linked_accounts SET is_default_write = true WHERE is_active = true`. The unique index allows only one `is_default_write = true` per user. If for any user more than one row has `is_active = true`, the second update would violate the unique constraint and the migration could fail.

**Mitigation**: The foundation migration’s `set_active_linked_account` enforces a single active account per user, so in normal operation only one row per user has `is_active = true`. If you have or plan any other way to set `is_active`, ensure at most one per user before this migration, or change the backfill to set default write for only one account per user (e.g. `DISTINCT ON (user_id) ... ORDER BY user_id, created_at` and update only that row).

---

## Minor (optional improvements)

### 4. List file APIs and split/download-only badges

**Location**: Frontend expects `is_split` and `viewer_mode` on file objects (`FileGrid` / `ExplorerFileWithViewerFlags`). Unified explorer list returns `UnifiedExplorerItem`, which does not include these. App-file list endpoints (e.g. list files by folder) may not yet return `is_split` and `viewer_mode`.

**Suggestion**: For any API that returns app file rows used in the vault grid, include `is_split` and `viewer_mode` in the select/response so split and “Download only” badges and download-only click work when viewing app files (not only unified provider items).

---

### 5. UploadFolderDialog: error message extraction

**Location**: `components/workspace/UploadFolderDialog.tsx` — create-folder error handling

**Issue**: The cast `(createData as { error: { message?: string } }).error?.message` and the `"error" in createData` check are a bit brittle for API error shape.

**Suggestion**: Prefer a small shared helper or contract for API error envelope (e.g. `error: { message?: string }`) and use it in both CreateFolderDialog and UploadFolderDialog for consistency and future-proofing.

---

### 6. Download route and split/download_only

**Location**: `app/api/files/[id]/download/route.ts`

**Note**: The download route correctly uses `accessFileContent`, which supports split files (concatenated stream) and does not restrict by `viewer_mode`. So split and download_only files are correctly downloadable. No change required; recorded for completeness.

---

## Summary

| Severity | Count |
|----------|--------|
| Critical | 0 |
| Major    | 2 |
| Minor    | 3 |

**Correctness**: Default-write and overflow ordering in dispatch, split-upload flow, stream 403 for split/download_only, and concatenated download for split files are implemented correctly. `explorerContext` is wired from VaultClient → VaultHeader → VaultActionsDropdown with null-safe use in the dropdown.

**Style / maintainability**: Consistent use of Zod, ApiError, and existing patterns. Small duplication (e.g. error parsing in dialogs, token invalidation in share path) can be improved as above.

**Security (RLS / auth)**:

- Migrations: `file_parts` RLS policy correctly gates access by file ownership (`files.user_id = auth.uid()`). Default-write and overflow columns on `linked_accounts` are covered by existing `linked_accounts_owner_only` (row access by `user_id`).
- Routes: `default-write` and `overflow-priority` require auth and scope updates by `user_id`. Stream and share stream routes use `requireAuthenticatedUser` or token resolution and do not expose other users’ data.

**Error handling**: Routes and services use `ApiError` and `handleRouteError` consistently. Share split-file path should be aligned with owned path for token invalidation (Major #2).

**Alignment with plan**: Drive-style Add menu (New Folder, Upload File, Upload Folder), provider folder create/upload, default-write + overflow, and split storage MVP are implemented and aligned with the plan.

---

## Acceptance decision

**Accept with recommendations**: No blocking issues. The change set is suitable to merge. Address the two Major items (share-path token invalidation, migration backfill assumption) when feasible; Minor items can be done in follow-up. Residual risk is limited to share-path token handling and migration edge cases noted above.
