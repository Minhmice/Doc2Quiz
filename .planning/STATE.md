---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: MVP Pipeline
status: executing
last_updated: "2026-07-29T22:54:00.479Z"
last_activity: 2026-07-29
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 60
  completed_plans: 40
  percent: 60
---

# Doc2Quiz — State

## Project Reference

See: `.planning/PROJECT.md` · Spec: `docs/pipeline.md`

**Core value:** Import materials → canonical knowledge → quiz or flashcards → drill → score → repeat mistakes.

## Current Position

Phase: 09 (workspace-centered-learning-canonical-provenance) — EXECUTING
Plan: 3 of 9
Status: Ready to execute
Last activity: 2026-07-29

Progress: [███████░░░] 67%

## Decisions

- **MarkItDown** for all format conversion (replaces v1 parsers)
- **Canonical Knowledge** stored in Supabase (sections, metadata, raw + canonical markdown)
- **Immediate save** for generated quiz/flashcards — no draft stage
- **Frontend shell** retained from v2.0 strip; backend rebuilt per pipeline
- **section_key** dedicated column for stable LLM section IDs (sec_001)
- **Prompt contract** loaded at runtime from `prompt/canonical_builder_v1.json` — no duplicated prompt text in TS
- **runCanonicalize** validates LLM output before any section delete; failure updates metadata only
- **GET /canonical** returns camelCase preview payload for UI consumption
- **Canonical preview UI** at `/sets/[id]/source` with auto-canonicalize on raw stage
- **d2q-prose** scoped markdown typography without @tailwindcss/typography
- **quiz_generator_v1.json** single-call schema with recommended_count, concepts[], questions[], warnings[]
- **quizPrompt.ts** mirrors canonicalPrompt pattern with substituteQuizInput naming
- **Client studySetDb** approved bank CRUD via Supabase with orphan delete (QUIZ-06 data layer)
- **activityTracking** persists quiz_sessions + study_wrong_history; getLatestQuizSession for done page
- **runFlashcardGenerate** mirrors quizGenerate with canonical-only input, replace-all approved_flashcards persist
- **Cross-mode cleanup** deletes approved_questions when generating flashcards
- **Inline flashcard wizard** on canonical preview with `contentKindIntent` isolating quiz vs flashcard UI
- **Post-generate flashcard redirect** goes to `/flashcards/[id]` — skips edit workspace (FLASH-07)
- [Phase 06]: English remains canonical catalog shape and SSR/storage fallback.
- [Phase 06]: English remains canonical catalog shape and SSR/storage fallback.
- [Phase 06]: Slang history stays session-only and is isolated by locale plus context.
- [Phase 06]: Plan 06-06 used user-authorized no-commit safety mode to preserve overlapping dirty dashboard work.
- [Phase 06]: Deleted dashboard stats components remain deleted; localization follows the live dashboard structure.
- [Phase 08]: Generation quota reservations serialize per user in Postgres; active reservations expire after seven minutes and refund bonus credits exactly once.
- [Phase 08]: Server quota modules call typed reservation RPC adapters; direct quota-table mutation is retired pending route lifecycle wiring in Plan 08-06.

## Quick Tasks Completed

| Date | Task | Summary | Commits |
| --- | --- | --- | --- |
| 2026-07-30 | Remove duplicate topbar profile link and account trigger | `.planning/quick/260730-43p-remove-duplicate-topbar-profile-link-and/SUMMARY.md` | `acc8303`, `928773e` |

## Next step

Execute Phase 6 Plan 06-07 coverage audit and manual verification gate.

## Accumulated Context

### Roadmap Evolution

- Phase 6 added: Bilingual EN/VI language selector and reusable contextual slang system across loading, upload, conversion, generation, feedback, results, badges, navigation, warnings, empty states, streaks, scores, and secondary actions; preserve clear primary product copy, avoid consecutive repeats, and keep existing functionality and layout unchanged.
- Phase 7 added: Normalize app information architecture around setId-based quiz and flashcard routes, unified creation flows, library filtering, set-detail navigation, and a responsive sidebar that persists, collapses, or hides by workflow context.

## Phase 1 decisions (summary)

- Delete all 6 migrations → one v2.1 baseline (schema files only; no remote reset yet)
- `study_sets` 1:1 `canonical_documents` + `canonical_sections` table
- Supabase Storage for originals; email/password auth; step-based API stubs
