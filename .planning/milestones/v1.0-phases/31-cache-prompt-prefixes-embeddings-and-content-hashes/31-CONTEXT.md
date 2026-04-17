# Phase 31: Cache prompt prefixes, embeddings, and content hashes — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning — user locked **Recommended package** (2026-04-18 discuss).

<domain>
## Phase boundary

Improve the AI parse pipeline by **caching deterministic work** and by **keying caches to prompt + model + content identity**, so repeat runs (same PDF region, same chunk, same vision batch) avoid redundant vendor calls and prompt edits invalidate safely.

**In scope (from roadmap title + dependencies):**

- **Prompt prefixes / system prompt identity** in cache keys (including version bumps when prompts or response schema expectations change).
- **Content hashes** (fingerprints of inputs: chunk text, batch image fingerprints, layout-block payloads as applicable).
- **Embeddings** are **deferred to Phase 33** for this phase (Phase 31 ships hashes + versioned parse caches only).

**Out of scope (defer / separate phases):**

- A full **vector retrieval / RAG product surface** (roadmap already routes this toward Phase 33+).
- **Server-side shared caches** or cross-user cache (violates `PROJECT.md` local-first posture).

**Depends on:** Phase 30 (layout-aware chunking produces stable chunk inputs worth caching).

</domain>

<decisions>
## Locked decisions (architecture + existing code)

### Local-first & privacy
- **D-01:** All Phase 31 caches and derived artifacts are **browser-local** (memory and/or IndexedDB). No requirement for cloud persistence in this phase.

### Fingerprinting
- **D-02:** Prefer **`SHA-256`** via `crypto.subtle.digest` when available; provide a deterministic fallback string when not (matches `hashVisionBatch` posture in `src/lib/ai/visionParseCache.ts`).

### Prompt identity must affect keys
- **D-03:** Any cache that stores model outputs must include **prompt-relevant identity** in the key:
  - Text lane: `src/lib/ai/prompts/mcq-extraction.prompts.json` already exposes a numeric **`version`** — Phase 31 should treat this as the canonical “prompt prefix version” unless we explicitly choose to hash full system strings.
  - Vision batch lane: today uses `VISION_BATCH_PROMPT_V` string constant — Phase 31 should **align** vision + text lanes to a **single versioning scheme** (either: unify on prompts JSON version for both, or hash the effective system prompt bytes — planner picks, but must be one coherent rule).

### Baseline behavior (today) — do not regress
- **D-04:** Vision batch caching is currently **in-memory** (`Map`) and best-effort keyed by page image fingerprints (data URL length + head slice + indices). Phase 31 changes should preserve correctness: **cache hits must not apply** across incompatible prompt/model/provider combinations.

### User-locked package: **Recommended** (2026-04-18)

- **D-05 (G-01):** **Defer embeddings** to Phase 33. Phase 31 implements **content hashing + prompt/model/provider versioning + durable parse caches** only.
- **D-06 (G-02):** Promote parse caches to **IndexedDB** (still local-only), with explicit size/eviction policy (planner/detail).
- **D-07 (G-03):** Cache entries are **content-addressable** (shared across study sets when inputs match). Keys must still include **prompt version + model + forward provider identity** so collisions cannot cross incompatible configurations. Optional: store `studySetId` as non-key metadata for debugging.
- **D-08 (G-04):** Apply the **same cache contract** to **vision batch**, **sequential text chunk parse**, and **layout-aware text segments** (post Phase 30).

### Claude’s discretion (implementation)
- Exact LRU/eviction policy and per-store size caps.
- Whether to store raw assistant text vs normalized parsed items (as long as validation/dedupe behavior matches today).
- Internal module layout (`visionParseCache.ts` evolution vs new `parseCache/` module).

</decisions>

<gray_areas>
## Gray areas — resolved

User selected the **Recommended** package on 2026-04-18. See **D-05..D-08** above.

</gray_areas>

<code_context>
## Existing code insights (reuse points)

- **Vision batch cache:** `src/lib/ai/visionParseCache.ts` (`hashVisionBatch`, in-memory store, `VISION_BATCH_PROMPT_V`).
- **Vision batch runner:** `src/lib/ai/runVisionBatchSequential.ts` (cache hit/miss events; includes flashcard fingerprint in key when applicable).
- **Prompt sources:** `src/lib/ai/prompts/mcqExtractionPrompts.ts` + `mcq-extraction.prompts.json` (`version` field).
- **Text chat parse:** `src/lib/ai/parseChunk.ts` (`parseOpenAI` uses system prompt parameter; no cache yet — likely Phase 31 insertion point).

</code_context>

<canonical_refs>
## Canonical references

- `.planning/PROJECT.md` — local-first, user credentials, same-origin forward.
- `.planning/ROADMAP.md` — Phase 31 title + dependency on Phase 30.
- `.planning/phases/30-replace-page-level-chunking-with-layout-aware-chunking/30-CONTEXT.md` — layout chunk inputs that should be cacheable.

</canonical_refs>

<deferred_ideas>
## Deferred ideas (not Phase 31)

- Cross-device sync of caches / “team prompt cache”.
- Server-side embedding store or centralized rate-limit pooling.

</deferred_ideas>
