# Phase 04: Practice Engine - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the **keyboard-first practice loop** over the **approved question bank**: start a session, answer with **1/2/3/4**, see **immediate** correct/incorrect feedback, **auto-advance**, move **back/forward** with arrows (and on-screen controls), and a **question map** of answered vs current vs not-yet-visited.

**In scope (ROADMAP + PRAC-01–06):** session UI, input handling, feedback, navigation, map, in-memory session state.

**Explicitly Phase 5 (not Phase 4):** end-of-session **score breakdown** (X/Y, %), **wrong-answer persistence** across refreshes, **drill mistakes** CTA. Phase 4 may show a **minimal “session complete” stub** that points forward to Phase 5 so the flow does not dead-end.

**Hard alignment with Phase 3:** **No** new route such as `/practice` for v1 Phase 4. Practice lives on the **same home column** as upload → viewer → AI → review (**`src/app/page.tsx`**), **below** the review block — continuing **D-02** (“Phase 4 plugs below”).

</domain>

<decisions>
## Implementation Decisions

### 1. Screen model & entry
- **D-01:** **Single page** — practice UI is a **section below** `ReviewSection` on **`page.tsx`** (same `max-w-3xl` column). **No** App Router segment for practice in Phase 4.
- **D-02:** **Start practice** (replace Phase 3 disabled stub): enabled only when **`loadApprovedBank()`** returns a bank with **`questions.length > 0`**. If missing/empty, keep disabled with clear hint (e.g. title or adjacent text: approve and save first).
- **D-03:** **One session at a time** — starting practice while a session is active is **idempotent** (ignore second click) or **resets** session — **default: reset** if user clicks Start again (reload bank from LS); executor may choose confirm later in Phase 5.

### 2. Keyboard & focus (PRAC-01, PRAC-02)
- **D-04:** Keys **`1`–`4`** (main keyboard) map to options **A–D** and **submit immediately** (no separate Confirm step). **Numpad 1–4** supported if trivial (`event.code` / `key` handling); if noisy on some layouts, **Claude’s discretion** to scope to main row only.
- **D-05:** **`ArrowLeft` / `ArrowRight`** move to previous/next question **without wrapping** at ends (or wrap with discretion — **default: no wrap**, clamp at 0 and last).
- **D-06:** **Focus:** When practice is active, a **session root** (e.g. `tabIndex={0}` section or container) receives **focus** on start so digits work **without a prior click** (meets “from the moment the practice screen loads”).
- **D-07:** **Do not steal keys** when focus is inside a text field — practice UI has **no text inputs** in Phase 4; global/key listener attached to session container **or** `window` with guard.

### 3. Feedback & auto-advance (PRAC-03, PRAC-04)
- **D-08:** On answer: show **immediate** correct/incorrect styling (within one render). **Wrong** answer: highlight chosen option as incorrect and **reveal correct** option (border/background — match existing **teal** accent + neutral/red semantics from review/AI sections).
- **D-09:** **Auto-advance** to next question after a **short fixed delay** (~**500ms**, executor may use 400–600ms) so feedback is visible. On **last** question, **no** advance; show **end-of-session** stub (see §6).

### 4. Navigation & changing answers (PRAC-05)
- **D-10:** **On-screen** **Previous** / **Next** buttons mirror arrow behavior (accessible, mouse users).
- **D-11:** Visiting a **previously answered** question **shows** prior choice and feedback state. User may press **1–4** again to **change** the answer; session state **updates** (prepares for Phase 5 scoring). **Unanswered** questions show no feedback until answered.

### 5. Question map (PRAC-06)
- **D-12:** **Compact map** under the question stem (or between stem and options — **Claude’s discretion**) as a **single row / wrapped grid** of **N** cells (N = question count), suitable for narrow column — **not** a wide sidebar.
- **D-13:** States: **current** (distinct ring), **answered** (filled), **not yet visited** (muted). **No** “skipped” state in Phase 4 (no skip key).
- **D-14:** **Click** a cell to **jump** to that index (same rules as changing position: may show answered state).

### 6. End of session (handoff to Phase 5)
- **D-15:** After the **last** question is answered and auto-advance would run, show **Session complete** (or equivalent) with a **short stub**: scoring and mistake drills **come next** (exact wording **Claude’s discretion** — no new product promises beyond roadmap). **No** full score table until Phase 5.

### 7. State & types
- **D-16:** Session state lives in **React state** (parent or dedicated hook) — **no** new localStorage keys for session in Phase 4 (Phase 5 owns persistence of history).
- **D-17:** Add **`src/types/practice.ts`** (or adjacent) with minimal shapes, e.g. per-question **choice index** + whether answered, **current index**, and **ordered `Question[]`** snapshot copied from bank at session start.

### 8. Components (target layout)
- **D-18:** Under **`src/components/practice/`** (names adjustable): e.g. **`PracticeSection`** (orchestrates session + keyboard), **`PracticeQuestionView`**, **`QuestionMap`**. Wire from **`page.tsx`** + replace **Start practice** behavior in **`ReviewSection`** (enable + callback to parent to **start** / scroll).

### Claude's Discretion
- Exact Tailwind classes for feedback colors and map density.
- Whether to **scrollIntoView** practice block on Start.
- Minor key edge cases (repeat key spam, focus restoration after Next).

</decisions>

<specifics>
## Specific Ideas

- Preserve **keyboard-first** positioning from **PROJECT.md** and **CLAUDE.md** as the primary success criterion for this phase.
- Visual language should stay consistent with **AI** and **Review** sections (teal primary, neutral borders, `rounded-lg`).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning & product
- `.planning/ROADMAP.md` — Phase 4 goal, deliverables, acceptance criteria
- `.planning/REQUIREMENTS.md` — PRAC-01–06
- `.planning/PROJECT.md` — keyboard-first, local-only

### Prior phase locks
- `.planning/phases/03-question-review/03-CONTEXT.md` — single-page flow; approved bank key; Start practice gate
- `.planning/phases/03-question-review/03-UI-SPEC.md` — spacing/typography parity where relevant

### Code
- `src/types/question.ts` — `Question`, `ApprovedBank`, `LS_APPROVED_BANK`
- `src/lib/review/approvedBank.ts` — `loadApprovedBank`
- `src/components/review/ReviewSection.tsx` — Start practice stub to replace/enabled
- `src/app/page.tsx` — composition root

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **ReviewSection** — owns **Start practice** button; extend with **`onBeginPractice`** (or equivalent) and bank-aware enablement.
- **approvedBank** — single read path for session seed data.
- **Tailwind patterns** from `AiParseSection` / `QuestionCard` for buttons and alerts.

### Integration points
- **`page.tsx`** — add practice block and session state (or wrapper) below **`ReviewSection`**; pass callback into review.

</code_context>

<deferred>
## Deferred Ideas

- **Timed mode / exam simulation** — v2 (`REQUIREMENTS.md` §Practice Modes).
- **Dedicated `/practice` route** — revisit only if home page becomes too heavy.
- **Skip question** — not in PRAC v1; backlog if requested.

### Folded todos
(None — `todo match-phase` not run.)

</deferred>

---
*Phase: 04-practice-engine*
*Context gathered: 2026-04-05*
