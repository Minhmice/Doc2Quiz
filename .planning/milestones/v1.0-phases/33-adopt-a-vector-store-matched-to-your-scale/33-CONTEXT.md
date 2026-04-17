# Phase 33: Adopt a vector store matched to your scale — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Depends on:** Phase 32 (complete)

<domain>
## Phase boundary

Introduce a **browser-local vector layer** so study material can be **retrieved by semantic similarity**, and expose a **user-visible RAG surface**: **chunk search** plus **injecting retrieved context into parse / generation** where the pipeline already accepts text context.

This builds on Phase **31** (content hashes, parse-cache identity, no embeddings shipped there) and **32** (draft + validator passes). Phase 33 is the first phase that **stores embedding vectors** and connects them to **product UX**, not only infrastructure.

**In scope (user-locked, 2026-04-18 discuss):**

- **Vector storage** appropriate to a single-user, on-device app (**scale** = one browser profile; cap vectors per study set or globally — planner sets numbers).
- **Embedding generation** using the **same trust model as today**: user-supplied credentials; **HTTPS via same-origin Next route handlers** (no raw browser-to-random-origin for blocked APIs), aligned with `PROJECT.md`.
- **RAG product surface (minimum):**
  - **Search / browse** relevant chunks (or units) by semantic similarity to a query or to the current task.
  - **Inject** retrieved text (or structured chunk references) into **parse or generation** inputs so the model sees grounded context — exact wiring points are planner/executor (`AiParseSection`, chunk builders, optional review step).

**Out of scope / defer unless explicitly added in planning:**

- **Cloud-hosted** vector DB, cross-device sync, or shared team indexes.
- **Server-side** embedding storage or rate-limit pooling (violates local-first posture unless `PROJECT.md` is explicitly revised).
- Replacing the **review-before-bank** human gate with fully automated trust (RAG **assists**, does not remove review).

</domain>

<decisions>
## Implementation decisions (locked)

### Product scope (user selection)
- **D-01:** Phase 33 targets **user-visible RAG**: **chunk search UI** and **injecting retrieved context into parse/generation** — **larger scope** than “embeddings only” or “schema only.”

### Architecture posture (inherits `PROJECT.md` + Phase 31)
- **D-02:** **Browser-local persistence** for vectors and metadata (e.g. **IndexedDB** dedicated store or namespaced stores in `studySetDb` — planner chooses; must not require cloud persistence).
- **D-03:** **Embedding generation** goes through **same-origin** forwarding (same pattern as `POST /api/ai/forward` or a sibling route) so **API keys are not stored server-side** and CORS is not an issue.
- **D-04:** **Identity in keys:** embedding model id + dimensions + (if applicable) prompt/bundle version for **index invalidation** when the user changes embedding model — must align with Phase 31 “no false cache hits” spirit for vectors.

### Quality / safety
- **D-05:** Retrieved chunks are **untrusted text** for display and for model context — follow existing **sanitization / no `dangerouslySetInnerHTML`** patterns for any new UI surfaces.
- **D-06:** **Human-in-the-loop** for approved question bank remains; RAG may **prefill or suggest** context, not silently skip review.

</decisions>

<gray_areas>
## Gray areas — planner / executor discretion

These are intentionally **not** locked in discuss so `/gsd-plan-phase 33` can trade off implementation cost:

- **Chunking unit:** layout blocks vs `chunkText` windows vs page-level slices — pick what aligns with existing `layoutChunking` / `extractPdfText` outputs.
- **UI placement:** ingest hub only vs review step vs a dedicated “Sources” panel — must satisfy D-01 (visible search + injection).
- **Injection point:** prepend to chunk text for `parseChunkOnce` vs separate system/user message block vs vision prompt augmentation — choose one coherent contract.
- **Caps:** max vectors per study set, total IDB footprint, eviction — **match your scale** with explicit constants + docs.
- **Embedding model default:** OpenAI `text-embedding-3-small` or user-configurable; must be **user key** and **forwarded**.

</gray_areas>

<canonical_refs>
## Canonical references (read before planning)

- `.planning/PROJECT.md` — local-first, same-origin AI, no cloud sync v1.
- `.planning/ROADMAP.md` — Phase 33 title; depends Phase 32.
- `.planning/phases/31-cache-prompt-prefixes-embeddings-and-content-hashes/31-CONTEXT.md` — embeddings deferred from Phase 31; hashes + cache identity.
- `.planning/phases/32-use-draft-pass-generation-plus-validator-pass-rewrite/32-CONTEXT.md` — parse pipeline seams post-validator.
- `src/app/api/ai/forward/route.ts` — forward pattern for user APIs.
- `src/components/ai/AiParseSection.tsx` — parse orchestration and injection points.

</canonical_refs>

<deferred_ideas>
## Deferred ideas (not required for Phase 33)

- **Phase 34** async workers / queue for full-document indexing at scale.
- Cross-study-set **global** semantic search (optional later).
- **Teacher** or collaboration features.

</deferred_ideas>
