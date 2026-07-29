---
phase: 02-input-markitdown
plan: 02
subsystem: api
tags: [ingest, markitdown, supabase, zod, nextjs]

requires:
  - phase: 02-input-markitdown
    provides: validation helpers and markitdown subprocess module
provides:
  - POST /api/study-sets/[id]/ingest dual-mode handler
  - runIngest orchestration (validate → store → convert → persist)
  - Zod ingest JSON schemas
affects: [02-03, unified input UI]

tech-stack:
  added: []
  patterns: [dual Content-Type ingest route, canonical_documents upsert on first ingest]

key-files:
  created: [src/lib/pipeline/ingest.ts, src/lib/pipeline/ingestSchemas.ts, src/lib/pipeline/ingest.test.ts, src/app/api/study-sets/[id]/ingest/route.test.ts]
  modified: [src/app/api/study-sets/[id]/ingest/route.ts]

key-decisions:
  - "canonical_documents upserted on first ingest only, not at study set creation"
  - "Conversion failure sets metadata.conversion_status failed without advancing pipeline_stage"
  - "Success response returns rawMarkdownLength only, not full markdown body"

patterns-established:
  - "Pattern: IngestValidationError → 400, IngestConversionError → 422"
  - "Pattern: file_ref storage path must match userId/studySetId/ prefix"

requirements-completed: [INPUT-01, INPUT-02, INPUT-03, INPUT-04, INPUT-05, INPUT-06, INPUT-07, INPUT-08, INPUT-09, INPUT-10, INPUT-11, INPUT-12, INPUT-VAL-01, CONV-01, CONV-02]

duration: 18min
completed: 2026-07-25
---

# Phase 2 Plan 02: Ingest API Summary

**Full POST /api/study-sets/[id]/ingest pipeline with dual JSON/multipart support and MarkItDown persistence**

## Performance

- **Duration:** 18 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `runIngest` orchestrates validate → store → convert → persist for paste, YouTube, file_ref, and multipart file
- Replaced 501 ingest stub with production handler (`runtime=nodejs`, `maxDuration=120`)
- 45 unit tests across pipeline + route status mapping

## Task Commits

1. **Tasks 1–3: ingest orchestration + route** - `8fd88b3` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/lib/pipeline/ingest.ts
- FOUND: src/app/api/study-sets/[id]/ingest/route.ts
- FOUND: 8fd88b3

---
*Phase: 02-input-markitdown*
*Completed: 2026-07-25*
