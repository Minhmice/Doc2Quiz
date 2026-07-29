# Phase 34: Add async workers / task queue for full indexing — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Depends on:** Phase 33 (vector store + RAG surface)

<domain>
## Phase boundary

Move **full-document embedding indexing** (all chunks for a study set) off the **synchronous UI-critical path** into a **browser-local async worker / task-queue** model: scheduled work, **bounded concurrency**, **cancellable** runs, and **visible progress** in the RAG surface — without changing Phase 33’s locked posture of **browser-local vectors** and **same-origin embedding forward**.

**Explicitly in scope**

- **Client-side execution plane** for indexing jobs (Web Workers and/or main-thread cooperative scheduler — planner picks); **IndexedDB** remains the embedding index store (`embeddingIndexDb` / equivalent).
- **Automatic kickoff** of full indexing **after extracted text is persisted** for a study set (user chose this over manual-only).
- **RAG / semantic panel** as the **primary UX** for progress (chunk progress, cancel, last error).
- **Resilience contract:** cancel via `AbortSignal`, **bounded retries** on transient failures, **partial index usable** for search, clear **last error** messaging; **invalidation** when embedding model / index schema version changes (carry forward Phase 33 **D-04** spirit).

**Out of scope for Phase 34 (per discussion 2026-04-18)**

- **Wiring `POST /api/parse-jobs`** as the primary execution plane for this phase’s indexing (stub remains; optional later scale mode).
- **Server-stored embedding vectors** as the source of truth (would contradict Phase 33 unless `PROJECT.md` / requirements are explicitly revised).
- Replacing **review-before-bank** or changing **parse quality gates**.

</domain>

<decisions>
## Implementation decisions

### Execution plane
- **D-01:** **Browser-only** async indexing for Phase 34 v1: schedule chunk embedding work off the critical path (Web Worker(s) and/or in-tab queue), write vectors to **IndexedDB**, call **`/api/ai/embed`** same-origin from allowed contexts (planner resolves Worker vs main-thread batching constraints). Do **not** require **`D2Q_SERVER_PARSE_ENABLED`** or a working **`parse-jobs`** worker for this phase’s deliverable.

### Triggers
- **D-02:** **Auto-start full indexing** after **extracted text is persisted** for the study set (subject to caps, feature flags, and “already indexed / fresh” checks — planner specifies idempotency and debounce).

### UX / observability
- **D-03:** **RAG / semantic context panel** is the **primary** place for indexing **progress**, **cancel**, and **error** (chunk *i* / *n* or equivalent), not a new global jobs dashboard unless needed for reuse.

### Failure, cancel, invalidation
- **D-04:** **Standard resilience:** user/system can **cancel** in flight (`AbortSignal`); **bounded retries** for transient failures; **partial index** remains **searchable**; show **last error** in the RAG panel.
- **D-05:** On **embedding model id change** or **embedding index schema/version** mismatch, **invalidate** and require rebuild (align **Phase 33 D-04** and existing index metadata).

### Claude’s discretion
- Worker topology (single vs pool), chunk batch size, backoff constants, and exact debounce after “extract persisted” — choose for reliability and IDB/HTTP performance without contradicting D-01–D-05.

</decisions>

<canonical_refs>
## Canonical references

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & prior phase locks
- `.planning/ROADMAP.md` — Phase 34 title; depends Phase 33.
- `.planning/phases/33-adopt-a-vector-store-matched-to-your-scale/33-CONTEXT.md` — browser-local vectors, same-origin embed forward, RAG UX, invalidation spirit.
- `.planning/PROJECT.md` — same-origin AI, user credentials posture (refresh if cloud sync wording drifts).

### Scale-mode precedent (optional / not blocking v1)
- `.planning/ROADMAP.md` — Phase 15 “Server-side heavy jobs — PDF render & parse queue” (stub APIs exist).
- `src/types/parseJob.ts` — job status shapes if reused for UI modeling only.
- `src/lib/serverParse/env.ts` — `D2Q_SERVER_PARSE_ENABLED` (off-path for Phase 34 v1 per D-01).
- `src/app/api/parse-jobs/route.ts`, `src/app/api/parse-jobs/[id]/route.ts` — stubs; **not** the Phase 34 v1 execution plane.

### Implementation touchpoints (expected)
- `src/lib/db/embeddingIndexDb.ts` — persistence, caps, LRU.
- `src/lib/ai/buildEmbeddingIndex.ts` — chunk → embed → store (refactor for async/queue friendliness).
- `src/components/ai/RagChunkSearchPanel.tsx` — progress/cancel/error surfacing.
- `src/components/ai/AiParseSection.tsx` — orchestration / when to auto-start after extract.

</canonical_refs>

<code_context>
## Existing code insights

### Reusable assets
- **IndexedDB embedding store** and **cosine search** from Phase 33 workstreams.
- **`buildEmbeddingIndexFromPlainText`** — baseline sequential build to split into queued units + progress callbacks.
- **RAG panel** — natural home for job progress (per D-03).

### Established patterns
- **Same-origin** `fetch` to **`/api/ai/embed`** (BYOK, Supabase session auth on server).
- **Phase 15** introduced **parse job types** and **stub routes** — types may inspire client-side job summaries but server queue is out of scope for v1.

### Integration points
- **Persisted extracted text** path (study set document / extract pipeline) must emit or expose a **hook** to enqueue indexing (D-02).
- **Cancel** should align with existing **AbortController** usage in parse flows where possible.

</code_context>

<specifics>
## Specific ideas

- User selected **browser workers**, **auto after extract**, **RAG panel progress**, and **standard** failure semantics in discuss-phase (2026-04-18).

</specifics>

<deferred>
## Deferred ideas

- **Server-side `parse-jobs` queue** for embedding-heavy workloads when scale mode is enabled — revisit after client queue is solid.
- **Dedicated global jobs page** — only if product asks for it; D-03 prefers RAG panel.

### Reviewed todos (not folded)
- None (`todo match-phase 34` returned no matches).

</deferred>

---

*Phase: 34-add-async-workers-task-queue-for-full-indexing*  
*Context gathered: 2026-04-18*
