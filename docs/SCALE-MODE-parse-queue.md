# Scale mode — server parse queue (Doc2Quiz)

Architecture for **Phase 15** (optional server or background worker path). Today the app is **client-heavy**: pdf.js canvas rendering, IndexedDB, local settings, and OCR/vision orchestration all run in the browser. Large PDFs or weak devices can make the UI feel sluggish. Scale mode moves **heavy** work (page rendering, staged parse steps) behind an HTTP API and a **job queue**, while keeping the **local-only** path as the default when the feature flag is unset.

---

## Goals

Move PDF page rendering and long-running parse orchestration off the main browser thread when operators opt in, by enqueueing work on a server or worker process and letting the client **subscribe to progress** and fetch results. The **local client path remains the default**: nothing changes for users who do not set server-side env vars. This document is the operator contract; implementation is phased (Wave 2 adds HTTP stubs only).

---

## Job lifecycle

- **Create job** — Client (or server) submits a job descriptor (metadata + references to stored bytes, **not** raw secrets); API returns a stable `jobId`.
- **Queued** — Job waits for a worker slot; fairness and backoff are TBD in a later execute phase.
- **Running** — Worker runs steps such as render pages → OCR → vision/chunk parse; each step should emit progress `{ done, total }` for UI.
- **Terminal** — `succeeded` | `failed` | `cancelled`; client fetches final payload or error.
- **Correlation** — Carry a **correlation id** (or reuse `studySetId` + `jobId`) on every log line / span so **Phase 13** observability can stitch OCR vs vision vs persistence.

---

## Privacy and retention

- PDF **bytes** exist on the server only when scale mode is enabled and a job references uploaded or staged content.
- **TTL and deletion** after job completion are product decisions — document in runbooks when implemented; default should favor **short retention**.
- Job payloads and logs must **not** include API keys, full prompt text, or base64 PDF dumps — metadata and ids only in queue records.

---

## Environment

- **`D2Q_SERVER_PARSE_ENABLED`** — Set to `1` or `true` (case-insensitive, trimmed) on the **server** to expose parse-job API stubs and future worker wiring. Unset or any other value: APIs respond **404** with `{ "enabled": false }` so clients can probe capability without a 5xx.
- **`D2Q_SERVER_PARSE_MAX_MB`** — **Reserved** for a future per-upload cap (not read by code in 15-01 / 15-02); operators can set it in advance for documentation parity.

---

## Wave 2 scope

Next.js `app/api/parse-jobs` route handlers return **501 Not Implemented** with a JSON body containing `not_implemented` when `D2Q_SERVER_PARSE_ENABLED` is on (contract only), and **404** with `enabled: false` when the flag is off — **no worker binary** and no PDF multipart handling in this wave.
