# Phase 08: Flashcards mode - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 adds a **flashcard study mode** next to the existing **MCQ play** flow, using the same **study set** and **approved `Question[]`** in IndexedDB. Learners flip **front → back** with the keyboard, move between cards with arrows, and stay within the **keyboard-first** product principles.

**In scope (v1):** derive card content from **`Question`** (no new persisted flashcard schema); dedicated App Router page **`/sets/[id]/flashcards`** under the set layout; minimal session state (index + flipped); optional images via existing `questionImageId` / correct-option media patterns where already supported on questions.

**Explicitly out of v1:** standalone **`Flashcard`** type + editor; AI-generated flashcard pairs; spaced repetition / mistake-only flashcard decks; wiring flashcard runs into **`recordQuizCompletion`** / wrong-answer history (those remain **quiz/MCQ** concerns unless a later phase explicitly extends them).

**Alignment with shipped stack:** Phase 5 CONTEXT notes practice lives on **`/sets/[id]/play`** (`PlaySession`). Flashcards follow the same **set-scoped** pattern on a **sibling route**, not the legacy single-page `page.tsx` sketch.

</domain>

<decisions>
## Implementation Decisions

### 1. Data model (v1)
- **D-01:** **Derive from `Question`:** **Front** = question stem (`question` text) + optional **`questionImageId`**. **Back** = text of the **correct** option (`options[correctIndex]`) + optional image on that option if the app already stores per-option image ids (mirror MCQ media behavior in `PlaySession` where applicable).
- **D-02:** **No migration** and **no** new object store for flashcards in v1. Card list = filtered **`Question[]`** from **`getApprovedBank`** (same source as play). Questions must remain **valid MCQs** for derivation to work.

### 2. Navigation & entry (user-confirmed)
- **D-03:** **Dedicated route:** **`/sets/[id]/flashcards`**, sibling to **`/sets/[id]/play`**, reusing the same **`(app)/sets/[id]`** layout/shell patterns (header hierarchy, back links to library/review as appropriate — **Claude’s discretion** for exact chrome strings).
- **D-04:** Provide **clear entry** from the set hub: at minimum a **link** from the play page and/or set dashboard/review surfaces (planner picks all touchpoints; at least one obvious path).

### 3. Keyboard & focus
- **D-05:** **Space** toggles **flipped** vs **not flipped** for the current card (prevent default where needed to avoid page scroll when focused).
- **D-06:** **ArrowLeft / ArrowRight** move to **previous / next** card (same **no-wrap** default as Phase 4 for arrows unless product asks otherwise).
- **D-07:** On entering the flashcard view, **focus** a session root (`tabIndex={0}` or equivalent) so **Space** and arrows work **without a prior click**, matching PRAC-style expectations.

### 4. Session behavior
- **D-08:** **One-dimensional progress:** **current index** in `[0 .. n-1]` and **boolean flipped**; resetting flipped to **false** when the index changes (standard flashcard UX).
- **D-09:** **No** requirement in v1 to persist partial flashcard sessions across reloads (in-memory is enough). **Do not** call **`recordQuizCompletion`** from flashcard mode in v1.

### 5. Empty / edge states
- **D-10:** If approved bank is **empty** or missing, show the same class of **actionable empty state** as play (link to review / explain approve flow) — reuse copy patterns from **`PlaySession`** where possible.

### Claude's Discretion
- Visual design of the **card** (shadow, flip animation vs instant swap).
- Whether **Home / End** jump to first/last card.
- Minor **aria** live regions for flip state.
- Exact duplicate of play header vs simplified **Flashcards · {title}** header.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product backlog & roadmap
- `docs/BACKLOG-flashcards.md` — goals, data options, UI ideas, AI deferrals, dependency notes
- `.planning/ROADMAP.md` — Phase 8 goal, deliverables, canonical refs block

### Requirements & principles
- `.planning/PROJECT.md` — keyboard-first, local-only, core value
- `.planning/REQUIREMENTS.md` — PRAC-adjacent expectations where applicable (extend with explicit FLASH-* reqs when promoting from backlog if desired)

### Prior phase locks (continuity)
- `.planning/phases/04-practice-engine/04-CONTEXT.md` — keyboard defaults, focus, arrow semantics (historical; route migrated — see Phase 5)
- `.planning/phases/05-score-repeat/05-CONTEXT.md` — **shipped** anchor is **`/sets/[id]/play`** + `PlaySession`; scoring / drill **MCQ-only**

### Implementation anchors
- `src/components/play/PlaySession.tsx` — bank load, media, keyboard-heavy session UX patterns
- `src/app/(app)/sets/[id]/play/page.tsx` — set play shell, `review=mistakes` query pattern
- `src/lib/db/studySetDb.ts` — `ensureStudySetDb`, `getApprovedBank`, `getMediaBlob`
- `src/types/question.ts` — `Question`, correct index, image fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **`PlaySession`** — patterns for **`ensureStudySetDb`**, **`getApprovedBank`**, **`getMediaBlob`**, **`MediaImage`**, loading/error/empty flows, and keyboard-driven UX.
- **Set routes** — `(app)/sets/[id]/layout.tsx` and play page for **composition** of a new **`/flashcards`** segment.
- **`Card` / `Button` / `Progress`** from play UI — reuse for a cohesive flashcard surface.

### Established patterns
- **IndexedDB** is the source of truth for approved questions per set; flashcards are a **read-only consumer** of the same bank in v1.
- **MCQ results and mistakes** are owned by **`activityTracking`** + **`PlaySession`**; flashcards stay **outside** that pipeline until explicitly scoped later.

### Integration points
- **New file:** `src/app/(app)/sets/[id]/flashcards/page.tsx` (or equivalent) + a **`FlashcardSession`** (or inline) client component under e.g. **`src/components/flashcards/`**.
- **Navigation:** add links alongside existing paths from **dashboard / set / play** (planner lists exact components).

</code_context>

<specifics>
## Specific Ideas

- User request (Vietnamese): implement the capability described in **`docs/BACKLOG-flashcards.md`** (“tạo function này”).
- User chose **dedicated route** **`/sets/[id]/flashcards`** over an on-page Quiz/Flashcards toggle.

</specifics>

<deferred>
## Deferred Ideas

- **Standalone `Flashcard` type**, editor, and optional **AI** mapping from text → `{ front, back }` — per backlog §Data model options (2) and §AI.
- **Spaced repetition** and **mistake-only flashcard deck** — backlog §Suggested order items 3–4; ties to scoring/wrong-answer work if unified later.
- **On-page mode toggle** on `/play` only — explicitly not chosen; could be revisited if deep-linking is insufficient.

### Reviewed Todos (not folded)
(None — `todo match-phase` not run in this session.)

</deferred>

---
*Phase: 08-flashcards-mode*
*Context gathered: 2026-04-11*
