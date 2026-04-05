# QA Test Report: Unified External Cloud Manager (Phases 2–4)

**Scope:** Phases 2–4 refactor (Add menu, New Folder/Upload in provider context, default-write/overflow, split storage, UI).  
**Date:** 2025-03-17  
**Role:** QA Tester (per `.cursor/agents/specialists/qa-tester/SKILL.md`)

---

## Summary

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-------------------|
| 1 | Add menu contents | **PASS** | Code-only: menu has only New Folder, Upload File, Upload Folder. |
| 2 | New Folder in provider | **PASS** | Wiring fixed; logic present. Manual/E2E recommended. |
| 3 | Upload File with explorer context | **PASS** | Code-only: accountId + providerFolderId sent to execute. |
| 4 | Upload Folder with explorer context | **PASS** | Code-only: creates folder then uploads into it. |
| 5 | Default write / overflow | **PASS** | Dispatch + APIs verified. |
| 6 | Split storage + stream 403 + download | **PASS** | Code-only: full flow present. |
| 7 | UI badges + click to download | **PARTIAL** | Badges + click in FileGrid; list API gap for vault view. |
| 8 | Build | **PASS** | `npm run build` succeeds. |
| 9 | No regressions | **Not run** | App not run; manual/E2E recommended. |

**Go/No-go:** **Conditional go** — build passes and acceptance logic is implemented; one wiring fix was applied. Manual/E2E recommended for 2, 3, 4, 7, 9.

---

## 1. Add menu: only New Folder, Upload File, Upload Folder

**Status: PASS**

- **Checked:** `VaultActionsDropdown.tsx`: dropdown contains only:
  - New Folder (`workspace.newFolder`)
  - Upload File (`workspace.uploadFile`)
  - Upload Folder (`workspace.uploadFolder`) when `effectiveExplorerContext != null`
- **Verified:** No "Add file from Drive" or "Add Folder" (import) in this component. `AddFileDialog` / `AddFolderDialog` exist elsewhere and are **not** rendered from the Add menu.
- **Evidence:** Lines 69–98 in `VaultActionsDropdown.tsx`.

---

## 2. New Folder in provider folder (unified list)

**Status: PASS (after fix)**

- **Checked:**
  - `CreateFolderDialog`: when `explorerContext?.accountId` is set, submits to `POST /api/explorer/folder` with `accountId`, `providerFolderId`, `name`; on success calls `onSuccess()` (refresh).
  - `POST /api/explorer/folder`: validates body, calls `createFolderOnProvider()` (Drive/OneDrive), returns `providerFolderId`.
  - **Bug found and fixed:** `VaultHeader` did not accept or pass `explorerContext` to `VaultActionsDropdown`, so in provider folder view the dialogs never received provider context. Fixed by adding `ExplorerContext` type and `explorerContext` prop to `VaultHeader` and forwarding it to the dropdown; `VaultClient` now passes `explorerContext` only when `explorerContext.accountId != null`.
- **Manual/E2E:** In a provider folder, click Add → New Folder, create folder → list should refresh and new folder appear.

---

## 3. Upload File with explorer context

**Status: PASS**

- **Checked:**
  - `UploadFileDialog`: when `explorerContext?.accountId` is set, appends `accountId` and `providerFolderId` to FormData (`UPLOAD_EXECUTE_FORM_KEYS`), POSTs to `/api/uploads/execute`.
  - `POST /api/uploads/execute`: reads `accountId` and `providerFolderId` from form, passes into `executeUpload`; `executeUpload` uses them as `effectivePreferredAccountId` and `parentFolderId` for the provider upload.
- **Evidence:** `UploadFileDialog.tsx` 70–76; `app/api/uploads/execute/route.ts` 39–74; `execute.service.ts` 167–168, 211–214.

---

## 4. Upload Folder with explorer context

**Status: PASS**

- **Checked:**
  - `UploadFolderDialog`: requires `explorerContext?.accountId`; on submit calls `POST /api/explorer/folder` with folder name, then for each file POSTs to `/api/uploads/execute` with same `accountId` and the new `providerFolderId`.
- **Evidence:** `UploadFolderDialog.tsx` 81–118.

---

## 5. Default write / overflow

**Status: PASS**

- **Dispatch:** `dispatch.service.ts` selects `linked_accounts` including `is_default_write` and `overflow_priority`; when no `preferredAccountId`/`preferredProvider`, ranks by `compareDefaultThenOverflowThenQuota` (default-write first, then overflow_priority ascending, then quota). Used when choosing single account for upload.
- **POST /api/storage/accounts/default-write:** Accepts `{ accountId }`, validates with `setDefaultWriteAccountRequestSchema`, calls `setDefaultWriteAccount(supabase, user.id, parsed.data)`.
- **PATCH /api/storage/accounts/overflow-priority:** Accepts `{ accountId, overflowPriority }`, validates with `setOverflowPriorityRequestSchema`, calls `setOverflowPriority(supabase, user.id, parsed.data)`.
- **Evidence:** `lib/uploads/dispatch.service.ts` 114–126, 191–195, 221–224; `app/api/storage/accounts/default-write/route.ts`; `app/api/storage/accounts/overflow-priority/route.ts`.

---

## 6. Split storage

**Status: PASS**

- **Split condition:** In `executeUpload`, when no preferred account and dispatch throws `NO_ELIGIBLE_ACCOUNT`, code loads default+overflow accounts (`getDefaultAndOverflowAccounts`), computes `computePartSizes`; if a valid part plan exists, calls `executeSplitUpload`. Parts uploaded to multiple accounts; `file_parts` rows inserted; main `files` row has `is_split: true`, `viewer_mode: "download_only"`.
- **Download route:** `GET /api/files/[id]/download` uses `accessFileContent()`, which for split files loads `file_parts`, fetches each part from provider, concatenates streams via `concatStreams()` and returns combined body.
- **Stream route:** `GET /api/files/[id]/stream` calls `resolveFileForAccess()`; if `resolved.isSplit || resolved.viewerMode === "download_only"` returns **403** with message to use download instead.
- **Evidence:** `execute.service.ts` 184–204, 331–466; `file-access/service.ts` 261–302, 340–393; `app/api/files/[id]/stream/route.ts` 26–33; `app/api/files/[id]/download/route.ts`.

---

## 7. UI: split/download_only badges and click to download

**Status: PARTIAL**

- **Badges:** `FileGrid.tsx` (vault file cards) shows badge when `is_split === true` or `viewer_mode === "download_only"`, using `t("workspace.fileBadgeSplit")` ("Stored across multiple drives") and `t("workspace.fileBadgeDownloadOnly")` ("Download only"). Click on card triggers download via `<a href={/api/files/${file.id}/download}>`.
- **Gap:** Vault file list used in My Vault (folder) view comes from `lib/explorer/service.ts` `getExplorerFiles()`; the select does **not** include `is_split` or `viewer_mode`. So in the current vault folder view, those fields are undefined and badges will not show. Unified list is provider-native and does not have vault split metadata.
- **Recommendation:** Add `is_split` and `viewer_mode` to the files list query and to the list response contract so vault folder view can show badges.

---

## 8. Build

**Status: PASS**

- **Command:** `npm run build`
- **Result:** Compiled successfully; TypeScript passed; static pages generated. No errors.

---

## 9. No regressions (My Drive list, folder nav, breadcrumb, file open/stream)

**Status: Not run**

- App was not run (no local server or E2E). Assumption: existing flows for My Drive list, folder navigation, breadcrumb, and file stream for non-split files are unchanged.
- **Suggested manual checks:**
  - My Drive (unified) list loads; folder navigation works; breadcrumb updates.
  - Open a normal (non-split) file → stream opens in browser.
  - In a provider folder: New Folder → folder appears after refresh; Upload File → file appears; Upload Folder → folder + files appear.

---

## Fix applied during QA

- **VaultHeader → VaultActionsDropdown explorerContext:** `VaultHeader` did not declare or pass `explorerContext`, so provider-context actions (New Folder, Upload File, Upload Folder in provider folder) never received context. Fixed by:
  - Adding `ExplorerContext` type and optional `explorerContext` prop to `VaultHeader`.
  - Passing `explorerContext` from `VaultHeader` to `VaultActionsDropdown`.
  - In `VaultClient`, passing `explorerContext` only when `explorerContext.accountId != null` (to satisfy `ExplorerContext.accountId: string`).

---

## Follow-up test cases

1. **E2E – Upload in provider folder:** In unified view, open a provider folder → Add → Upload File → select file → confirm file appears in list after refresh.
2. **E2E – New Folder in provider:** In unified view, open a provider folder → Add → New Folder → name → confirm folder appears and list refreshes.
3. **E2E – Upload Folder:** In unified view, open a provider folder → Add → Upload Folder → pick folder → confirm one new folder and files appear.
4. **E2E – Split upload (2 accounts):** Two linked accounts where no single account has enough quota for a test file; upload file and confirm it is split (e.g. activity log or DB `file_parts`), then download and verify full file.
5. **E2E – Stream 403 for split file:** Open a split file (or download_only file) via stream URL → expect 403; open via download URL → expect 200 and file content.
6. **Unit/API – List files includes is_split and viewer_mode:** After adding these fields to the vault file list API, add a test or manual check that list response includes them and FileGrid shows badges in vault folder view.

---

## Deliverables

- **What was checked:** All 9 acceptance criteria via code review; build executed; one wiring fix applied.
- **What passed:** 1 (Add menu), 3 (Upload File context), 4 (Upload Folder context), 5 (default-write/overflow), 6 (split storage + stream 403 + download), 8 (build). 2 (New Folder) passes after explorerContext wiring fix.
- **What failed or is blocked:** None. Criterion 7 is partial (badges implemented; list API does not yet return flags in vault view). Criterion 9 not run (manual/E2E suggested).
- **Follow-up:** See “Follow-up test cases” above; recommend adding `is_split` and `viewer_mode` to vault file list API for full criterion 7 in vault view.
