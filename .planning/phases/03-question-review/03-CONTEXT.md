# Phase 03: Question Review - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 lets the user **inspect, edit, delete, and approve** AI-parsed questions **before** they become the durable **question bank**. Output is a **replace-only** approved snapshot in localStorage. **No** real practice session in Phase 3 — practice stays Phase 4 (stub CTA only).

Pipeline locked end-to-end: **PDF → text → AI draft → review → approved bank**.

Hard rules: **no** `/review` route or wizard stepper; **no** merge/append of bank sets; **no** “skip review” path in v1; **no** live practice wiring.

</domain>

<decisions>
## Implementation Decisions

### 1. Screen model / flow
- **D-01:** **Single page** — extend **`src/app/page.tsx`** downward. Order: Upload → Raw text viewer → AI Parsing section → **Review & Save section** (question list + Approve & Save). **No** separate route, **no** wizard stepper.
- **D-02:** Rationale: linear flow, no context switch; Phase 4 plugs **below** this column when ready.

### 2. Inline edit (expandable card)
- **D-03:** **One column**, **expandable card** per question: collapsed shows stem + A–D + **Edit** control; expanded shows controlled inputs for stem, four options, **radio** for correct answer, **Save** / **Cancel** (Cancel reverts to last committed row state).
- **D-04:** **Only one** question in edit mode at a time (`editingId: string | null`). Opening edit on Q2 closes edit on Q1 (discard or prompt — **auto-save previous not required**; user must Save or Cancel before switching, or switching cancels with revert — executor picks **Cancel-on-switch** for simplicity unless UX friction).
- **D-05:** **No** side panel, **no** two-column review layout.

### 3. Question bank storage (draft vs approved)
- **D-06 — Draft (Phase 2):** Canonical key remains **`doc2quiz:ai:draftQuestions`** (constant `LS_DRAFT_QUESTIONS` in `src/types/question.ts`). Phase 3 **reads** this as the working draft source; Phase 2 continues to **write** parse results here. *(User shorthand `doc2quiz:draftQuestions` = same bucket as this key.)*
- **D-07 — Approved bank (Phase 3):** **`doc2quiz:bank:approvedSet`** — store JSON matching **`ApprovedBank`**:
  ```ts
  type ApprovedBank = {
    version: 1;
    savedAt: string; // ISO
    questions: Question[];
  };
  ```
- **D-08:** **Approve** behavior: **replace entire bank** with current reviewed list (after deletes/edits). **No** merge, **no** append, **no** multi-set.
- **D-09:** Re-approve **overwrites** previous bank. If reviewed list is **empty** (zero questions), **disable** Approve & Save (cannot persist empty bank).
- **D-10:** Add exported constant for bank key in `src/types/question.ts` (e.g. `LS_APPROVED_BANK = "doc2quiz:bank:approvedSet"`) for single source of truth.

### 4. Gate to practice (Phase 4)
- **D-11:** **No** real practice in Phase 3. After successful approve, show success copy including: **“Practice mode will be available in the next step.”** (exact sentence may be wrapped in a short paragraph).
- **D-12:** **Start Practice** button: **visible but disabled** with tooltip: **“Practice will be unlocked in Phase 4”** (exact tooltip string).
- **D-13:** **No** “skip review” affordance in Phase 3.

### 5. Validation on Approve
- **D-14:** Every question must have non-empty `question`, exactly **four** non-empty `options`, and `correctIndex` in **0..3**. Same structural rules as Phase 2 validator.
- **D-15:** If validation fails: show **exact** user-facing string: **`Some questions are incomplete. Please fix before saving.`**

### 6. State model (conceptual)
- **D-16:** Align UI state with:
  ```ts
  type ReviewState = {
    draftQuestions: Question[];
    editingId: string | null;
    approved: boolean; // e.g. last action succeeded
    bank: ApprovedBank | null; // hydrated from LS after load
  };
  ```
  Implementation may split across hooks; semantics must match.

### 7. Component breakdown
- **D-17:** Under `src/components/review/`:
  - `QuestionCard.tsx` — collapsed + expand trigger
  - `QuestionEditor.tsx` — expanded fields + Save/Cancel
  - `ReviewList.tsx` — maps list, enforces single-editor rule
  - `ReviewSection.tsx` — section chrome, Approve & Save, summary counts, practice stub

### 8. UX summary counts
- **D-18:** Show live summary consistent with roadmap (e.g. **“N questions ready — M deleted”** or equivalent) reflecting current list length vs initial load count — executor defines exact formula in PLAN.

### Claude's Discretion
- Exact Tailwind for cards; keyboard focus order inside editor; whether “switch question while editing” auto-Cancels or blocks with inline hint.
- Hydrating `draftQuestions` from localStorage on mount vs prop lift from `AiParseSection` — prefer **single source**: read `LS_DRAFT_QUESTIONS` in `ReviewSection` or lift state to `page.tsx` in PLAN.

### Folded Todos
(None.)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 3 goal, deliverables, REVIEW-01–04
- `.planning/REQUIREMENTS.md` — Question Review section
- `.planning/PROJECT.md` — human-in-the-loop rationale
- `.planning/phases/02-ai-question-parsing/02-CONTEXT.md` — draft key, `Question` shape
- `src/types/question.ts` — `Question`, `LS_DRAFT_QUESTIONS`
- `src/components/ai/AiParseSection.tsx` — writes draft after parse (integration point)

</canonical_refs>

<code_context>
## Existing Code Insights

- **`Question`** type already matches review/edit needs.
- Draft persistence already exists under **`LS_DRAFT_QUESTIONS`**; Phase 3 adds **`LS_APPROVED_BANK`** and `ApprovedBank` wrapper.
- Home page is already a vertical stack; **ReviewSection** composes after **AiParseSection**.

</code_context>

<specifics>
## Specific Ideas

- User locked **single-page**, **expandable one-column edit**, **replace-only bank**, **disabled Practice** stub with fixed tooltip, and **strict approve validation** copy.

</specifics>

<deferred>
## Deferred Ideas

- Multi-set / merge banks — out of scope.
- Skip review — Phase 4+ product decision only if roadmap changes.
- Dedicated `/review` route — deferred unless page weight forces split.

### Reviewed Todos (not folded)
(None.)

</deferred>

---
*Phase: 03-question-review*
*Context gathered: 2026-04-05*
