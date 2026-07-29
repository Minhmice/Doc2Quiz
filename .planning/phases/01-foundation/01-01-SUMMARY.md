---
phase: 01-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, migration, canonical-schema]
requires: []
provides:
  - v2.1 single-file Postgres baseline
  - canonical_documents and canonical_sections tables
  - doc2quiz storage bucket with RLS
affects: [02-ingest, 03-canonical, 04-quiz, 05-flashcards]
tech-stack:
  added: []
  patterns: [composite FK user scoping, pipeline_stage on study_sets]
key-files:
  created: [supabase/migrations/20260725120000_v21_baseline.sql]
  modified: [README.md]
key-decisions:
  - "Schema ships files-only; remote apply deferred to user (D-02)"
  - "All six legacy migrations deleted without archive (D-01/D-03)"
patterns-established:
  - "1:1 study_sets ↔ canonical_documents with composite FK pattern"
requirements-completed: [CANON-09]
duration: 15min
completed: 2026-07-25
---

# Phase 1 Plan 01: v2.1 Baseline Migration Summary

**Single v2.1 Postgres baseline replaces six legacy migrations with canonical knowledge + practice tables.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Deleted all six legacy migration files (no archive)
- Created `20260725120000_v21_baseline.sql` with study_sets, canonical_documents, canonical_sections, practice tables, and doc2quiz storage RLS
- Added README manual schema apply instructions (no remote `supabase db push`)

## Task Commits

1. **Task 1–3: Purge, baseline, verification** - `97bf378` (feat)

## Files Created/Modified

- `supabase/migrations/20260725120000_v21_baseline.sql` - Full v2.1 schema baseline
- `README.md` - Manual schema apply section (D-02)

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None in this plan.

## Verification

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `supabase/migrations/` contains exactly one file

## Self-Check: PASSED
