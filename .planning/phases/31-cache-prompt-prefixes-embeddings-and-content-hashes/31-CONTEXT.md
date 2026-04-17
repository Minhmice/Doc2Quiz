# Phase 31: Cache prompt prefixes, embeddings, and content hashes — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning — **pending** user picks on gray areas (see `<gray_areas>`); defaults below unblock `/gsd-plan-phase 31` if user accepts recommendations.

<domain>
## Phase boundary

Improve the AI parse pipeline by **caching deterministic work** and by **keying caches to prompt + model + content identity**, so repeat runs (same PDF region, same chunk, same vision batch) avoid redundant vendor calls and prompt edits invalidate safely.

**In scope (from roadmap title + dependencies):**

- **Prompt prefixes / system prompt identity** in cache keys (including version bumps when prompts or response schema expectations change).
- **Content hashes** (fingerprints of inputs: chunk text, batch image fingerprints, layout-block payloads as applicable).
- **Embeddings** *only if* explicitly confirmed in gray-area selection; otherwise treat as **prep for Phase 33** (hashes + storage hooks without forcing a vector UX).

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

### Claude’s discretion (implementation)
- Exact LRU/eviction policy and per-store size caps.
- Whether to store raw assistant text vs normalized parsed items (as long as validation/dedupe behavior matches today).
- Internal module layout (`visionParseCache.ts` evolution vs new `parseCache/` module).

</decisions>

<gray_areas>
## Gray areas — user must choose (or accept recommendations)

These change product behavior and cost model; pick what to lock now (multi-select in chat):

1. **G-01 — Embeddings in Phase 31**
   - **A:** Phase 31 **includes** generating/storing embeddings for chunk/content units (still local-only).
   - **B:** Phase 31 **defers embeddings** to Phase 33; Phase 31 only ships **hashes + prompt-versioned parse caches**.

2. **G-02 — Durability**
   - **A:** **IndexedDB-backed** caches (survive reload) for at least vision batch + text chunk parses.
   - **B:** **Session memory only** (current vision direction), Phase 31 only improves keys/versioning.

3. **G-03 — Cache namespace**
   - **A:** **Content-addressable** keys (same bytes/text → shared entry across study sets).
   - **B:** **`studySetId`-scoped** keys (simpler lifecycle on delete; less cross-set reuse).

4. **G-04 — Which lanes in wave 1**
   - **A:** Vision batch only.
   - **B:** Vision batch + **sequential text chunk** parse (`runSequentialParse` path).
   - **C:** **B + layout-aware** segments (treat as same text-cache contract).

### Recommended defaults (if user wants fastest planning)

- **G-01 → B** (defer embeddings; prep hashes/keys for Phase 33).
- **G-02 → A** (IDB for parse caches; keep strict caps).
- **G-03 → A** (content-addressable + include model/provider/prompt version in key; optionally store `studySetId` as metadata only).
- **G-04 → C** (one coherent cache story across lanes).

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
