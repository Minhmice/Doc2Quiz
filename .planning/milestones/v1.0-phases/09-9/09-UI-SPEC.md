---
phase: 09
slug: math-notation-preview
status: draft
preset: base-nova
created: 2026-04-11
---

# Phase 09 — UI Design Contract (Math / LaTeX)

> Visual contract for **MathJax-rendered** stems and options. Align with **`09-CONTEXT.md`** (D-01–D-05), **`04-CONTEXT.md`** (keyboard/focus), **`PlaySession`**, **`QuestionCard` / `QuestionEditor`**, and **shadcn base-nova** (`globals.css`).

**Sources:** `.planning/phases/09-9/09-CONTEXT.md`, `docs/NOTES-latex-math-rendering.md`, `src/components/review/QuestionCard.tsx`, `src/components/play/PlaySession.tsx`.

---

## Design system

| Property | Value |
|----------|-------|
| Preset | base-nova (existing) |
| Math font | Inherited from MathJax output (CHTML or SVG per plan) — **do not** override with a random webfont that breaks glyph metrics. |
| Stem body | Match existing **`text-base` / `text-sm`** contexts: practice stem uses **16px / medium** weight today — keep outer wrapper; math may use slightly smaller internal scale via MathJax config only if needed for fit. |

---

## Layout

| Surface | Rule |
|---------|------|
| Read-only stem | Replace plain `<p>{text}</p>` with **`MathText`** (or equivalent) in a container with **`whitespace-pre-wrap`** preserved for segments **outside** math. |
| Options (list) | Option label **A–D** stays left column; **math** sits in the same **`flex-1 min-w-0`** column as today’s text — **no** overlap with badges. |
| Editor | **Textarea unchanged** for editing. **Preview** block sits **below** each textarea (stem + each option), **`rounded-md border border-border bg-muted/30 px-3 py-2`**, label **“Preview”** with **`text-xs text-muted-foreground`**. |
| Debounce | Preview updates **300–500ms** after last keystroke (D-04). Show subtle **`text-muted-foreground`** “Rendering…” only if typeset exceeds **400ms** (optional — Claude’s discretion). |

---

## Focus & keyboard

- Preview is **not** focusable (`tabIndex={-1}` on outer preview div unless a11y review requires otherwise).
- **No** `window` key listeners added for math.
- Active element guard: math re-typeset must **not** move focus from `<textarea>` or `<input>` (D-05 + Phase 4 spirit).

---

## Error / fallback (visual)

| State | UI |
|-------|-----|
| MathJax load failure | Inline **`Alert` variant="destructive"`** or muted banner: “Math preview unavailable” — stem still shows raw string elsewhere. |
| TeX parse error | **Muted** inline text `text-destructive` one line under preview: “Invalid math — showing raw below” + monospace raw snippet **truncated** to ~120 chars (exact copy in PLAN task). |

---

## Color

- Keep **emerald** / **red** feedback semantics from practice/review when wrapping option rows — only the **inner** math span uses MathJax coloring; outer borders unchanged.

---

## Verification (UI)

- [ ] Practice stem + options render without horizontal overflow on **360px** width for a stem containing `$\frac{1}{2}$`.
- [ ] Editor: tab order **Question → options → radios → buttons** unchanged from today.
