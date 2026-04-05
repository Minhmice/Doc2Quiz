# Phase 03: Question Review - Discussion Log

> Audit trail only. Decisions in `03-CONTEXT.md`.

**Date:** 2026-04-05  
**Phase:** 03-question-review  
**Areas discussed:** Screen flow (1), Inline edit (2), Bank storage (3), Practice gate (4)

## Mode

Single message lock — user supplied full decision set (same pattern as Phase 2).

## Resolutions (summary)

| Area | User decision | Notes in CONTEXT |
|------|----------------|------------------|
| Layout | Single `page.tsx`, Review below AI | D-01–D-02 |
| Edit UX | Expandable card, one editor at a time, Save/Cancel | D-03–D-05 |
| Storage | Draft vs approved; replace-only approve | D-06–D-10 |
| Practice | No real practice; disabled button + tooltip | D-11–D-13 |
| Approve validation | Structural checks + fixed error string | D-14–D-15 |
| Components | `review/*` file list | D-17 |

## Clarification recorded (orchestrator / implementer)

- User wrote draft key shorthand `doc2quiz:draftQuestions`; **canonical** implementation key stays **`doc2quiz:ai:draftQuestions`** (`LS_DRAFT_QUESTIONS`) for Phase 2 compatibility — see CONTEXT D-06.

## Deferred

See `03-CONTEXT.md` `<deferred>`.
