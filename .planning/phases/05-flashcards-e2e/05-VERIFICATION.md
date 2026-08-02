---
phase: 05-flashcards-e2e
verified: 2026-07-25T07:15:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Flashcards express path — canonical preview → Flashcards CTA → 3-step wizard → generate → /flashcard/[id]/play practice → /flashcard/[id]/results"
    expected: "Wizard collects goal/coverage/amount; progress shows recommendedCount, generatedCount, detectedFormat; session loads cards; Space flips; Done routes to `/flashcard/[id]/results`"
    why_human: "Requires signed-in browser session, live Supabase data, and configured AI provider for generation"
  - test: "Quiz regression on quiz set — canonical → Quiz → edit → practice → done"
    expected: "Phase 4 quiz path unchanged after flashcard work"
    why_human: "Cross-mode regression cannot be confirmed by static analysis alone"
  - test: "Mistakes drill E2E — complete quiz with wrong answers; dashboard Drill mistakes; quiz done CTA; ?review=mistakes filters questions"
    expected: "Drill mistakes visible only on quiz sets with mistakes; session shows only wrong questions; perfect score clears mistakes"
    why_human: "Requires interactive quiz completion and Supabase study_wrong_history writes"
  - test: "Cross-mode isolation — flashcard set and quiz set coexist on same account"
    expected: "No wrong CTAs or mistaken counts across content_kind quiz vs flashcards"
    why_human: "Dashboard card visibility rules need live multi-set account state"
---

# Phase 5: Flashcards & E2E Verification Report

**Phase Goal:** User completes flashcard path and full practice loop is verified  
**Verified:** 2026-07-25T07:15:00Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User answers goal, coverage, and amount prompts; system picks card format | ✓ VERIFIED | `FlashcardSetupWizard.tsx` implements 3 steps (memorize/understand/exam_preparation, entire_document/selected_sections, recommended/custom 5–60). `dedupeAndCapFlashcards.ts` + `resolveDominantFormat` aggregate `detectedFormat`. `FlashcardGenerateProgressCard` displays counts and format label. |
| 2 | Flashcards generate from canonical knowledge and save immediately | ✓ VERIFIED | `flashcardGenerate.ts` reads `canonical_documents.canonical_markdown` + `canonical_sections` only (test asserts no `raw_markdown`). DELETE+INSERT on `approved_flashcards` before stage update (test confirms insert precedes study_sets update). POST route returns `recommendedCount`, `generatedCount`, `detectedFormat`, `cardIds`. |
| 3 | User can start flashcard learning session | ✓ VERIFIED | `FlashcardSetupWizard` submits `postFlashcardGenerate` from `/flashcard/[setId]/review`; `FlashcardSession` loads `getApprovedFlashcardBank`; Space flips cards and Done routes through `flashcardResults(id)`. |
| 4 | Mistakes drill works for quiz sessions | ✓ VERIFIED | `recordQuizCompletion` upserts/deletes `study_wrong_history`. `QuizSession` filters via `getMistakeQuestionIds` when `reviewMistakesOnly`. Quiz results page exposes `quizDrillMistakes(setId)` when `hasMistakesForStudySet`. `activityTracking.test.ts` covers write path. |
| 5 | `next build` passes | ✓ VERIFIED | `npm run build` exit 0 (Next.js 16.2.11 production build succeeded). |

**Score:** 5/5 truths verified (automated); full practice loop pending human E2E (D-21)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prompt/flashcard_generator_v1.json` | Locked flashcard generation contract | ✓ VERIFIED | Exists with system, tasks, constraints, output_schema |
| `src/lib/pipeline/flashcardPrompt.ts` | Runtime prompt loader | ✓ VERIFIED | `readFile` loads `flashcard_generator_v1.json`; exports `loadFlashcardPrompt`, `buildFlashcardGeneratorMessages` |
| `src/lib/pipeline/flashcardSchemas.ts` | Zod body + output schemas | ✓ VERIFIED | `flashcardGenerateBodySchema` (5–60 custom), `flashcardGeneratorOutputSchema` with `detected_format` |
| `src/lib/pipeline/flashcardGenerate.ts` | Server orchestration | ✓ VERIFIED | 386 lines; canonical preflight, LLM+repair, persist-before-response |
| `src/lib/pipeline/dedupeAndCapFlashcards.ts` | FLASH-04 post-processing | ✓ VERIFIED | Dedupe, cap 60, `resolveDominantFormat` |
| `src/app/api/study-sets/[id]/flashcards/generate/route.ts` | POST endpoint (not 501) | ✓ VERIFIED | Full handler; 9 route tests pass |
| `src/lib/client/studySetDb.ts` | Flashcard bank CRUD | ✓ VERIFIED | `getApprovedFlashcardBank` queries `approved_flashcards`; `putApprovedFlashcardBankForStudySet` upsert+orphan delete |
| `src/lib/client/flashcardGenerateStudySet.ts` | Client POST helper | ✓ VERIFIED | `postFlashcardGenerate` POSTs wizard body |
| `src/components/flashcards/FlashcardSetupWizard.tsx` | 3-step inline wizard | ✓ VERIFIED | 412 lines; goal/coverage/amount steps |
| `src/components/flashcards/FlashcardGenerateProgressCard.tsx` | Generation progress UI | ✓ VERIFIED | Shows recommended/generated counts + detected format |
| `src/components/canonical/CanonicalModeSelectionFooter.tsx` | Enabled Flashcards CTA | ✓ VERIFIED | `onSelectFlashcards` wired; flashcards resume strip |
| `src/app/(app)/flashcard/[setId]/review/page.tsx` | Flashcard review and generation flow | ✓ VERIFIED | Canonical preview, wizard, generate, and review-bank reload |
| `src/components/flashcards/FlashcardSession.tsx` | Practice session | ✓ VERIFIED | Loads bank; keyboard Space flip; Done routing |
| `src/components/dashboard/DashboardHomeClient.tsx` | Dashboard workspace CTAs | ✓ VERIFIED | Contextual action links expose practice and generation paths |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `flashcard/[setId]/review/page.tsx` | `/api/study-sets/[id]/flashcards/generate` | `postFlashcardGenerate` | ✓ WIRED | Review page submits wizard body and reloads generated bank |
| `FlashcardSession.tsx` | `studySetDb.ts` | `getApprovedFlashcardBank` on mount | ✓ WIRED | `reload()` calls bank fetch in `useEffect` |
| `Quiz results page` | `/quiz/{id}/drill-mistake` | `hasMistakesForStudySet` + `quizDrillMistakes(setId)` | ✓ WIRED | Results page exposes drill action when persisted wrong-question history exists |
| `flashcardGenerate.ts` | `approved_flashcards` | DELETE then INSERT before return | ✓ WIRED | Lines 335–363; test asserts ordering |
| `flashcardPrompt.ts` | `flashcard_generator_v1.json` | `readFile` at runtime | ✓ WIRED | Path resolves to `prompt/flashcard_generator_v1.json` |
| `quiz/[id]/page.tsx` | `QuizSession` | `reviewMistakesOnly` from searchParams | ✓ WIRED | `searchParams.get("review") === "mistakes"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `FlashcardSession.tsx` | `cards` | `getApprovedFlashcardBank(studySetId)` → Supabase `approved_flashcards` | Yes (not stub; queries with user_id filter) | ✓ FLOWING |
| `FlashcardGenerateProgressCard` | `recommendedCount`, `generatedCount`, `detectedFormat` | `postFlashcardGenerate` API response on source page | Yes (props from `flashcardGenerateUi` state) | ✓ FLOWING |
| `Quiz results` | `mistakes` | `hasMistakesForStudySet` → `quizDrillMistakes(setId)` | Yes (Supabase `study_wrong_history`) | ✓ FLOWING |
| `QuizSession` (mistakes mode) | `playable` | `getApprovedBank` filtered by `getMistakeQuestionIds` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest suite (176 tests incl. flashcard pipeline) | `npm test run` | 24 files, 176 passed, exit 0 | ✓ PASS |
| Next.js production build | `npm run build` | Compiled successfully, exit 0 | ✓ PASS |
| Flashcard generate module exports | `runFlashcardGenerate` in `flashcardGenerate.ts` | Named export present, 7 unit tests pass | ✓ PASS |
| POST route not 501 stub | `route.ts` inspection | Returns JSON with D-11 fields via `runFlashcardGenerate` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared in phase plans; not a migration/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MODE-01 | 05-04 | Flashcards path after canonical save | ✓ SATISFIED | Flashcards CTA enabled; `content_kind=flashcards` on select |
| FLASH-01 | 05-01, 05-04 | Learning goal selection | ✓ SATISFIED | Wizard step 1 + Zod enum |
| FLASH-02 | 05-01, 05-02, 05-04 | Coverage selection | ✓ SATISFIED | Wizard step 2 + `filterSectionsByCoverage` |
| FLASH-03 | 05-01, 05-02, 05-04 | Amount selection | ✓ SATISFIED | Wizard step 3 + Zod `min(5).max(60)` |
| FLASH-04 | 05-01, 05-02, 05-04 | Auto-detect card format | ✓ SATISFIED | `resolveDominantFormat` + progress card display |
| FLASH-05 | 05-02 | Canonical-only generation | ✓ SATISFIED | `canonical_markdown` + sections only |
| FLASH-06 | 05-02, 05-03 | Immediate Supabase save | ✓ SATISFIED | Insert before response; client CRUD reads back |
| FLASH-07 | 05-03, 05-04 | Start practice from saved cards | ✓ SATISFIED | Session page + dashboard CTA wired |
| CORE-MIST-01 | 05-04 | Mistakes-only drill | ✓ SATISFIED | Code wired; human E2E pending |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX in phase flashcard pipeline files | — | None |
| `FlashcardSetupWizard.tsx` | 376 | `placeholder="e.g. 20"` | ℹ️ Info | Input placeholder only — not a stub |

### Human Verification Required

Automated verification passes. Phase goal includes **full practice loop verified** (D-21) and 05-04 Task 4 human checkpoint remains **pending** per `05-04-SUMMARY.md`.

### 1. Flashcards Express Path (FLASH-01–07)

**Test:** Sign in; open study set with `pipeline_stage ≥ canonical`. Visit `/sets/{id}/source` → Flashcards → complete 3-step wizard → generate → practice → done.  
**Expected:** Progress shows counts/format; cards load at `/flashcard/{id}/play`; Space flips; Done → `/flashcard/{id}/results`; source review flow remains available at `/flashcard/{id}/review`.  
**Why human:** Requires live auth, Supabase, and AI configuration.

### 2. Quiz Regression (Phase 4)

**Test:** On a quiz set, run canonical → Quiz → edit → practice → done.  
**Expected:** Quiz path unchanged.  
**Why human:** Cross-mode regression needs interactive session.

### 3. Mistakes Drill (CORE-MIST-01)

**Test:** Complete quiz with ≥1 wrong answer. Check dashboard "Drill mistakes", quiz done CTA, and `?review=mistakes` session filter. Repeat with perfect score.  
**Expected:** Mistakes links visible only when wrong answers exist; drill session shows only wrong questions; perfect score clears history.  
**Why human:** Requires quiz completion and Supabase `study_wrong_history` writes.

### 4. Cross-Mode Isolation (D-21)

**Test:** Same account with both flashcard and quiz ready sets.  
**Expected:** Correct CTAs per `content_kind`; no mistaken drill links on flashcard sets.  
**Why human:** Multi-set dashboard state not reproducible via grep.

### Gaps Summary

No automated gaps found. All roadmap success criteria have substantive, wired implementations in the codebase. Phase status is **human_needed** because the phase goal explicitly requires verified end-to-end practice loops (D-21) and the 05-04 blocking human checkpoint has not been approved.

---

_Verified: 2026-07-25T07:15:00Z_  
_Verifier: Claude (gsd-verifier)_
