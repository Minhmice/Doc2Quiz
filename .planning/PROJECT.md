# Doc2Quiz

## What This Is

Doc2Quiz is a local-first web app that converts PDFs of study materials — past exams, notes, question banks — into interactive multiple-choice practice sessions. Students upload a document, an AI extracts structured questions, and they drill through them with a keyboard-first interface designed for speed. Everything runs in the browser with no backend.

## Core Value

The practice loop must feel faster and more effective than reading the PDF directly: upload → questions → drill → score → repeat mistakes.

## Requirements

### Validated

- ✓ PDF upload and text extraction (Phase 1)

### Active

- [ ] AI-powered question parsing — user supplies their own API key, calls made client-side
- [ ] Question review/edit interface before saving to bank
- [ ] Keyboard-first practice engine — 1/2/3/4 keys map to A/B/C/D
- [ ] End-of-session score display
- [ ] Wrong-answer drill loop — repeat only missed questions
- [ ] Local question bank persisting across sessions (localStorage/IndexedDB)

### Out of Scope

- Cloud sync / backend — no own server in v1; AI calls go direct to provider
- Teacher/institutional features — student-only v1
- OCR for scanned PDFs — text-based PDFs only; pdf.js cannot OCR
- Multi-user / sharing — single-user local tool
- Analytics dashboards — score + wrong-answer loop is enough for v1

## Context

**Target user:** Students with 10–50 PDFs of past exams or exercises who want to drill actively, not read passively. Speed and repetition matter most.

**AI model:** User supplies their own Claude or OpenAI API key, stored locally in the browser. Calls go client-side directly to the provider — no proxy, no backend. This preserves "offline-first" for everything except the AI extraction step itself.

**What "offline-first" means here:** No own server. AI calls are outbound to a user-controlled provider. All data (questions, scores, wrong answers) stays in localStorage/IndexedDB.

**Starting point:** Phase 1 (PDF upload + text extraction) is already implemented via pdf.js.

## Constraints

- **Tech stack**: Next.js App Router + TypeScript + Tailwind v4 (already scaffolded)
- **Storage**: localStorage/IndexedDB only — no database, no cloud sync
- **AI**: Client-side API calls with user-supplied key — no backend proxy
- **UX**: Keyboard-first — 1/2/3/4 must work for all answer selection throughout

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| User-supplied API key, client-side | Keeps "offline-first" spirit while enabling AI; no backend to maintain | — Pending |
| localStorage/IndexedDB for question bank | No cloud dependency in v1; simplifies deployment | — Pending |
| Review step before saving questions | Human-in-the-loop for AI errors; bad questions ruin practice | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after initialization*
