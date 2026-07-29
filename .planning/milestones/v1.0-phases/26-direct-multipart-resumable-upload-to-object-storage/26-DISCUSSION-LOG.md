# Phase 26: Direct multipart/resumable upload to object storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `26-CONTEXT.md` — this log preserves alternatives considered.

**Date:** 2026-04-16  
**Phase:** 26 — Direct multipart/resumable upload to object storage  
**Areas discussed:** storage target, resumable protocol, security/finalize, scope (what to upload), UX recovery

---

## Storage target + gating

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel Blob | Use Vercel Blob as default when configured | |
| R2/S3 | Use S3-compatible (multipart/presign) when configured | |
| GCS | Use GCS resumable sessions | |
| Decide later | Build abstraction now; choose vendor later | ✓ |

**Choice:** Decide vendor later; Phase 26 builds abstraction + local-only fallback.  
**Gating:** Optional/env-gated; when not configured, keep local-only behavior.  
**Key naming:** random uploadId + sanitized suffix; do not embed original filename.

---

## Scope (what to upload) + retention

| Option | Description | Selected |
|--------|-------------|----------|
| PDF original | Upload original PDF bytes | ✓ |
| Vision images | Upload page images | |
| Both | Upload both PDF + images | |

**Retention:** short TTL (hours to ~1 day) with expiry/cleanup story.  
**Local-first:** keep local IndexedDB copy even when storage upload succeeds.

---

## Resumable protocol + resume depth

| Option | Description | Selected |
|--------|-------------|----------|
| Same-session resume | Resume within same tab/session only | ✓ |
| Cross-refresh resume | Resume after refresh/reopen tab | |

**Protocol abstraction:** support both multipart-style and resumable-session-style via adapter layer.

---

## Security model + finalize

| Option | Description | Selected |
|--------|-------------|----------|
| Presigned + finalize | Presigned URLs + short TTL + server finalize | ✓ |
| Proxy upload | Upload through Next API route | |
| Client credentials | Client talks to storage with creds | |

**Finalize:** required.  
**If finalize fails:** show error + offer Re-upload.  
**Finalize checks:** key-prefix allowlist + size + content-type (PDF-only) (+ optional TTL metadata).

---

## UX recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Auto retry/resume | Auto retry/resume within same session | ✓ |
| Resume button | User clicks Resume | |
| Fail hard | Ask user to re-pick file | |

**Progress:** bytes-based (% + MB uploaded / total).  
**Cancel:** required.

---

## Claude's Discretion

- Chunk/part size defaults per chosen provider.
- Exact TTL duration (short) and how it’s represented (metadata vs lifecycle rules).
- Exact placement of progress UI (inline vs modal) as long as progress + cancel exist.

## Deferred Ideas

- Direct upload of page images for vision staging.
- Resume across refresh/reopen.
- Choosing a specific storage vendor.

