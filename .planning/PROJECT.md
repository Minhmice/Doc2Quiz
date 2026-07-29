# Doc2Quiz

## What This Is

Doc2Quiz turns study materials into practice. **v2.1 MVP Pipeline:** multi-format input (PDF, Office, images, audio, web, paste, YouTube) → **MarkItDown** → **Canonical Knowledge** (Supabase) → user picks **Quiz** or **Flashcards** → AI generates content → **immediate save** → review (quiz) or learn (flashcards). Frontend shell (dashboard, quiz, flashcards, review, settings) already exists; backend is being rebuilt per [docs/pipeline.md](../docs/pipeline.md).

## Core Value

Import anything readable → structured knowledge → drill → score → repeat mistakes — faster than passive reading.

## Current Milestone: v2.1 — MVP Pipeline

**Status:** Planning  
**Goal:** Implement the pipeline in `docs/pipeline.md` end-to-end with Supabase as source of truth.

**Planning:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`

**Prior milestones:**
- v2.0 Clean Slate — stripped legacy parsing + backend (archived)
- v1.0 Local Practice Loop — shipped 2026-04-18 (archived)

## Requirements

### Active (v2.1)

See [`.planning/REQUIREMENTS.md`](./REQUIREMENTS.md). Summary:

- **Input zone:** PDF, DOCX, PPTX, XLSX, images, audio, HTML, CSV, JSON, XML, paste, YouTube
- **Conversion:** MarkItDown → raw Markdown
- **Canonical knowledge:** clean, section, detect language/type, extract existing Q&A, store in Supabase
- **Quiz:** concepts → MCQs → save → review/edit → practice
- **Flashcards:** goal/coverage/amount → generate → save → learn

### Out of Scope (v2.1)

- Draft/publish/sharing workflows
- Pre-save quality validation gate
- v1 Graphify / custom PDF pipelines (MarkItDown only)
- IndexedDB as primary datastore

### Validated (v1.0 — archived)

Practice UI patterns: keyboard quiz, score screen, mistakes drill, review editor — see v1 archive.

## Context

**Target user:** Students with notes, slides, or past exams who want active drill, not passive reading.

**AI:** User-supplied API keys; server routes call vendors (same-origin forward pattern from v1).

**Storage:** Supabase for canonical knowledge, generated questions/cards, and sessions.

## Constraints

- Next.js App Router + TypeScript + Tailwind v4
- MarkItDown for document conversion (not custom parsers)
- Canonical builder must not invent content
- Save generated quiz/flashcard content immediately — no draft stage
- Keyboard-first quiz: 1/2/3/4 for A/B/C/D

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| MarkItDown for ingestion | Single conversion path for many formats; replaces v1 PDF/OCR/vision stack |
| Canonical knowledge layer | Stable sections for quiz + flashcard generation; dedupe and structure once |
| Supabase source of truth | Replaces client stubs from v2.0 strip; enables auth + persistence |
| Immediate save | Per pipeline.md — no draft/publish/validation stage |
| Retain frontend shell | Dashboard, quiz, flashcards, review UI from prior work |

## Evolution

This document evolves at milestone and phase boundaries.

---
*Last updated: 2026-07-25 — v2.1 MVP Pipeline*
