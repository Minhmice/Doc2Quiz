---
phase: 27-preview-first-parsing-while-full-upload-continues
plan: "02"
subsystem: ui
tags: [nextjs, uploads, progress-ui, sonner]

requires:
  - phase: 27-preview-first-parsing-while-full-upload-continues
    provides: Plan 27-01 preview-first parse kickoff and flow shell

provides:
  - Sticky combined progress strip (parse + optional byte transfer) on the new-import flow
  - ParseProgressContext upload slice for direct-upload mode only
  - Client multipart background upload runner with cancel/abort integration
  - Cancel-all in-strip; upload-complete toast; navigation waits for upload settlement

affects:
  - 27-preview-first-parsing-while-full-upload-continues
  - 27-03

tech-stack:
  added: []
  patterns:
    - "runBackgroundStudySetPdfUpload + refs gate navigation until upload promise settles"
    - "Transfer row in ParseProgressStrip gated on capabilityMode === direct-upload"

key-files:
  created:
    - src/lib/uploads/runBackgroundStudySetPdfUpload.ts
  modified:
    - src/components/ai/ParseProgressContext.tsx
    - src/components/layout/ParseProgressStrip.tsx
    - src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx

key-decisions:
  - "Defer router navigation after successful parse until the background upload async finishes so the effect is not torn down mid-transfer (avoids silent abort on unmount)."
  - "While object storage finalize remains a stub, treat the deployment userMessage containing “not available yet for this deployment” as non-fatal for navigation; other transfer errors trigger reset (D-14-style) per Rule 1."
  - "Removed duplicate footer Cancel button; primary reset is Cancel all on the strip (D-06)."

patterns-established:
  - "LiveUploadProgress in ParseProgressContext mirrors parse live state without new global stores"

requirements-completed:
  - PREVIEW-05
  - PREVIEW-06
  - PREVIEW-08
  - PREVIEW-11

duration: ~35 min
completed: 2026-04-17
---

# Phase 27 Plan 02: Sticky combined progress + Cancel-all Summary

**Sticky import strip shows AI parse plus optional byte transfer (direct-upload only), with Cancel-all resetting parse, transfer, and the draft study set; successful uploads toast via Sonner; navigation waits for the upload task so background work is not aborted by an immediate route change.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-04-17
- **Tasks:** 2
- **Files touched:** 4 (1 created)

## Accomplishments

- Extended `ParseProgressContext` with `upload` / `reportUpload` / `clearUpload` for direct-upload byte progress; local-only mode never populates upload state (D-13 / PREVIEW-11).
- `ParseProgressStrip` is sticky at the top, shows parse and conditional “Transfer” rows (no cloud copy), and exposes **Cancel all** when wired from the flow.
- `runBackgroundStudySetPdfUpload` orchestrates init → presigned parts → PUT → finalize; integrates with `AbortSignal` and server `abort` on user cancel.
- `NewStudySetPdfImportFlow` starts the runner alongside inline parse, clears progress on reset, shows **Upload complete** only on `finalized` success, and awaits the upload promise before `router.push` after a successful parse.

## Task Commits

1. **Task 1: Extend progress model + sticky strip + combined progress** — `bb21ff2` (feat)
2. **Task 2: Cancel-all + toast + navigation gating** — `00a3e23` (feat)

## Files Created/Modified

- `src/lib/uploads/runBackgroundStudySetPdfUpload.ts` — background multipart client; skipped cleanly in local-only mode.
- `src/components/ai/ParseProgressContext.tsx` — `LiveUploadProgress` and upload state accessors.
- `src/components/layout/ParseProgressStrip.tsx` — sticky layout, parse + transfer, optional Cancel all.
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx` — runner effect, strip wiring, toast, reset/abort, deferred navigation.

## Deviations from Plan

### Auto-fixed / product alignment

**1. [Rule 1 — Bug] Immediate navigation aborted background upload**

- **Found during:** Task 2
- **Issue:** `router.push` after parse success unmounted the flow and the upload `useEffect` cleanup aborted the multipart run, so transfer and “Upload complete” could never finish.
- **Fix:** Track `uploadEffectPromiseRef`, await it before navigating; reset the flow on non-stub transfer errors instead of navigating.
- **Files modified:** `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`
- **Commit:** `00a3e23`

**2. [Rule 2 — Stub adapter] Finalize not implemented**

- **Found during:** Task 2
- **Issue:** `/api/uploads/pdf/complete` still returns `finalized: false` with a known deployment message, which would block all post-parse navigation under strict D-14.
- **Fix:** Allow navigation when the error message matches the current stub finalize copy; still reset on other transfer failures.
- **Files modified:** `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`
- **Commit:** `00a3e23`

## Threat Flags

None beyond plan register: cancel path uses existing `deleteStudySet` and best-effort `abortPdfUpload`; no new secrets in the client.

## Known Stubs

- Object storage presigned `part` URLs and successful finalize are not fully implemented server-side; real deployments must return `uploadUrl` and `finalized: true` for end-to-end transfer completion.

## Self-Check: PASSED

- `27-02-SUMMARY.md` present at `.planning/phases/27-preview-first-parsing-while-full-upload-continues/27-02-SUMMARY.md`
- `git log --oneline` includes `bb21ff2` and `00a3e23`
- `npm run lint` and `npm run build` succeeded after changes

---
*Phase: 27-preview-first-parsing-while-full-upload-continues*  
*Completed: 2026-04-17*
