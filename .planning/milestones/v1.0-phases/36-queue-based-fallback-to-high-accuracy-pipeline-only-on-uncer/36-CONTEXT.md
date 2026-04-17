# Phase 36: Queue-based fallback to high-accuracy pipeline — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Mode:** Smart discuss — auto-accepted (recommended defaults)

<domain>
## Phase boundary

When the app classifies a document or region as **uncertain** (mixed quality, low text-layer confidence, or ambiguous routing), **enqueue** a **second-pass** job that can run a **higher-accuracy** pipeline (e.g. full-page vision, different OCR mode, or larger window) **without blocking** the first-pass UX. Use **browser-local queues** first (align Phase 34 async job patterns); **do not** require server `parse-jobs` to ship v1.

**In scope**

- **Signals** that mark “uncertain” (reuse Phase 29 routing, Phase 12 policy, parse scores if available).
- **Queue contract:** single-flight or bounded concurrency per study set; **cancellable**; **idempotent** keys so retries do not duplicate work.
- **User-visible state:** minimal — optional toast or parse summary line (“Refining uncertain pages…”).

**Out of scope**

- Making high-accuracy the default for all docs (must remain **fallback-only**).
- Cloud-only OCR services as mandatory.

</domain>

<decisions>
## Implementation decisions

### Triggering
- **D-36-01:** Run fallback only when **at least one** uncertainty signal crosses a **document-level or page-level** threshold (planner defines constants; default conservative to save cost).

### Queue implementation
- **D-36-02:** Implement on **client** using the same patterns as **Phase 34** (scheduler + `AbortSignal` + IDB or memory state); **optional** hook to future Phase 15 worker queue for parity.

### Pipeline choice
- **D-36-03:** “High accuracy” means **existing** vision/OCR paths with **relaxed caps** or **full-page** fallback — **no new model vendor** required for v1.

### Claude’s discretion
- Queue depth, backoff, and whether to batch uncertain pages into one job vs sequential — optimize for cost and perceived latency.

</decisions>

<code_context>
## Existing code insights

### Reusable assets
- Phase **34** embedding scheduler / job patterns (single-flight, debounce, cancel).
- Phase **29** per-page routing and Phase **24/21** vision batch machinery.

### Integration points
- `AiParseSection` parse flow: insert **enqueue** after first-pass completes with uncertainty flags.

</code_context>

<specifics>
## Specific ideas

- Auto-discuss: **fallback-only**, **client queue first**, reuse **existing** high-cost paths with relaxed limits.

</specifics>

<deferred>
## Deferred ideas

- Server-side priority queue with billing — future scale mode.

</deferred>
