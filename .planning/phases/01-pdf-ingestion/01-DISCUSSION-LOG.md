# Phase 01: PDF Ingestion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md`.

**Date:** 2026-04-05
**Phase:** 01-pdf-ingestion
**Areas discussed:** Upload flow and layout; Error and empty-state messaging; Text viewer presentation; File validation behavior

---

## Selection and intent

| Topic | User input |
|-------|------------|
| Gray areas | **1, 2, 3, 4** (all four) |
| Goal | Lock full Phase 1 UX + validation + viewer behavior upfront |
| Reason | Avoid refactor when moving to Phase 2 (AI parsing) |

**Resolution method:** User confirmed all four discussion areas and stated intent to lock decisions upfront. Concrete locks were recorded per prior recommendations, `docs/phase1.md`, and `.planning/REQUIREMENTS.md` (PDF-01–PDF-04), then written to `01-CONTEXT.md` as **D-01–D-15**.

---

## 1. Upload flow and layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single main screen | Upload + viewer on `page.tsx` | ✓ |
| Separate ingest route | Required for Phase 1 | |
| Upload hidden after success | Collapse after extract | |
| Upload remains visible | Replace file anytime | ✓ |
| Metadata | Filename + size after pick | ✓ |
| Multi-file queue | Phase 1 | |
| One file at a time | Replace on new pick | ✓ |

**User's choice:** Lock single-screen flow, persistent upload with filename/size, single active file — aligned with stated Phase 2 handoff goal.
**Notes:** Drag + drop and click both required per roadmap.

---

## 2. Error and empty-state messaging

| Option | Description | Selected |
|--------|-------------|----------|
| PDF-04 minimum | Required failure meaning + core sentence | ✓ |
| Technical errors | Stack traces in UI | |
| Primary recovery | Choose another file | ✓ |
| Error placement | Inline near upload | ✓ |

**User's choice:** Friendly tone; PDF-04 compliance; inline errors; retry via new file.

---

## 3. Text viewer presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Font | Monospace body for raw text | ✓ |
| Wrap | Wrap long lines | ✓ |
| Page count | Shown in viewer chrome | ✓ |
| Per-page body separators | Mandatory in Phase 1 | |
| Scroll region | Bounded / viewport-friendly | ✓ |

**User's choice:** Readable raw view with page count; continuous text unless extract naturally yields pages.

---

## 4. File validation behavior

| Option | Description | Selected |
|--------|-------------|----------|
| When | Before `extractText` | ✓ |
| PDF-only + size | 10 MB cap | ✓ |
| Loading | Guard against double extract | ✓ |

**User's choice:** Strict pre-validation and clear messages for type/size.

---

## Claude's Discretion

- Visual design tokens and pdf.js wiring details — see **01-CONTEXT.md** § Claude's Discretion.

## Deferred Ideas

- Optional `/ingest` route; richer per-page extraction — see **01-CONTEXT.md** `<deferred>`.
