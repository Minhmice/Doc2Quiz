---
phase: 26-direct-multipart-resumable-upload-to-object-storage
plan: 2
subsystem: uploads-ui
tags: [nextjs, pdf, multipart, progress, cancel, idb]

depends_on:
  - "26-01-PLAN.md (contracts + API routes)"

provides:
  - "Browser `runPdfUploadSession` orchestrator (init → PUT parts → finalize) with retries + cancel"
  - "`PdfUploadProgressRow` bytes/progress UI with Cancel and optional Re-upload"
  - "`NewStudySetPdfImportFlow` background upload via `runBackgroundStudySetPdfUpload` + parse-strip reporting"
  - "`UploadBox` optional `enableBackgroundPdfUpload` for surfaces that stay mounted during upload"

key-files:
  created:
    - "src/lib/uploads/runPdfUploadSession.ts"
    - "src/components/upload/PdfUploadProgressRow.tsx"
  modified:
    - "src/lib/uploads/runBackgroundStudySetPdfUpload.ts"
    - "src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx"
    - "src/components/upload/UploadBox.tsx"
    - "src/lib/db/studySetDb.ts"

requirements-completed:
  - "UPLOAD-04"

duration: session
completed: 2026-04-18
---

# Phase 26 Plan 2: Wire upload runner + progress UI Summary

**Optional direct-upload path shows bytes progress, cancel, and same-session retries; local-only stays silent; new-import flow keeps upload in parent because `UploadBox` unmounts after file pick.**

## Performance

- **Completed:** 2026-04-18
- **Verification:** `npm run lint`, `npm run build`

## Accomplishments

- **`runPdfUploadSession`:** Multipart loop via `pdfUploadClient`, `withUploadRetries` (aligned with `pipelineStageRetry` sleep), narrowed `uploadUrl`/`finalizeToken` for TypeScript, `local_only` status without fake failures when storage is off.
- **`PdfUploadProgressRow`:** Compact row with percent, MB/MB, bar, Cancel, Re-upload for stub finalize messaging.
- **`NewStudySetPdfImportFlow`:** `useEffect` drives `runBackgroundStudySetPdfUpload` when inline parse context exists; `ParseProgressStrip` upload reporting; navigation gating unchanged (Phase 27).
- **`UploadBox`:** New `enableBackgroundPdfUpload` (default `false`). When true, starts `runPdfUploadSession` after validation and renders `PdfUploadProgressRow` under the drop zone. New-import flow leaves default **false** so a single upload session runs in the parent after `UploadBox` unmounts.
- **`studySetDb`:** Typed fallback when `parse_progress` column absent from inferred Supabase row shape.

## Decisions

- **Two integration points:** Parent-owned upload for flows that replace the upload screen; opt-in `UploadBox` upload for future/long-lived surfaces only—avoids duplicate sessions and abort-on-unmount.

## Known limitations

- **`/api/uploads/pdf/part`:** Still **503** without a real presigner; same as 26-01 stub behavior.
- **Complete route:** May return `finalized: false` with deployment stub copy until object storage adapter ships.

## Self-Check

- `26-02-PLAN.md` tasks satisfied; `UPLOAD-04` marked complete in `REQUIREMENTS.md`.
- Lint + build green after `runPdfUploadSession` type fixes and `UploadBox` wiring.
