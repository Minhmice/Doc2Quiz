---
phase: 01
slug: pdf-ingestion
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-05
---

# Phase 01 — UI Design Contract

> Visual and interaction contract for PDF ingestion. Aligns with `01-CONTEXT.md` (D-01–D-15). No shadcn required for Phase 1 — Tailwind v4 utilities only unless scaffold already adds a library.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (native elements + Tailwind) |
| Icon library | none (optional Unicode or inline SVG for upload hint) |
| Font | `font-sans`: system UI stack; `font-mono` for extracted body per D-09 |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 500 | 1.4 |
| Heading | 24px | 600 | 1.25 |
| Display | 30px | 700 | 1.2 |

Raw extracted text (viewer): **monospace**, 14px, line-height ~1.6, **wrap** long lines (D-09).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#faf8f5` | Page background (warm paper) |
| Secondary (30%) | `#ffffff` | Upload zone, viewer panel surfaces |
| Accent (10%) | `#0d9488` | Primary button, focus ring, drag-active border |
| Destructive | `#b91c1c` | Error text and error borders only |

Accent reserved for: primary file action, focused drop zone, key links — not full paragraph text.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Choose PDF" / "Choose another PDF" (after success) |
| Idle viewer (D-12) | Heading optional; body: "Extracted text will appear here after you upload a PDF." |
| Wrong file type (D-14) | "Please choose a PDF file." |
| Oversize (D-14) | Must mention **10 MB** limit explicitly. |
| Scanned / empty PDF (D-06 / PDF-04) | Must include: **"This PDF may be scanned. Text extraction failed."** Optional one short helpful line. |
| Loading | Short: "Reading PDF…" or "Extracting text…" |

---

## Layout Contract

- **Single column** on `src/app/page.tsx`: app title → short intro → **UploadBox** → **RawTextViewer** region (D-01).
- Upload area **remains visible** after success; show **filename + human-readable size** (D-03).
- Viewer: **scrollable region** with max height filling remaining viewport below upload (D-10); show **"N pages"** when `pageCount > 0` (D-11).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
