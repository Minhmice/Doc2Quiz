# Phase 26: Direct multipart/resumable upload to object storage - Context

**Gathered:** 2026-04-16  
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **direct-to-object-storage upload path** for the **original PDF** that supports **resumable/multipart** semantics and better network-failure recovery, while keeping the app **local-first** by default.

This phase is **optional / env-gated**: if object storage is not configured, the app continues to work **local-only** (IndexedDB) with the current upload behavior.

</domain>

<decisions>
## Implementation Decisions

### Storage target + gating
- **D-01:** Storage integration is **optional** (env-gated). When not configured, keep **local-only** behavior.
- **D-02:** **Vendor decision is deferred** for now: Phase 26 should build an abstraction that can be implemented for different providers later.
- **D-03:** Object keys must use **random uploadId** + sanitized suffix (avoid embedding original filename/PII).

### Scope (what to upload) + retention
- **D-04:** When storage is configured, direct upload the **original PDF bytes** (not page images in this phase).
- **D-05:** Retention is **short TTL** (hours up to ~1 day) with an expiry/cleanup story.
- **D-06:** Even when storage upload succeeds, still keep the **local IndexedDB copy** of the PDF/document (offline-first). Storage is auxiliary.

### Resumable protocol + resume depth
- **D-07:** Resume depth: only needs to resume within the **same tab/session** (no cross-refresh resume in Phase 26).
- **D-08:** Abstraction should support **both**:
  - multipart-style (init → parts → complete), and
  - resumable-session style (create session → upload chunks)
  via an adapter layer.

### Security model + limits
- **D-09:** Auth model: **presigned URLs** with short TTL + a **server finalize** step.
- **D-10:** Finalize is **required**: upload is only considered “done” after server finalize/validate passes.
- **D-11:** If finalize fails, UX should show an error and offer **Re-upload** (not silent).
- **D-12:** Finalize must enforce:
  - object **key-prefix allowlist**
  - **size** (matches init)
  - **content-type allowlist** (PDF only)
  - optional TTL/expiry metadata if provider supports it

### UX recovery
- **D-13:** Network drop recovery: **auto retry/resume** within the same session.
- **D-14:** Progress UI should be **bytes-based** (% + MB uploaded / total).
- **D-15:** Provide **Cancel upload** to stop an active upload.

### Claude's Discretion
- Exact part size / chunk size defaults per provider (within safe browser memory limits).
- Exact TTL duration (as long as it’s short and documented).
- Whether to show a small “Uploading…” inline row vs a modal, as long as progress and cancel exist.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + constraints
- `.planning/ROADMAP.md` — Phase 26 entry + dependencies
- `.planning/PROJECT.md` — offline-first + no accounts constraints
- `.planning/STATE.md` — current progress context
- `.planning/REQUIREMENTS.md` — current requirement conventions (IDs, traceability)

### Existing storage-related integration (reference patterns)
- `.planning/codebase/INTEGRATIONS.md` — existing `@vercel/blob` usage for vision staging + env story
- `src/app/api/ai/vision-staging/route.ts` — pattern for server-side storage integration gate
- `src/lib/ai/visionStagingStore.ts` — abstraction boundary for “store-backed vs in-memory”

### Upload surfaces to integrate with
- `src/components/upload/UploadBox.tsx`
- `src/app/(app)/edit/new/NewStudySetPdfImportFlow.tsx`
- `src/lib/db/studySetDb.ts` — local document persistence (IndexedDB)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing optional storage integration via `@vercel/blob` (vision staging) demonstrates env-gated behavior + fallback.
- Existing upload/import flow already persists PDF bytes + extracted text into IndexedDB.

### Established Patterns
- Local-first is the default; server routes are thin helpers (same-origin forward/staging).
- Prefer stable “contract” helpers in `src/lib/**` and keep UI orchestration in `src/app` + `src/components`.

### Integration Points
- New upload abstraction should plug into the “new study set” import flow before parse starts, without breaking local-only.

</code_context>

<specifics>
## Specific Ideas

- Vendor choice deferred: ship an interface/adapter and local fallback first; wire presigned+finalize model when a provider is chosen.

</specifics>

<deferred>
## Deferred Ideas

- Direct upload of **page images** (vision staging) — separate follow-up (could be Phase 10/27/29 adjacent).
- Resume across refresh/reopen — can be a later phase if needed.
- Vendor decision (Vercel Blob vs R2/S3 vs GCS) — to be decided when implementing the adapter.

</deferred>

---

*Phase: 26-direct-multipart-resumable-upload-to-object-storage*
*Context gathered: 2026-04-16*

