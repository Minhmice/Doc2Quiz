# Doc2Quiz

## What This Is

Doc2Quiz is a local-first web app that converts PDFs of study materials — past exams, notes, question banks — into interactive multiple-choice practice sessions. Students upload a document, an AI extracts structured questions, and they drill through them with a keyboard-first interface designed for speed. **Data** (study sets, drafts, OCR artifacts, sessions) stays in the browser (IndexedDB and localStorage). **AI traffic** uses small Next.js Route Handlers on the same origin (forwarding and image staging), not a separate hosted backend product.

## Core Value

The practice loop must feel faster and more effective than reading the PDF directly: upload → questions → drill → score → repeat mistakes.

## Requirements

### Validated

- Core v1 loop (PDF → parse → review → practice → score → mistakes) — see phases 1–5 in `STATE.md` / `ROADMAP.md`

### Active

- [x] PDF upload and text extraction (`pdfjs-dist`, `extractPdfText`)
- [x] AI-powered question parsing — user API key in localStorage; vendor calls via `POST /api/ai/forward` (see `sameOriginForward.ts`)
- [x] Question review/edit interface before saving to bank
- [x] Keyboard-first practice engine — 1/2/3/4 keys map to A/B/C/D
- [x] End-of-session score display
- [x] Wrong-answer drill loop — repeat only missed questions
- [x] Local question bank persisting across sessions (IndexedDB `studySetDb`, plus legacy migration)

### Out of Scope

- Cloud sync / dedicated product backend — no accounts, no multi-device sync in v1
- Teacher/institutional features — student-only v1
- Built-in offline OCR (e.g. Tesseract) — not in v1; scanned or weak text layers use optional **multimodal OCR/vision** through the user’s API (same-origin forward), not local Tesseract
- Multi-user / sharing — single-user local tool
- Analytics dashboards — score + wrong-answer loop is enough for v1

## Context

**Target user:** Students with 10–50 PDFs of past exams or exercises who want to drill actively, not read passively. Speed and repetition matter most.

**AI model:** User supplies their own Claude, OpenAI, or custom-compatible endpoint; keys and URLs live in browser storage. **Browser → Next Route Handler → provider:** CORS-blocked requests use `POST /api/ai/forward` (`src/app/api/ai/forward/route.ts`). Large vision payloads may use `POST /api/ai/vision-staging` for same-origin image URLs.

**What "offline-first" means here:** No cloud account or sync. Study material and quiz state stay on-device (IndexedDB). AI extraction is online only to the user-chosen vendor.

**Starting point:** v1 practice loop (phases 1–5) is implemented; later roadmap phases cover hardening, math preview, scale-mode stubs, and domain cleanup — see `.planning/STATE.md` and `.planning/ROADMAP.md`.

## Constraints

- **Tech stack**: Next.js App Router + TypeScript + Tailwind v4 (already scaffolded)
- **Storage**: IndexedDB primary (`studySetDb`); localStorage for AI settings and parse UI toggles — no cloud sync
- **AI**: User-supplied credentials; same-origin Next Route Handlers forward to vendor HTTPS (not raw browser-to-vendor for blocked APIs)
- **UX**: Keyboard-first — 1/2/3/4 must work for all answer selection throughout

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| User-supplied API key + same-origin forward | Avoids CORS; keys never stored server-side; user controls vendor URL | Implemented (`sameOriginForward`, `/api/ai/forward`) |
| IndexedDB for study sets and drafts | No cloud dependency in v1; supports large PDF buffers and OCR tables | Implemented (`studySetDb`) |
| Review step before saving questions | Human-in-the-loop for AI errors; bad questions ruin practice | Implemented |

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
*Last updated: 2026-04-11 — aligned with implementation (`src/`) and `.planning/STATE.md`*
