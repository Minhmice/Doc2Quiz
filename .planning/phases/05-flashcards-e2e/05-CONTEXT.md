# Phase 5: Flashcards & E2E - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Source:** Pipeline express path (`docs/pipeline.md`, Phase 4 CONTEXT, REQUIREMENTS)

<domain>
## Phase Boundary

After canonical knowledge is saved, user can **choose Flashcards mode**, answer **three wizard prompts** (goal, coverage, amount), system **auto-detects card format**, **generates from canonical knowledge only**, **saves to Supabase immediately**, then **starts flashcard learning** via existing session shell. Also wire **mistakes-only quiz drill** (CORE-MIST-01) and **E2E milestone verification** (`next build`).

**In scope:** FLASH-01–07, CORE-MIST-01, MODE-01 Flashcards path (enable CTA from Phase 4), milestone E2E smoke.

**Out of scope:** Pre-save quality gate (OOS-03), flashcard review/edit UI beyond minimal delete (optional polish), sharing/publishing, BYOK AI.

</domain>

<decisions>
## Implementation Decisions

### Carrying forward
- **D-P4-01:** Mode selection on `/sets/[id]/source` — enable **Flashcards** CTA (currently disabled placeholder).
- **D-P4-09:** Server env AI (`AI_PROVIDER_URL/KEY`) — same pattern as quiz/canonicalize.
- **D-P1-08:** `approved_flashcards` table: front, back, tags, source jsonb.
- **D-P1-17:** `POST /api/study-sets/[id]/flashcards/generate` — replace 501 stub.

### Mode selection (MODE-01 — Flashcards path)
- **D-01:** Flashcards CTA sets `content_kind = 'flashcards'` and `pipeline_stage = 'mode_selected'` before wizard.
- **D-02:** Quiz path unchanged; resume strips remain mode-specific (quiz vs flashcards).

### Wizard (FLASH-01–03)
- **D-03:** **Three prompts only** per `docs/pipeline.md`:
  1. **Learning goal:** `memorize` | `understand` | `exam_preparation`
  2. **Coverage:** `entire_document` | `selected_sections` (section multi-select from `canonical_sections` when selected)
  3. **Amount:** `recommended` | custom number (bounded, e.g. 5–60)
- **D-04:** Wizard UI on source page (inline sheet/dialog) or dedicated `/sets/[id]/flashcards/setup` — planner discretion; prefer inline continuation from mode footer to minimize routes.
- **D-05:** Do **not** reuse legacy `FlashcardGenerationConfig` vision types (`quick_recall`, `focusMode`) — map pipeline vocabulary to new schemas.

### Generation (AI)
- **D-06:** **Canonical knowledge only** — same read pattern as quiz: `canonical_markdown` + filtered `canonical_sections` + metadata hints; never `raw_markdown`.
- **D-07:** **Prompt contract** — create `prompt/flashcard_generator_v1.json` (mirror quiz/canonical pattern).
- **D-08:** **FLASH-04:** LLM returns `detected_format` per batch: `term_definition` | `question_answer` | `cloze` | `mixed` — system picks dominant format for the set (or per-card `format` field if simpler).
- **D-09:** **Output schema per card:** `{ front, back, format?, concept_id?, section_key?, source_excerpt? }` — Zod validate before insert.
- **D-10:** **FLASH-06:** Bulk insert `approved_flashcards` **before** API response (replace-all on re-generate, mirror quiz).
- **D-11:** On success: `pipeline_stage = 'flashcards'`, return `{ recommendedCount, generatedCount, detectedFormat, cardIds[] }`.

### API
- **D-12:** `POST /flashcards/generate` body:
  ```json
  {
    "learningGoal": "memorize" | "understand" | "exam_preparation",
    "coverage": "entire_document" | { "sectionKeys": ["sec_001", ...] },
    "amount": "recommended" | { "count": number }
  }
  ```
- **D-13:** Requires `pipeline_stage` ≥ `canonical`.

### Client data & practice (wire existing UI)
- **D-14:** Port `getApprovedFlashcardBank` / `putApprovedFlashcardBankForStudySet` in `studySetDb.ts` (currently stubs returning empty).
- **D-15:** **`FlashcardSession`** at `/flashcards/[id]` — load real bank; keyboard flip (Space), prev/next arrows.
- **D-16:** **`/flashcards/[id]/done`** — session summary (card count reviewed); optional polish only.
- **D-17:** **Dashboard** — **Start flashcards** CTA when `content_kind=flashcards` and cards exist.

### Mistakes drill (CORE-MIST-01)
- **D-18:** `QuizSession` already supports `?review=mistakes` + `getMistakeQuestionIds` — verify `recordQuizCompletion` populates `study_wrong_history` and dashboard **Drill mistakes** link works end-to-end.
- **D-19:** Dashboard card shows mistakes indicator when `hasMistakesForStudySet` true; CTA routes to `/quiz/{id}?review=mistakes`.

### E2E milestone
- **D-20:** Phase includes verification plan: ingest → canonical → quiz path smoke + flashcard path smoke + `npm run build` + vitest suite green.
- **D-21:** Human checkpoint at end for full express paths (both modes).

### Claude's Discretion
- Wizard as dialog vs stepped inline panel
- Whether flashcard review/edit page (`/edit/flashcards/[id]`) is in scope or defer to post-MVP
- Exact flashcard_generator_v1.json wording

</decisions>

<canonical_refs>
- `docs/pipeline.md` — Flashcard Options section
- `.planning/REQUIREMENTS.md` — FLASH-01–07, CORE-MIST-01
- `prompt/quiz_generator_v1.json` — pattern for flashcard prompt JSON
- `src/app/api/study-sets/[id]/flashcards/generate/route.ts` — 501 stub
- `src/components/flashcards/FlashcardSession.tsx`
- `src/components/flashcards/review/FlashcardReviewWorkspace.tsx`
- `src/components/quiz/QuizSession.tsx` — mistakes drill (`review=mistakes`)
- `src/lib/client/activityTracking.ts` — `getMistakeQuestionIds`, `study_wrong_history`
- `src/lib/client/studySetDb.ts` — flashcard bank stubs
- `src/components/canonical/CanonicalModeSelectionFooter.tsx` — enable Flashcards
- `supabase/migrations/20260725120000_v21_baseline.sql` — approved_flashcards

</canonical_refs>

<deferred>
- Flashcard edit/review workspace beyond minimal (if not needed for FLASH-07)
- Post-MVP: spaced repetition, card editing UI polish

</deferred>

---

*Phase: 5-Flashcards & E2E*
