# Phase 08: Flashcards mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `08-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 8 — Flashcards mode
**Areas discussed:** UI entry (play vs dedicated route), backlog-aligned defaults

---

## UI entry (`/sets/[id]/play` vs dedicated route)

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented on play | Quiz \| Flashcards on same `/sets/[id]/play` URL | |
| Dedicated route | `/sets/[id]/flashcards` with shared set shell | ✓ |
| Planner decides | No lock — left to plan-phase | |

**User's choice:** Dedicated route `/sets/[id]/flashcards`.

**Notes:** Matches backlog option “route `/sets/[id]/flashcards` with shared shell”; aligns with bookmarking and clear separation from MCQ results flow.

---

## Backlog defaults (no separate AskUserQuestion turn)

| Topic | Description | Selected |
|-------|-------------|----------|
| Data v1 | Derive from `Question` vs new `Flashcard` store | Derive from `Question` (BACKLOG recommendation (1)) |
| Quiz scoring | Hook flashcards into `recordQuizCompletion` | Deferred — v1 flashcards do not write quiz session history |
| AI / SRS | Model-generated pairs, spaced repetition | Explicitly deferred (per backlog) |

**User's choice:** Implicit from attaching `docs/BACKLOG-flashcards.md` plus phase discuss intent; confirmed in CONTEXT as D-01, D-02, D-09, `<deferred>`.

---

## Claude's Discretion

- Card flip animation vs instant swap; optional Home/End keys; exact header strings and all inbound links from set surfaces.

## Deferred Ideas

- Captured in `08-CONTEXT.md` `<deferred>` — standalone Flashcard type, AI emit, spaced repetition, mistake flashcard deck, on-play toggle only.
