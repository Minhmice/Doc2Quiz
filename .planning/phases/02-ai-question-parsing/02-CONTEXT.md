# Phase 02: AI Question Parsing - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 turns **extracted PDF text** (from Phase 1) into **structured MCQs** (question + exactly 4 options + correct index) via **user-supplied** OpenAI or Anthropic API keys, **client-side only**. Includes: provider toggle + key UI, chunking, sequential API calls with one retry per chunk, validation, progress + cancel (**AbortController**), friendly errors, and **draft** persistence in localStorage — **not** the final practice bank (Phase 3 review approves into bank).

Hard rules (product): **never** send keys to our servers; **never** parse full document in one API call; **always** chunk first; **always** validate model output; **do not** mutate source extracted text; **do not** write to final question bank in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### 1. Layout integration (single page)
- **D-01:** Stay on **`src/app/page.tsx`** — **extend downward** below `RawTextViewer`. Order: Upload → Raw text viewer → **AI Parsing Section** (provider, key, Parse button, progress, result preview). **No** modal, **no** new route. Viewer **always remains** visible (same Phase 1 behavior).

### 2. Provider + API key (AI-01)
- **D-02:** Providers supported: **`openai`** | **`anthropic`** (Claude).
- **D-03:** UI: **toggle** OpenAI / Anthropic; **single password input** bound to the **active** provider’s key.
- **D-04:** **localStorage** keys (exact strings):
  - `doc2quiz:ai:provider` → `"openai"` | `"anthropic"`
  - `doc2quiz:ai:openaiKey`
  - `doc2quiz:ai:anthropicKey`
- **D-05:** Key input `type="password"` with **show/hide** and **clear** control.
- **D-06:** Static trust copy (must be visible near key UI): **"Your API key is stored locally in your browser. It is never sent to our servers."**
- **D-07:** **Block** “Parse Questions” until the active provider has a **non-empty** key saved in memory / storage for that provider.

### 3. Chunking + AI calls (AI-02, AI-03)
- **D-08:** Chunk target size **~800–1200 characters** per chunk (implement as configurable constants in code, e.g. soft target **1000**, hard cap **1200**, no user-facing slider).
- **D-09:** Split **prefer** paragraph boundaries (`\n\n`), then **fallback** to hard character splits to respect max size.
- **D-10:** **Sequential only:** `for (chunk of chunks) await parseChunk(chunk)` — **no** parallel batching in v1.
- **D-11:** **Do not** expose chunk size controls in UI.
- **D-12:** Model output contract (JSON array of objects):
  ```json
  [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0
    }
  ]
  ```
  Executor picks concrete HTTP APIs: OpenAI + Anthropic **messages**-style endpoints appropriate for JSON; use **JSON mode** / schema nudging where the API supports it.
- **D-13:** **Retry:** on chunk failure, **one** automatic retry; if still failing, **skip chunk** and increment failed-chunk counter.

### 4. Errors, progress, cancel (AI-04, AI-05)
- **D-14:** Progress line copy: **`Parsing questions... {current} / {total} chunks`** (numbers 1-based for display OK if documented).
- **D-15:** Progress state shape (conceptual): `totalChunks`, `currentChunk` (or current index), `status: "idle" | "running" | "done"`.
- **D-16:** Per-chunk failure: **skip** chunk after retry exhaustion; **no** raw JSON or stack traces in UI.
- **D-17:** End summary must support messaging like: **Parsed N questions; M chunks failed** (exact wording can vary; include counts).
- **D-18:** HTTP mapping (user-facing):
  - **401** → **"Invalid API key. Please check and try again."**
  - **429** → **"Too many requests. Please wait and try again."**
  - Generic parse/network → **"Some parts of the document could not be processed."**
- **D-19:** **Cancel:** supported via **`AbortController`** passed through the sequential loop; **Cancel** button visible while `status === "running"`; abort **stops further chunks** and **keeps** questions already parsed.

### 5. State & persistence (Phase 2 draft)
- **D-20:** In-memory shape aligns with user **AIState** concept: `provider`, keys (or derived `apiKey` for active provider), chunk list metadata optional, `questions[]`, `progress`, `errors.failedChunks`.
- **D-21:** Persist **draft parsed questions** (+ minimal metadata such as timestamp) to localStorage under a single dedicated key (executor names e.g. `doc2quiz:ai:draftQuestions`) — **draft only** until Phase 3 “approve to bank”. Replacing PDF / new parse may overwrite draft per planner task spec.

### 6. User flow (acceptance)
1. Upload PDF → see raw text → scroll verify  
2. Enter/save API key → Parse Questions  
3. Progress 1/N … N/N  
4. See parsed preview + summary counts  

### Claude's Discretion
- Exact OpenAI/Anthropic model IDs (e.g. `gpt-4o-mini`, `claude-3-5-haiku-latest`) — choose cost-effective defaults documented in code.
- Minor component split (`ApiKeyPanel`, `ParseProgress`, `QuestionPreviewList`) under `src/components/ai/`.
- Id generation for `Question.id` (`crypto.randomUUID` or nanoid if added).

### Folded Todos
(None.)

</decisions>

<canonical_refs>
## Canonical References

### Product / requirements
- `.planning/ROADMAP.md` — Phase 2 goal, deliverables, AI-01–AI-05
- `.planning/REQUIREMENTS.md` — AI Question Parsing section
- `.planning/PROJECT.md` — client-side keys, no backend proxy

### Phase 1 handoff
- `.planning/phases/01-pdf-ingestion/01-CONTEXT.md` — single-page layout, tone, viewer rules
- `src/app/page.tsx` — integration point
- `src/types/pdf.ts` — `ExtractResult` (do not mutate `text` in place)

### Provider docs (executor must verify current endpoints)
- OpenAI API reference — Chat Completions or Responses (JSON output)
- Anthropic API reference — Messages API

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `src/app/page.tsx` — holds `extractedText`, `pageCount`; AI section reads these, does not replace viewer.
- Tailwind v4 + warm palette from Phase 1 / `01-UI-SPEC.md` patterns.

### Integration points
- AI parse runs only when `extractedText` is non-empty (trim); disable Parse with helpful hint if no text.

### Patterns
- Client-only secrets in `localStorage`; all fetches from browser to vendor APIs.

</code_context>

<specifics>
## Specific Ideas

- User chose **all four** discussion areas and locked **production-ready defaults**: sequential chunking, single-column extension layout, dual provider storage keys, AbortController cancel, friendly HTTP messages.

</specifics>

<deferred>
## Deferred Ideas

- User-tunable chunk size — explicitly out of scope for v1 (D-11).
- Parallel chunk requests — deferred to future milestone.
- Final question bank persistence — Phase 3 only.

### Reviewed Todos (not folded)
(None.)

</deferred>

---
*Phase: 02-ai-question-parsing*
*Context gathered: 2026-04-05*
