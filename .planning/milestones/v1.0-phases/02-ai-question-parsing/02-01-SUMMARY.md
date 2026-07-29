---
phase: 02-ai-question-parsing
plan: 01
subsystem: types
tags: [typescript, localStorage, nextjs]

requires:
  - phase: 01-pdf-ingestion
    provides: [ExtractResult, PDF text on page for future parse]
provides:
  - Question + AiProvider types (4 options, correctIndex 0–3)
  - localStorage key constants matching D-04
  - SSR-safe AI provider and API key read/write helpers
affects: [phase-02-ui, phase-03]

tech-stack:
  added: []
  patterns: [domain types in src/types, client storage behind window guards]

key-files:
  created:
    - src/types/question.ts
    - src/lib/ai/storage.ts
  modified: []

key-decisions:
  - "Invalid or missing stored provider falls back to openai"
  - "SSR: getProvider returns openai; key getters return empty string"

patterns-established:
  - "AI localStorage keys centralized as exported string constants"

requirements-completed: []

duration: 10min
completed: 2026-04-05
---

# Phase 02: AI Question Parsing — Plan 01 Summary

**Shared `Question` / `AiProvider` contracts and D-04 localStorage helpers with SSR-safe getters and setters.**

## Performance

- **Tasks:** 2 (types + storage module)
- **Files modified:** 2 created

## Accomplishments

- `Question` models MCQ shape (id, stem, 4-tuple options, `correctIndex` 0–3)
- Storage keys match `02-CONTEXT` D-04; `LS_DRAFT_QUESTIONS` reserved for D-21
- `getProvider` / `setProvider` / per-provider key CRUD with `typeof window !== "undefined"` guards
- Groundwork for **AI-01** (persistence contract); key-entry UI is out of scope for this plan

## Task Commits

1. **Task 1–2: Types + AI storage** — (see commit hash below)

## Files Created/Modified

- `src/types/question.ts` — Domain types and localStorage key constants
- `src/lib/ai/storage.ts` — Provider default `openai`; key helpers using those constants

## Decisions Made

None beyond plan — followed D-04 strings and interfaces block exactly.

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None blocking.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 02 UI can import `@/types/question` and `@/lib/ai/storage` for provider toggle and key fields
- Full AI-01 UX (enter/save key in UI) remains for subsequent plans

## Self-Check: PASSED

- `npx tsc --noEmit` exit 0
- `npm run build` exit 0
- `src/types/question.ts` exports `export type Question`, `LS_PROVIDER === "doc2quiz:ai:provider"`, `LS_OPENAI_KEY` / `LS_ANTHROPIC_KEY` per CONTEXT
- `src/lib/ai/storage.ts` imports `@/types/question`, exports `getProvider` and `setKeyForProvider`

---
*Phase: 02-ai-question-parsing*
*Completed: 2026-04-05*
