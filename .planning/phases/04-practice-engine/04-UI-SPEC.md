---
phase: 04
slug: practice-engine
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-05
---

# Phase 04 — UI Design Contract

> Practice block on the **home page** below **Review & save**. Tailwind v4, native controls, **teal** accent consistent with Phase 2–3.

---

## Section chrome

- **`aria-labelledby`** + **`h2`**: **Practice** (sentence case ok) or **Practice session**.
- **`mt-10 border-t border-neutral-200 pt-10`** to match prior sections.
- Optional one-line hint: keys **1–4** answer, **← / →** navigate.

---

## Question area

- Stem: **readable** body text, `whitespace-pre-wrap` if multi-line.
- Four options as **buttons** or **focusable rows**, labeled **A–D** (or **1–4** sublabels) — must be **visually** mappable to keys 1–4 (first option = 1, etc.).
- **Unanswered:** neutral border; **hover** state for mouse.

---

## Feedback (after answer)

- **Correct** choice: **teal** border/ring/bg (match `teal-600` / `teal-50` family).
- **Wrong** choice (if user picked wrong): **red** border or `red-50` bg.
- **Correct answer** must remain **visible** when user was wrong (reveal correct option).
- Feedback appears **same render** as keypress (no artificial loading).

---

## Auto-advance

- After answer, **~500ms** pause then move to next question (no extra button).
- **Last question:** no advance; show **Session complete** panel (see below).

---

## Question map

- **Below stem** (above options) **or** between stem and options — pick one layout in implementation.
- **N** cells in **flex-wrap** row; each cell: index or dot; **min size** ~28–36px tap target.
- States: **current** = ring `teal-600`; **answered** = filled `teal-600` or check; **unvisited** = muted border `neutral-200`.
- **Click** jumps to that index (if allowed — same as keyboard nav rules).

---

## Nav controls

- **Previous** / **Next** buttons, **disabled** at clamped ends (no wrap per CONTEXT).

---

## Session complete (Phase 5 stub)

- Heading **Session complete** (or equivalent).
- Short line: scoring / mistake drills **in a later step** (no false promises).
- **Done** or **Close** returns user to non-active practice state (parent clears `practiceActive`).

---

## Focus

- Session root **`tabIndex={0}`**; **`focus()`** when session starts so **1–4** work without click.

---

## Start practice (Review section)

- **Enabled** only when approved bank has **≥1** question.
- **Disabled** hint: **`title`** or adjacent text — e.g. **Approve and save questions first.**
