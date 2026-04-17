# Phase 01: PDF Ingestion - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers: PDF upload (validated), text extraction via pdf.js into `{ text, pageCount }`, and a scrollable raw-text view — plus loading, success, and error states including the scanned/empty PDF case (PDF-04). No AI parsing, question bank, or practice UI in this phase.

Discussion goal (user): **Lock full Phase 1 UX, validation, and viewer behavior upfront** so Phase 2 can attach to a stable extraction surface without layout or copy refactors.

</domain>

<decisions>
## Implementation Decisions

### 1. Upload flow and layout
- **D-01:** Primary experience lives on a **single main screen** (`src/app/page.tsx`): title/intro → upload → extracted text region below (matches `docs/phase1.md` wireframe). No separate `/ingest` route required for Phase 1 unless implementation convenience dictates; product UX is **one page**.
- **D-02:** **Drag-and-drop and click-to-file** are both required; drop zone remains visually primary.
- **D-03:** After a successful extract, the upload control **stays visible** (not collapsed away) so the user can **choose another PDF** without losing context. Show **filename and file size** after selection.
- **D-04:** **One PDF at a time**; selecting a new file **replaces** the current one and re-runs extraction (no multi-file queue in Phase 1).

### 2. Error and empty-state messaging
- **D-05:** **Tone:** Short, student-friendly, plain language — no stack traces or library names in the default UI.
- **D-06:** For scanned/empty extraction failure (PDF-04), the UI **must include** the required meaning: user understands the PDF has no extractable text. **Minimum copy:** the sentence from requirements — *"This PDF may be scanned. Text extraction failed."* Optional **one** extra line of guidance is allowed (e.g. suggest a text-based PDF) if it does not contradict PDF-04.
- **D-07:** For recoverable errors, the **primary action** is **choose another file** (button or control wired to the same picker flow).
- **D-08:** Validation errors (wrong type, too large) appear **inline near the upload control** (not only toast), in addition to any global error region if used.

### 3. Text viewer (RawTextViewer)
- **D-09:** Extracted body uses a **monospace stack** for raw text (e.g. Tailwind `font-mono`) with comfortable line-height; **wrap** long lines for readability in the browser.
- **D-10:** **Scroll:** vertical scroll inside a **dedicated viewer region** with a sensible max height (e.g. fill remaining viewport below upload) so the page does not grow unbounded on huge documents.
- **D-11:** **Page metadata:** Always show **`pageCount`** from the extract result in viewer chrome (e.g. subtitle or metadata row: "N pages"). **Per-page separators** in the body are **not required** in Phase 1 if `extractText` returns a single concatenated string; if the implementation naturally yields per-page text, **lightweight "--- Page N ---"** markers are acceptable but not mandatory.
- **D-12:** **Idle** state: viewer region shows a **compact placeholder** (e.g. "Extracted text will appear here after you upload a PDF") — not a second empty upload zone.

### 4. File validation behavior
- **D-13:** Validate **before** calling `extractText`: **`.pdf` only** (extension + `application/pdf` when available) and **max 10 MB** (PDF-01).
- **D-14:** **Wrong type:** message such as "Please choose a PDF file." **Oversize:** message that states the **10 MB** limit explicitly.
- **D-15:** During extraction, show a **loading** state that blocks duplicate submits (no parallel double-extract on the same control).

### Claude's Discretion
- Exact visual styling (colors, spacing, shadcn vs custom primitives) — follow existing Tailwind v4 patterns once scaffold exists.
- Minor wording polish around D-06 as long as PDF-04 intent is preserved.
- Implementation detail of pdf.js worker setup and error mapping to user-visible messages.

### Folded Todos
(None — no todos matched this phase.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and requirements
- `.planning/ROADMAP.md` — Phase 1 goal, deliverables, canonical code paths
- `.planning/REQUIREMENTS.md` — PDF-01 through PDF-04 acceptance criteria
- `.planning/PROJECT.md` — constraints (Next.js App Router, Tailwind v4, no OCR, local-first)

### Phase 1 design notes
- `docs/phase1.md` — single-screen flow, component breakdown, state machine (idle/loading/success/error)
- `CLAUDE.md` — pipeline overview, `ExtractResult` shape, Phase 1 scope reminder

### Target implementation paths (per roadmap; create if missing)
- `src/lib/pdf/extractText.ts`
- `src/components/upload/UploadBox.tsx`
- `src/components/viewer/RawTextViewer.tsx`
- `src/app/page.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None in repo yet — `src/` not present. Phase 1 implementation will establish baseline components.

### Established Patterns
- Stack per `CLAUDE.md` / `PROJECT.md`: Next.js App Router, TypeScript, Tailwind v4, React local state only for Phase 1 surface.

### Integration Points
- Future Phase 2 consumes **extracted `text` + `pageCount`** from this screen; keeping upload + viewer on one page and metadata (filename, size, page count) stable reduces churn when adding AI controls (e.g. below viewer or in a second column — planner should preserve the extraction contract).

</code_context>

<specifics>
## Specific Ideas

- User explicitly prioritized **locking UX/validation/viewer** early to **avoid refactor when moving to Phase 2 (AI parsing)**.
- Aligns with `docs/phase1.md` single-screen layout and state list (idle / loading / success / error).

</specifics>

<deferred>
## Deferred Ideas

- Optional `src/app/ingest/page.tsx` split — only if engineering wants a route split; not a product requirement for Phase 1 (D-01).
- Per-page text extraction API — only if needed later for citations or chunking; Phase 1 contract remains `{ text, pageCount }` from roadmap.

### Reviewed Todos (not folded)
(None.)

</deferred>

---
*Phase: 01-pdf-ingestion*
*Context gathered: 2026-04-05*
