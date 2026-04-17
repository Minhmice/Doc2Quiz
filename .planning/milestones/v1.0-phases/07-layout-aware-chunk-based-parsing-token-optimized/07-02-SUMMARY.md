---
phase: 07-layout-aware-chunk-based-parsing-token-optimized
plan: "02"
subsystem: ui
tags: [parse-timing, pipelineLog, ocr-inspector, d28, d27]

requires:
  - phase: "07-01"
    provides: Chunk text + parseChunkSingleMcqOnce without inner timers
provides:
  - Per-chunk wall timing and optional verbose pipelineLog (VISION / chunk-timing)
  - Run-level wall clock on ParseRunResult (D-28)
  - Parse summary lines, hybrid OCR note, cancel copy, OcrInspector chunk debug
affects:
  - Study set source page
  - AiParseSection embedded UX

tech-stack:
  added: []
  patterns:
    - "Session-only chunkParseDebug lifted to parent for OcrInspector"

key-files:
  created: []
  modified:
    - src/lib/ai/runLayoutChunkParse.ts
    - src/lib/ai/parseChunk.ts
    - src/components/ai/AiParseSection.tsx
    - src/components/ai/OcrInspector.tsx
    - src/app/(app)/sets/[id]/source/page.tsx

key-decisions:
  - "Parse callback accepts optional trace.layoutChunkId for raw assistant routing."
  - "Chunk debug reasons distinguish vision-only vs no chunks vs completed chunk AI."

patterns-established:
  - "pipelineLog chunk timing under VISION domain + chunk-timing stage behind isPipelineVerbose()."

requirements-completed: [AI-05, AI-03, AI-04]

duration: "~45 min"
completed: "2026-04-11"
---

# Phase 07 Plan 02: Orchestration timing + parse UI / inspector Summary

**Chunk orchestration records summed AI wall time per chunk with verbose `VISION`/`chunk-timing` logs, run-total timing and parse summary copy ship in `AiParseSection`, and `OcrInspector` shows a collapsible chunk debug table fed from the source page.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 5 (including parseChunk.ts for `onRawAssistantText`)

## Accomplishments

- `runLayoutChunkParse` wraps each `parse()` with `performance.now`, fills `chunkAiWallMs` / `parseAttempts` / `attemptWallMs`, and logs when `isPipelineVerbose()`.
- `runUnifiedParseInternal` stamps `lastParseRunWallMs` after pre-parse gates; chunk pipeline returns `usedVisionFallback` and `chunkParseDebug`.
- Embedded variant shows running progress, terminal summary, parse time, and vision footnote; hybrid OCR gate shows optional muted line.
- OcrInspector exposes **Chunk parse debug** with required columns, per-attempt details, and raw output `details`.

## Task Commits

1. **Task 1: ChunkParseResult + timing + pipelineLog** — `7b0b40e` (feat)
2. **Task 2: Run total + AiParseSection** — `0dc0d97` (feat)
3. **Task 3: OcrInspector + source page** — `2433170` (feat)

## Files Created/Modified

- `src/lib/ai/runLayoutChunkParse.ts` — Timing fields, `timedParse`, `pipelineLog`, optional `studySetId`, trace arg on `parse`.
- `src/lib/ai/parseChunk.ts` — `onRawAssistantText` optional hook for raw capture.
- `src/components/ai/AiParseSection.tsx` — `ParseRunResult` extensions, D-28 timer, UI copy, hybrid note, embedded progress/summary.
- `src/components/ai/OcrInspector.tsx` — Chunk parse debug section (typography on new lines per UI-SPEC).
- `src/app/(app)/sets/[id]/source/page.tsx` — Lifts `chunkParseDebug` / timing into inspector props.

## Deviations from Plan

None — plan executed as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: sensitive_debug | `OcrInspector.tsx` / page state | Raw model text in memory only; not written to IDB |

## Self-Check: PASSED

- `07-02-SUMMARY.md` present
- Commits `7b0b40e`, `0dc0d97`, `2433170` on `main`
