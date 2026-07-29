# Phase 4: Quiz Pipeline - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** Pipeline express path (`docs/pipeline.md`, Phase 3 CONTEXT, REQUIREMENTS)

<domain>
## Phase Boundary

After canonical knowledge is saved (`pipeline_stage = canonical`), user **chooses Quiz mode**, system **generates MCQs from canonical knowledge only**, **saves to Supabase before review**, user **edits/deletes** in review UI, then **starts keyboard-first practice** from dashboard. Wire existing quiz shell (`ReviewSection`, `QuizSession`, dashboard) to real Supabase + `POST /api/study-sets/[id]/quiz/generate`.

**In scope:** MODE-01 (Quiz path only — Flashcards CTA routes to Phase 5 stub), QUIZ-01–07, CORE-DASH-01/02, CORE-PRAC-01/02.

**Out of scope:** Flashcard generation (Phase 5), CORE-MIST-01 mistakes drill (Phase 5), pre-save quality gate (OOS-03).

</domain>

<decisions>
## Implementation Decisions

### Carrying forward
- **D-P3:** Canonical preview at `/sets/[id]/source`; `pipeline_stage = canonical` before quiz path.
- **D-P1-17:** Quiz route is `POST /api/study-sets/[id]/quiz/generate` — replace 501 stub.
- **D-P1-08:** `approved_questions` table: prompt, choices[4], correct_index 0–3, explanation, tags, source jsonb.

### Mode selection (MODE-01)
- **D-01:** On canonical preview page, enable **Quiz** and **Flashcards** CTAs. Quiz → quiz generation flow; Flashcards → placeholder/disabled or route to Phase 5 message.
- **D-02:** Selecting Quiz sets `study_sets.content_kind = 'quiz'` and `pipeline_stage = 'mode_selected'` before generation.

### Quiz generation (AI)
- **D-03:** **Canonical knowledge only** — generator reads `canonical_markdown` + `canonical_sections` (+ `metadata.extracted_questions` as hints); never raw_markdown or original file.
- **D-04:** **Prompt contract** — create `prompt/quiz_generator_v1.json` (mirror `canonical_builder_v1.json` pattern): system, tasks, constraints, output_schema for concepts + MCQs.
- **D-05:** **Two-step or single-step LLM:** (1) detect testable concepts + recommend count (QUIZ-01/02), (2) generate MCQs — planner may combine in one structured JSON response if simpler.
- **D-06:** **Output schema per question:** `{ prompt, choices: [4 strings], correct_index: 0-3, explanation?, concept_id?, section_key?, source_excerpt? }` — Zod validate before insert.
- **D-07:** **QUIZ-04:** Deduplicate concepts in post-processing; cap count when content thin; return `recommendedCount` + `generatedCount` in API response.
- **D-08:** **QUIZ-05:** Insert all questions to `approved_questions` **before** returning to client (immediate save, no draft).
- **D-09:** Server env AI (`AI_PROVIDER_URL/KEY`) — same as Phase 3 canonicalize.

### API
- **D-10:** `POST /quiz/generate` — optional body `{ questionCount?: number }` (user override of recommendation); requires `pipeline_stage` ≥ `canonical`.
- **D-11:** CRUD for questions via existing client `studySetDb` or new API routes — prefer extending `studySetDb` + Supabase RLS (matches Phase 1 pattern).
- **D-12:** On success: `pipeline_stage = 'quiz'`, return `{ recommendedCount, generatedCount, questionIds[] }`.

### Review & practice (wire existing UI)
- **D-13:** **`/edit/quiz/[id]`** — `ReviewSection` loads `approved_questions` from Supabase; edit/delete persists via `studySetDb`.
- **D-14:** **`/quiz/[id]`** — `QuizSession` loads approved bank; keyboard 1/2/3/4 (CORE-PRAC-01).
- **D-15:** **`/quiz/[id]/done`** — score summary from session (CORE-PRAC-02); persist `quiz_sessions` row.
- **D-16:** **Dashboard** — `DashboardLibraryClient` shows study sets with quiz CTA when `content_kind=quiz` and questions exist (CORE-DASH-01/02).

### Claude's Discretion
- Exact quiz_generator_v1.json wording
- Single vs two LLM calls for concepts + MCQs
- Whether generation UI is modal on source page vs dedicated `/edit/quiz/[id]/generate` step

</decisions>

<canonical_refs>
- `docs/pipeline.md` — Quiz Rules section
- `.planning/REQUIREMENTS.md` — MODE-01, QUIZ-01–07, CORE-DASH-*, CORE-PRAC-*
- `prompt/canonical_builder_v1.json` — pattern for quiz prompt JSON
- `src/app/api/study-sets/[id]/quiz/generate/route.ts` — stub
- `src/components/review/ReviewSection.tsx`, `QuestionEditor.tsx`
- `src/components/quiz/QuizSession.tsx`
- `src/components/dashboard/DashboardLibraryClient.tsx`
- `supabase/migrations/20260725120000_v21_baseline.sql` — approved_questions, quiz_sessions

</canonical_refs>

<deferred>
- FLASH path (Phase 5), CORE-MIST-01 mistakes drill (Phase 5)

</deferred>

---

*Phase: 4-Quiz Pipeline*
