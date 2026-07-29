---
phase: 02-input-markitdown
plan: 01
subsystem: api
tags: [markitdown, python, validation, subprocess, vitest]

requires:
  - phase: 01-foundation
    provides: ingest stub, validation constants, canonical_documents schema
provides:
  - INPUT-VAL-01 enforcement helpers
  - MarkItDown subprocess runner with tests
  - requirements.txt pinned to markitdown[all]==0.1.6
affects: [02-02, ingest route, unified input UI]

tech-stack:
  added: [markitdown[all]==0.1.6 Python]
  patterns: [python subprocess conversion, validate-before-side-effects]

key-files:
  created: [requirements.txt, src/lib/pipeline/markitdown.ts, src/lib/pipeline/markitdown.test.ts]
  modified: [src/lib/pipeline/validation.ts, src/lib/pipeline/validation.test.ts, README.md]

key-decisions:
  - "MIN_PASTE_CHARS=20 for paste validation aligned to UI-SPEC"
  - "YouTube URLs restricted to HTTPS + host allowlist before MarkItDown"
  - "MARKITDOWN_PYTHON env override for non-default Python binary"

patterns-established:
  - "Pattern: validation.ts returns string|null errors for client and server reuse"
  - "Pattern: markitdown.ts spawns python -m markitdown with temp file cleanup"

requirements-completed: [INPUT-VAL-01, CONV-01]

duration: 12min
completed: 2026-07-25
---

# Phase 2 Plan 01: MarkItDown Engine Summary

**INPUT-VAL-01 enforcement helpers and MarkItDown 0.1.6 subprocess module with mocked Vitest coverage**

## Performance

- **Duration:** 12 min
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Verified Phase 1 ingest stub, validation contract, and baseline migration on disk
- Added `validateFileUpload`, `validatePasteInput`, `validateYoutubeUrl`, `validateStoragePath`
- Implemented `convertWithMarkItDown`, `convertPasteWithMarkItDown`, `convertUrlWithMarkItDown`
- Pinned `markitdown[all]==0.1.6` and documented Python setup in README

## Task Commits

1. **Task 2: INPUT-VAL-01 enforcement** - `deda379` (feat)
2. **Task 3: MarkItDown module** - `9b513b8` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: requirements.txt
- FOUND: src/lib/pipeline/markitdown.ts
- FOUND: deda379
- FOUND: 9b513b8

---
*Phase: 02-input-markitdown*
*Completed: 2026-07-25*
