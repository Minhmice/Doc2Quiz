---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: MVP Pipeline
status: executing
last_updated: "2026-08-03T00:00:00.000Z"
last_activity: "2026-08-03 -- Completed Phase 12 Plan 06 verification after self-hosted Supabase deployment"
progress:
  total_phases: 13
  completed_phases: 9
  total_plans: 58
  completed_plans: 67
  percent: 69
---

# Doc2Quiz — State

## Project Reference

See: `.planning/PROJECT.md` · Spec: `docs/pipeline.md`

**Core value:** Import materials → canonical knowledge → quiz or flashcards → drill → score → repeat mistakes.

## Current Position

Phase: 12
Plan: 9 of 9
Status: Complete
Last activity: 2026-08-03 -- Completed Phase 12 Plan 06 verification after self-hosted Supabase deployment

Progress: [██████████] 100%

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
- [Phase 09]: Workspace migration timestamps 150000/150100 (140000 collided with quota reservations).
- [Phase 09]: Versioned sections live in `canonical_version_sections`; legacy `canonical_sections` untouched.
- [Phase 09]: Output bridge uses new study_sets row per learning_output; historic parent history stays parent-keyed.
- [Phase 09]: Native outputs use null `legacy_parent_study_set_id`; backfill always sets immutable parent.
- [Phase 09]: First ingest validates before `create_workspace_document_version`; originals land at `{workspaceId}/{documentId}/{versionId}/...`.
- [Phase 09]: Import client uses `/api/workspaces/ingest`; legacy `ingestStudySet` retained for adapters.
- [Phase 09]: Workspace canonicalize appends via `persist_canonical_version` only; never `replace_canonical_content`.
- [Phase 09]: Canonical reader returns metadata + paginated section bodies (limit 1–50); progressive UI uses IntersectionObserver.
- [Phase 09]: Multi-source quiz posts canonicalVersionIds only; `create_learning_output` freezes snapshots and returns bridgeStudySetId.
- [Phase 09]: Workspace quiz route is authoritative; study-set quiz generate is a non-destructive bridge adapter.
- [Phase 09]: Legacy adapters resolve via `legacyBridge.resolveLegacyStudySetBridge` with explicit routeKind; bridge history never falls back to parent.
- [Phase 10]: Social tables are RPC-only; friend sends use generic `request_unavailable` except explicit `rate_limited` with retry detail.
- [Phase 10]: Workspace content mutation routes use route-level `requireWorkspacePermission(edit)` before lib/pipeline side effects.
- [Phase 10]: Public share resolver is service-role RPC only; digest lookup returns locked study DTO with identical not_found failures.
- [Phase 10]: Public share page/API consume allowlisted DTO only with identical unavailable UI and generic not_found API responses.
- [Phase 10]: Anonymous quiz outbox imports via `import_anonymous_quiz_attempts` with stable clientAttemptId dedupe and ack-only local deletion.

- [Phase 10]: SocialSafetySettings in Settings uses generic social errors, confirmation dialogs, and acknowledgement-only report copy.
- [Phase 12]: Study challenge tables remain RPC-only; practice DTOs strip answer keys before reveal.
- [Phase 12]: SQL migration validation is deployment-owned by Supabase; repository runtime database proof is not used.
- [Phase 12]: Request and count topics bind to auth.uid(); message topics bind to accepted conversation participants. — Private predictable topics require recipient or participant authority.
- [Phase 12]: Realtime payloads only invalidate; every displayed social count comes from authenticated HTTP authority. — Prevents stale or forged event payloads from becoming UI truth.
- [Phase 12]: Realtime chat events only invalidate; authenticated cursor history remains display authority.
- [Phase 12]: Mobile message actions use full-screen routes; desktop actions retain floating dialogs.
- [Phase 15 exploration]: Redis owns hot per-session presence and conversation typing state; Postgres receives only batched durable activity.
- [Phase 15 exploration]: Accepted friends see presence/activity; conversation participants see typing; blocked users see none.
- [Phase 15 exploration]: Redis failure keeps last-known state briefly, then returns `unknown`; never increases Postgres write frequency and never blocks messaging.
- [Phase 15 exploration]: Existing authenticated HTTP snapshots remain display authority; realtime remains invalidation-only.

## Quick Tasks Completed

| Date | Task | Summary | Commits |
| --- | --- | --- | --- |
| 2026-08-04 | Direct-message media attachments and streak flame state | `.planning/quick/260804-1ez-full-ph-n-tin-nh-n-th-m-t-y-ch-n-t-i-nh-/260804-1ez-SUMMARY.md` | pending |
| 2026-07-30 | Remove duplicate topbar profile link and account trigger | `.planning/quick/260730-43p-remove-duplicate-topbar-profile-link-and/SUMMARY.md` | `acc8303`, `928773e` |
| 2026-07-31 | Rebuild dashboard as workspace-only dashboard | `.planning/quick/260731-0t1-rebuild-dashboard-as-workspace-only-dash/SUMMARY.md` | `d8c76b0`, `1a2d54f`, `f817082` |
| 2026-07-31 | Create clean maintainable Supabase schema mirror | `.planning/quick/260731-tui-create-clean-maintainable-supabase-schem/260731-tui-SUMMARY.md` | `b0be5bd` |
| 2026-08-02 | Study challenge handoff and social count consolidation | `.planning/quick/260802-0nr-fix-friendshubclient-studywith-modal-lau/SUMMARY.md` | `1e83c23`, `50d1708`, `02d1b8b` |
| 2026-08-02 | Increase avatar upload limit to exclusive 10 MiB | `.planning/quick/260802-2hj-increase-avatar-upload-limit-from-2-mb-t/260802-2hj-SUMMARY.md` | `fea4200` |

## Blockers

None.

## Next step

Phase 12 verification complete; continue with next requested project task.

## Accumulated Context

### Roadmap Evolution

- Phase 6 added: Bilingual EN/VI language selector and reusable contextual slang system across loading, upload, conversion, generation, feedback, results, badges, navigation, warnings, empty states, streaks, scores, and secondary actions; preserve clear primary product copy, avoid consecutive repeats, and keep existing functionality and layout unchanged.
- Phase 7 added: Normalize app information architecture around setId-based quiz and flashcard routes, unified creation flows, library filtering, set-detail navigation, and a responsive sidebar that persists, collapses, or hides by workflow context.

## Phase 1 decisions (summary)

- Delete all 6 migrations → one v2.1 baseline (schema files only; no remote reset yet)
- `study_sets` 1:1 `canonical_documents` + `canonical_sections` table
- Supabase Storage for originals; email/password auth; step-based API stubs
