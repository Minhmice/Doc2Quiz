---
phase: 04-quiz-pipeline
plan: 04
subsystem: ui
tags: [quiz, react, nextjs, supabase, sonner]

requires:
  - phase: 04-quiz-pipeline
    provides: POST /quiz/generate API (04-02), studySetDb approved bank CRUD (04-03)
provides:
  - Canonical preview mode selection + inline quiz generation UX
  - Review finish → practice routing
  - Done page session score from quiz_sessions
  - Dashboard Start quiz CTA for ready quiz sets
affects: [phase-5-flashcards, e2e-verification]

tech-stack:
  added: []
  patterns:
    - "Client postQuizGenerate mirrors canonicalizeStudySet fetch/error pattern"
    - "Source page generateUi state machine with generatingRef double-POST guard"
    - "Link + buttonVariants for shadcn base-nova buttons (no asChild)"

key-files:
  created:
    - src/lib/client/quizGenerateStudySet.ts
    - src/lib/client/quizGenerateStudySet.test.ts
    - src/components/canonical/CanonicalModeSelectionFooter.tsx
    - src/components/quiz/QuizGenerateProgressCard.tsx
  modified:
    - src/app/(app)/sets/[id]/source/page.tsx
    - src/components/review/ReviewSection.tsx
    - src/components/review/QuestionReviewNavigator.tsx
    - src/app/(app)/quiz/[id]/done/page.tsx
    - src/lib/ui/studySetActionLabels.ts
    - src/components/dashboard/DashboardLibraryClient.tsx
    - src/components/dashboard/DashboardStudySetCard.tsx

key-decisions:
  - "Review handleDone routes to /quiz/{id} not /dashboard (plan-checker fix)"
  - "Removed redundant pipelineStage bump on review save — generation sets quiz stage"
  - "Resume strip loads getApprovedBank on mount when pipeline_stage=quiz"

patterns-established:
  - "Inline generation on canonical preview replaces CanonicalNextStepPlaceholder"
  - "Dashboard Continue setup overflow routes canonical/mode_selected sets to /sets/{id}/source"

requirements-completed: [MODE-01, QUIZ-06, QUIZ-07, CORE-DASH-01, CORE-DASH-02, CORE-PRAC-01, CORE-PRAC-02]

duration: 45min
completed: 2026-07-25
---

# Phase 4 Plan 4: Quiz Pipeline UI Wiring Summary

**End-to-end quiz UX wired from canonical preview through generation, review edit, practice, done score, and dashboard re-entry.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-25T06:48:00Z
- **Completed:** 2026-07-25T07:33:00Z
- **Tasks:** 3 auto tasks completed; 1 human checkpoint pending
- **Files modified:** 11

## Accomplishments

- Canonical preview `/sets/[id]/source` now supports Quiz mode selection, inline generation progress, and resume strip when questions exist
- Review page finish CTA is **Start quiz** → `/quiz/{id}`; delete shows toast; empty state links back to canonical preview
- Done page displays latest `quiz_sessions` score; dashboard ready cards show **Start quiz**

## Task Commits

1. **Task 1: Client helper + generation/mode components** - `d95b9d5` (feat)
2. **Task 2: Source page state machine + review finish CTAs** - `5232660` (feat)
3. **Task 3: Done page score + dashboard CTAs** - `18e9092` (feat)

## Files Created/Modified

- `src/lib/client/quizGenerateStudySet.ts` - POST `/api/study-sets/{id}/quiz/generate` client helper
- `src/lib/client/quizGenerateStudySet.test.ts` - Vitest smoke tests (success, API error, network)
- `src/components/canonical/CanonicalModeSelectionFooter.tsx` - Learning mode + resume strip
- `src/components/quiz/QuizGenerateProgressCard.tsx` - Generation progress with counts and retry
- `src/app/(app)/sets/[id]/source/page.tsx` - Mode selection → generate → redirect state machine
- `src/components/review/ReviewSection.tsx` - Start quiz routing, empty state, delete toast
- `src/components/review/QuestionReviewNavigator.tsx` - Start quiz + Back to library
- `src/app/(app)/quiz/[id]/done/page.tsx` - Score line from `getLatestQuizSession`
- `src/lib/ui/studySetActionLabels.ts` - **Start quiz** label for ready quiz cards
- `src/components/dashboard/DashboardLibraryClient.tsx` - Stage-aware `cardVariantFor`
- `src/components/dashboard/DashboardStudySetCard.tsx` - Continue setup overflow link

## Verification

- `npx vitest run src/lib/client/quizGenerateStudySet.test.ts` — 3/3 passed
- `npm run typecheck` — passed
- `npm run build` — passed

## Deviations from Plan

None — plan executed as written, including plan-checker fixes (handleDone → `/quiz/{id}`, getApprovedBank resume strip, Start quiz button).

## Human Checkpoint (Pending)

**Status:** Pending human verification (not blocking executor completion)

**What was built:** End-to-end quiz pipeline UX: canonical preview → Quiz mode → generation → review edit → practice → done score → dashboard re-entry

**How to verify:**

1. Sign in; open a study set with `pipeline_stage=canonical` (Phase 3 complete).
2. Visit `/sets/{id}/source` — confirm Learning mode footer with Quiz + disabled Flashcards.
3. Click Quiz — confirm generation progress card with recommended/generated counts.
4. On success, land on `/edit/quiz/{id}` — questions visible; edit one field — refresh — edit persists.
5. Click **Start quiz** — `/quiz/{id}` loads; press 1–4 to answer; complete session.
6. Done page shows score line (e.g. `3 / 5 correct (60%)`).
7. Dashboard card shows **Start quiz** CTA for the set.

**Resume signal:** Type `approved` or describe issues.

## Self-Check: PASSED

- FOUND: src/lib/client/quizGenerateStudySet.ts
- FOUND: src/components/canonical/CanonicalModeSelectionFooter.tsx
- FOUND: src/components/quiz/QuizGenerateProgressCard.tsx
- FOUND: .planning/phases/04-quiz-pipeline/04-04-SUMMARY.md
- FOUND: d95b9d5
- FOUND: 5232660
- FOUND: 18e9092
