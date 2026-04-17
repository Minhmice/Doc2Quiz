---
phase: 02
slug: ai-question-parsing
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-05
---

# Phase 02 — UI Design Contract (AI section)

> Extends Phase 01 palette (`01-UI-SPEC.md`). AI controls sit **below** the raw text viewer on the same page.

## Layout

| Zone | Behavior |
|------|----------|
| AI Parsing Section | Full-width block under `RawTextViewer`; visually separated with `border-t` or spacing (`lg` / `xl`) |
| Provider row | Segmented control or two radio-style buttons: **OpenAI** / **Claude** |
| Key row | One password field + show/hide icon/button + clear |
| Actions | Primary: **Parse Questions**; when running: **Cancel** (secondary/destructive-neutral styling) |
| Progress | Single line: `Parsing questions… {n} / {total} chunks` |
| Summary | Text line: parsed question count + failed chunk count |
| Preview | Scrollable list of question cards (stem + 4 options + highlight correct index) — compact, not full Phase 3 editor |

## Copy (required strings)

| Element | Copy |
|---------|------|
| Trust | Your API key is stored locally in your browser. It is never sent to our servers. |
| Blocked parse (no key) | Add an API key above to parse questions. |
| No text | Upload and extract a PDF first. |
| Progress | Parsing questions… |
| 401 | Invalid API key. Please check and try again. |
| 429 | Too many requests. Please wait and try again. |
| Generic failure | Some parts of the document could not be processed. |

## Color / typography

- Reuse Phase 01: background `#faf8f5`, surfaces white, accent teal `#0d9488`, errors `#b91c1c`.
- **Cancel** visible only while `running`.

## Registry Safety

- No new component registry; Tailwind-only.

## Checker sign-off

- [ ] Copywriting  
- [ ] Layout under viewer  
- [ ] Color  
- [ ] Progress + cancel affordances  

**Approval:** pending
