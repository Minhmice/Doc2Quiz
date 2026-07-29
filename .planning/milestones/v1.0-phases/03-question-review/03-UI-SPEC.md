---
phase: 03
slug: question-review
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-05
---

# Phase 03 — UI Design Contract

> Visual and interaction contract for **Review & Save** on the home page. Aligns with `03-CONTEXT.md` (D-01–D-18). Same stack as Phase 1: **Tailwind v4**, native controls, no new component library.

---

## Placement

- **Single column** below **AI question parsing** in `src/app/page.tsx`.
- Section heading: **Review & save** (or equivalent; sentence case consistent with “AI question parsing”).
- No `/review` route, no stepper.

---

## Review list (collapsed card)

- One card per question; **full width** (`max-w-3xl` inherits page column).
- Show label **Q{n}** (1-based index) + question stem (truncation optional after ~2 lines).
- Four lines **A.** … **D.** with option text.
- Control **Edit** (or **Edit ▼**) expands **only** this card; expanding another card **cancels** the previous edit without saving (revert to last saved row state per D-04).

---

## Editor (expanded)

- Fields: multiline or single-line **Question**, four text inputs **A–D**, **Correct answer** as **radio group** (four choices).
- Buttons **Save** and **Cancel**:
  - **Save** commits changes into the in-memory list (and parent state); collapses editor.
  - **Cancel** restores fields from committed state and collapses.
- **Delete** (per card, in collapsed or expanded — executor chooses **collapsed row action** e.g. “Remove” text button) removes the question immediately from the list.

---

## Summary line

- Live text matching roadmap intent, e.g. **`{N} questions ready — {M} removed`** where:
  - `N` = current list length
  - `M` = `initialCount - N` with `initialCount` captured when the section first loaded non-empty draft (or on first successful draft load after mount)

---

## Approve & Save

- Primary button **Approve & save** (or **Approve & Save** to match CONTEXT).
- **Disabled** when:
  - list length is **0**, or
  - any question fails structural validation (same rules as `validateQuestionsFromJson`: non-empty stem, four non-empty options, `correctIndex` 0–3).
- On click failure: show **exact** string: `Some questions are incomplete. Please fix before saving.`
- On success: show checkmark-style success including sentence **Practice mode will be available in the next step.**

---

## Practice stub (Phase 4 gate)

- Button **Start practice** (sentence case ok) **visible**, **`disabled`**, with **`title`** (native tooltip) exactly: `Practice will be unlocked in Phase 4`

---

## Accessibility

- Section uses `aria-labelledby` matching heading id.
- Radio group has associated `<legend>` or `aria-label` **Correct answer**.
- Focus moves logically into expanded editor (first field).

---

## Design tokens

Reuse Phase 01 patterns: neutral text, teal accent for primary actions, `rounded-lg` buttons, `border-neutral-200` cards, spacing consistent with `AiParseSection` (`mt-10 border-t` between major sections optional but preferred for parity).
