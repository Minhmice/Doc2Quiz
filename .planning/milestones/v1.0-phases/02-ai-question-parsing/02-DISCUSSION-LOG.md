# Phase 02: AI Question Parsing - Discussion Log

> Audit trail only. Decisions live in `02-CONTEXT.md`.

**Date:** 2026-04-05  
**Phase:** 02-ai-question-parsing  
**Areas discussed:** Layout (1), Provider + key (2), Chunking + calls (3), Errors + progress + cancel (4)

## Selection

| Input | Detail |
|--------|--------|
| User choice | **1, 2, 3, 4 — accept defaults (production-ready tweaks OK)** |
| Mode | Single message lock — no follow-up Q&A round |

## Captured decisions (summary)

| Area | Resolution |
|------|------------|
| Layout | Single page; AI section **below** viewer; no modal/route |
| Provider + key | Toggle OpenAI/Anthropic; one active password field; storage keys `doc2quiz:ai:*`; show/hide/clear; trust copy; parse blocked without key |
| Chunking | ~800–1200 chars; split on `\n\n` then hard cut; **no** UI tuning; **sequential** only; JSON array contract; **1 retry** then skip chunk |
| Errors + UX | Progress `Parsing questions... x / y chunks`; summary with failed chunk count; friendly 401/429/generic; **AbortController** cancel; keep partial results |

## User-supplied artifacts

- ASCII layout diagram  
- `AIState` type sketch (reflected in CONTEXT D-20)  
- Hard rules list (no full-doc parse, no bank write, etc.) — encoded in `<domain>` + decisions  

## Claude's Discretion noted

- Default model IDs, component file names, exact localStorage draft key suffix.
