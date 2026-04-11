# Phase 9: Math & notation preview (LaTeX-first, subject-ready) - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers **correct mathematical typesetting** in MCQ **stems and options** (starting with **math** content: LaTeX-style delimiters from PDF/AI), plus a **preview** while reviewing/editing — not “nicer plain text.” Other subjects may **reuse the same notation layer** when content is still formula/LaTeX; chem diagrams, circuits, SMILES, etc. stay **out of scope** (separate phase/backlog).

**In scope:** shared renderer component wired through review + practice surfaces; **MathJax 3** as the **user-chosen** primary engine; safe handling of **untrusted** strings from AI/user; editor preview behavior as locked below.

**Non-goals:** remain per ROADMAP (subject-specific parsers beyond notation, new AI formats solely for math, spaced repetition).

</domain>

<decisions>
## Implementation Decisions

### Rendering stack & security
- **D-01:** Primary math engine is **MathJax 3** (explicit product choice over roadmap’s KaTeX-lean research default).
- **D-02:** **How MathJax is loaded and split-chunked** (npm vs CDN, React wrapper vs `typeset` in `useEffect`, which MathJax components) is **planner/executor discretion**, with this **constraint**: align with **offline-first** intent in `PROJECT.md` — **prefer self-hosted / bundled** assets so that **core formula viewing does not require a live CDN** after the app scripts are available. If implementation uses a CDN, the plan must document **network dependency** and mitigation (e.g. cache) as an explicit trade-off.
- **D-03:** **Security:** treat stems/options as **untrusted**. Do **not** pipe delimiter segments into raw `dangerouslySetInnerHTML` without a hardened pipeline. Follow MathJax guidance for untrusted TeX; **avoid** trust modes that enable script-like features; stay on **supported patched** library versions and monitor advisories (parity with KaTeX CVE discipline noted in `docs/NOTES-latex-math-rendering.md`).

### Editor & preview UX
- **D-04:** In `QuestionEditor` (and equivalent), math preview updates on a **debounced** schedule after typing, target **~300–500ms** (executor may tune within that band for feel vs CPU).
- **D-05:** **Accessibility/focus micro-behavior** for the preview region (e.g. `aria-live`, scroll anchoring) is **not** fully specified here — **planner decides** with **moderate** a11y priority unless a later review raises gaps. Hard rule from Phase 4: preview/layout work **must not steal focus** from text inputs or break keyboard review flows.

### Claude's Discretion
- Exact MathJax package layout, TeX input jax configuration, and whether display math uses `$$` blocks vs `\[` `\]` after delimiter pass.
- Delimiter grammar for ambiguous `$` (currency), escaping rules, and invalid-TeX fallback presentation — informed by `docs/NOTES-latex-math-rendering.md`, finalized in PLAN.
- Whether Phase 9 ships **strictly after** Phase 8 flashcards or **in parallel** if flashcards slip — roadmap already allows “or parallel”; **schedule** is execution planning, not blocking this CONTEXT.

### Folded Todos
(None — `todo match-phase` returned no matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & roadmap
- `.planning/ROADMAP.md` — §Phase 9 goal, deliverables, non-goals, canonical refs list
- `docs/NOTES-latex-math-rendering.md` — problem framing, delimiter ideas, integration touchpoints, stack comparison table

### Types & review/practice surfaces
- `src/types/question.ts` — `Question` string fields to render
- `src/components/review/QuestionEditor.tsx` — stem/options inputs + hook for debounced preview
- `src/components/review/McqOptionsPreview.tsx` — option list rendering
- `src/components/review/QuestionCard.tsx` — read vs edit display paths (`whitespace-pre-wrap` today)

### Prior keyboard / focus constraints
- `.planning/phases/04-practice-engine/04-CONTEXT.md` — D-04–D-07 (1–4 keys, focus on session root, do not steal keys from inputs)

### Upstream docs (MathJax)
- `https://docs.mathjax.org/` — configuration, components, browser integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`McqOptionsPreview`**: central place for option rows (labels A–D); should consume a shared **rich text / math** primitive for option strings.
- **`QuestionCard` + `QuestionEditor`**: stem is plain `<p className="whitespace-pre-wrap">` in read mode; editor uses controlled fields — preview should sit **adjacent** or **below** fields without replacing native inputs.

### Established Patterns
- **Client components** (`"use client"`) already used in review UI — MathJax `typeset` fits this model.
- **Keyboard-first practice** (`04-CONTEXT`): any global listeners for practice must remain **scoped**; math preview must not add `window` key handlers.

### Integration Points
- Wire shared renderer anywhere `question.question` / `question.options[i]` surface: review list, AI preview (`QuestionPreviewList`), play/flashcard shells when those show text (grep during planning).

</code_context>

<specifics>
## Specific Ideas

- User discussion was conducted **in Vietnamese**; product locked **MathJax 3** and **debounced editor preview**; loading strategy left to planner under **offline-first bias**.

</specifics>

<deferred>
## Deferred Ideas

- **Delimiter policy** (`$` vs `$$`, currency `$`, escaping) — decide in PLAN with fuzz testing on real PDF/AI samples.
- **Invalid TeX fallback** (raw vs badge vs strip) — decide in PLAN / UX pass.
- **KaTeX path** — deprioritized by D-01; revisit only if MathJax bundle size or integration blocks shipping.
- **Chem / physics non-LaTeX notations** — future phases.

### Reviewed Todos (not folded)
(None.)

</deferred>

---

*Phase: 09-math-notation-preview*
*Context gathered: 2026-04-11*
