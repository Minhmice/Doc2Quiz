# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 1-Foundation
**Areas discussed:** SQL baseline (interactive); Auth, Storage, API (Claude discretion — user skipped to planning)

---

## SQL Migration Reset

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all 6, write one fresh v2.1 baseline | Full delete of `supabase/migrations/*`, single new baseline | ✓ |
| Move old to `.planning/archive/`, fresh baseline | Preserve files outside migrations folder | |
| You decide | Claude picks | |

**User's choice:** Delete all 6, write one fresh v2.1 baseline (Recommended)
**Notes:** User stated explicitly: "delete all old sql thing before go to phase 1"

---

## Remote Supabase Handling

| Option | Description | Selected |
|--------|-------------|----------|
| `supabase db reset` on dev project | Wipes data, applies new baseline | |
| New Supabase project | Fresh `.env` | |
| Schema files only | No remote reset until user says so | ✓ |

**User's choice:** Schema files only for now — no remote reset until I say so
**Notes:** User controls when to point/reset live database.

---

## Canonical Sections Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Separate `canonical_sections` table | One row per section; supports section picker | ✓ |
| JSONB array on document | Simpler, harder to query per section | |
| You decide | Claude picks | |

**User's choice:** Separate `canonical_sections` table (Recommended for flashcard coverage picker)

---

## Study Set ↔ Canonical Document Model

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 `study_sets` + `canonical_documents` | Raw/canonical MD on document row | ✓ |
| Inline on `study_sets` | No separate table | |
| Split markdown versions | Separate rows for raw vs canonical | |

**User's choice:** 1:1 — study_sets + canonical_documents (Recommended)

---

## Auth Restoration (Claude discretion — not discussed interactively)

| Option | Description | Selected |
|--------|-------------|----------|
| Email/password + protected routes | Restore v1 pattern, no backdoor | ✓ |
| OAuth providers | Google/GitHub login | |
| Keep open shell | No auth during build | |

**User's choice:** Deferred to planning — captured in CONTEXT.md as D-12–D-15 (email/password, requireUser, proxy session refresh)

---

## Original File Storage (Claude discretion)

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage bucket | Store originals per CANON-09 / CONV-02 | ✓ |
| Metadata only | No binary storage | |

**User's choice:** Deferred to planning — CONTEXT.md D-10/D-11 (bucket + policies in migration)

---

## API Route Shape (Claude discretion)

| Option | Description | Selected |
|--------|-------------|----------|
| Step-based routes | `/ingest`, `/canonicalize`, `/quiz/generate`, etc. | ✓ |
| Monolithic pipeline endpoint | Single POST runs all steps | |

**User's choice:** Deferred to planning — CONTEXT.md D-16–D-18

---

## Claude's Discretion

- Auth: email/password only, restore real Supabase clients, protect `(app)` routes
- Storage: `doc2quiz` bucket with RLS in baseline migration
- API: step-based stub routes per pipeline.md phases
- Practice tables: carry forward v1 shapes for questions/flashcards/sessions

## Deferred Ideas

- Remote DB reset — user-triggered, not automated in Phase 1
- OAuth — out of v2.1 scope
- MarkItDown, canonical builder, generation — Phases 2–5
