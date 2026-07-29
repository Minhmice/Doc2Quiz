# Phase 32: Use draft-pass generation plus validator-pass rewrite — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Notes:** Decisions captured via Vietnamese prompts; downstream agents should read decisions in English below.

<domain>
## Phase boundary

Introduce a **two-step parse quality model**: a **draft pass** that proposes MCQ/flashcard items from each chunk (or equivalent unit), then a **validator pass** that repairs or rewrites weak output before results merge into the unified study-set bank.

This phase **does not** replace human review (`PROJECT.md`); it reduces garbage upstream of the review UI. It **builds on** Phase **31** cache/keying — second-pass calls must respect the same prompt/model/content identity rules so caches stay correct.

Roadmap rows for Phase 32 may still say **TBD** for goal text; this CONTEXT defines scope until ROADMAP is updated.

</domain>

<decisions>
## Implementation decisions

### Where the two passes run
- **D-01:** Runs **per chunk** — generate draft output from each chunk, then run validator/rewrite on **that chunk’s output** before merging into the global candidate list. (Aligns with Phase 31 chunk-level caching.)

### Validator role
- **D-02:** **Hybrid validator:** apply **cheap deterministic checks first** (schema/JSON shape, required fields, local repairs). **Invoke an LLM-based validator/rewrite only when** deterministic repair is insufficient. Exact “insufficient” thresholds are **Claude’s discretion** but must be logged with stable reason codes.

### When the second pass runs
- **D-03:** **Always** — every chunk goes through **draft then validator** on the success path (user accepts higher token cost for consistent quality). *Exception path:* if draft fails hard (abort/error), follow existing pipeline error handling — do not infinite-loop.

### Quiz vs flashcards
- **D-04:** **Same contract for both** Quiz and Flashcards — no shipping one mode without the other unless a later phase explicitly splits scope.

### Cost / UX
- **D-05:** User-visible feedback: show a **light toast** when the second pass runs (e.g. refining / validating — exact copy **Claude’s discretion**, short Mint tone). Not fully silent; no requirement for a new settings toggle in Phase 32 unless planning adds a minimal advanced toggle.

### Claude’s discretion
- Exact toast strings and timing (once per chunk vs throttled).
- Hybrid validator thresholds and max LLM validator invocations per chunk.
- Worker/threading: stays compatible with existing `AiParseSection` orchestration.

</decisions>

<canonical_refs>
## Canonical references

**Downstream agents MUST read these before planning or implementing.**

### Planning / product
- `.planning/ROADMAP.md` — Phase 32 placeholder; depends on Phase 31
- `.planning/PROJECT.md` — local-first, review-before-bank, same-origin AI
- `.planning/REQUIREMENTS.md` — update with Phase 32 requirement IDs when `/gsd-plan-phase 32` locks IDs
- `.planning/phases/31-cache-prompt-prefixes-embeddings-and-content-hashes/31-CONTEXT.md` — cache keys, prompt identity, no cross-user cache

### Code seams (integration)
- `src/components/ai/AiParseSection.tsx` — primary parse orchestration
- `src/lib/ai/` — chunk parse, vision batch, layout chunking helpers
- `src/app/api/ai/forward/route.ts` — same-origin forward for LLM calls

</canonical_refs>

<code_context>
## Existing code insights

### Patterns
- Parse flows already support multiple lanes (text / vision / layout); Phase 32 adds a **second pass** within or adjacent to the chunk completion path without breaking Phase 31 cache correctness.

### Integration points
- Hook draft→validator **after** draft JSON/object is produced per chunk, **before** merging into persisted draft bank / review list.
- Validator must respect **AbortSignal** and existing pipeline logging conventions.

</code_context>

<specifics>
## Specific ideas

- User preference (2026-04-18): Vietnamese discussion; locked **per-chunk**, **hybrid** validator, **always** second pass, **quiz + flashcards**, **toast** for second pass.

</specifics>

<deferred>
## Deferred ideas

- **Embeddings / vector store** — Phase 33+ per roadmap.
- **Optional “eco mode”** (skip second pass) — not selected; revisit only if users request cost controls.

</deferred>

---

*Phase: 32-use-draft-pass-generation-plus-validator-pass-rewrite*  
*Context gathered: 2026-04-18*
