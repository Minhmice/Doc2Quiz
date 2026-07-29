# Phase 4: Quiz Pipeline — Requirement Coverage Matrix

**Generated:** 2026-07-25  
**Phase:** 04-quiz-pipeline  
**Plans:** 4 (04-01 through 04-04)

---

## Multi-Source Coverage Audit

| Source | Item | Plan | Status |
|--------|------|------|--------|
| **GOAL** (ROADMAP) | User generates MCQs from canonical knowledge, reviews, starts practice | 04-02, 04-04 | COVERED |
| **GOAL** | User selects Quiz mode after canonical save | 04-04 | COVERED |
| **GOAL** | Questions save before review; edit/delete | 04-02, 04-03, 04-04 | COVERED |
| **GOAL** | Keyboard-first quiz from dashboard | 04-03, 04-04 | COVERED |
| **REQ** MODE-01 | Choose Quiz or Flashcards after canonical | 04-04 | COVERED |
| **REQ** QUIZ-01 | Detect testable concepts (canonical only) | 04-01, 04-02 | COVERED |
| **REQ** QUIZ-02 | Recommend question count | 04-01, 04-02 | COVERED |
| **REQ** QUIZ-03 | MCQ 4 options, 1 correct | 04-01, 04-02 | COVERED |
| **REQ** QUIZ-04 | Dedupe concepts; fewer when thin | 04-02 | COVERED |
| **REQ** QUIZ-05 | Immediate Supabase save | 04-02 | COVERED |
| **REQ** QUIZ-06 | Review, edit, delete | 04-03, 04-04 | COVERED |
| **REQ** QUIZ-07 | Start practice from saved questions | 04-04 | COVERED |
| **REQ** CORE-DASH-01 | Dashboard listing study sets | 04-04 | COVERED (existing + wire) |
| **REQ** CORE-DASH-02 | Open set to practice or continue | 04-04 | COVERED |
| **REQ** CORE-PRAC-01 | Keyboard 1/2/3/4 | 04-04 | COVERED (existing QuizSession) |
| **REQ** CORE-PRAC-02 | End-of-session score summary | 04-03, 04-04 | COVERED |
| **CONTEXT** D-01 | Quiz + Flashcards CTAs | 04-04 | COVERED |
| **CONTEXT** D-02 | mode_selected on Quiz select | 04-04 | COVERED |
| **CONTEXT** D-03 | Canonical knowledge only input | 04-02 | COVERED |
| **CONTEXT** D-04 | quiz_generator_v1.json | 04-01 | COVERED |
| **CONTEXT** D-05 | Single or two-step LLM | 04-02 | COVERED (single call) |
| **CONTEXT** D-06 | Output Zod schema | 04-01 | COVERED |
| **CONTEXT** D-07 | Dedupe + cap counts | 04-02 | COVERED |
| **CONTEXT** D-08 | Insert before client return | 04-02 | COVERED |
| **CONTEXT** D-09 | Server env AI | 04-01, 04-02 | COVERED |
| **CONTEXT** D-10 | Optional questionCount body | 04-01, 04-02 | COVERED |
| **CONTEXT** D-11 | studySetDb + RLS CRUD | 04-03 | COVERED |
| **CONTEXT** D-12 | pipeline_stage=quiz + response shape | 04-02 | COVERED |
| **CONTEXT** D-13 | ReviewSection Supabase load | 04-03, 04-04 | COVERED |
| **CONTEXT** D-14 | QuizSession approved bank | 04-03, 04-04 | COVERED |
| **CONTEXT** D-15 | quiz_sessions on done | 04-03, 04-04 | COVERED |
| **CONTEXT** D-16 | Dashboard quiz CTA | 04-04 | COVERED |
| **RESEARCH** Single LLM call | recommended_count + concepts + questions | 04-02 | COVERED |
| **RESEARCH** Replace-all re-generate | DELETE then INSERT | 04-02 | COVERED |
| **RESEARCH** Inline generation on source | Not modal | 04-04 | COVERED |
| **DEFERRED** FLASH path | Phase 5 | — | EXCLUDED |
| **DEFERRED** CORE-MIST-01 | Phase 5 | — | EXCLUDED |
| **DEFERRED** OOS-03 quality gate | Out of scope | — | EXCLUDED |

**Audit result:** All in-scope GOAL, REQ, CONTEXT, and RESEARCH items covered. No unplanned gaps.

---

## Requirement → Plan Mapping

| Requirement ID | Description | Plan(s) | Verification |
|----------------|-------------|---------|--------------|
| MODE-01 | Choose Quiz or Flashcards after canonical | 04-04 | Human checkpoint Task 4 |
| QUIZ-01 | Detect testable concepts (canonical only) | 04-01, 04-02 | `quizSchemas.test.ts`, `quizGenerate.test.ts` |
| QUIZ-02 | Recommend question count | 04-01, 04-02 | `quizSchemas.test.ts`, API response `recommendedCount` |
| QUIZ-03 | 4 options, 1 correct | 04-01, 04-02 | Zod tuple + DB check constraints |
| QUIZ-04 | Dedupe; fewer when insufficient | 04-02 | `dedupeAndCapQuestions.test.ts` |
| QUIZ-05 | Save before review | 04-02 | `quizGenerate.test.ts` persist ordering |
| QUIZ-06 | Review, edit, delete | 04-03, 04-04 | `studySetDb.test.ts`, human review step |
| QUIZ-07 | Start practice from saved questions | 04-04 | Human checkpoint practice step |
| CORE-DASH-01 | Dashboard listing | 04-04 | Existing `useDashboardHome` + real bank counts |
| CORE-DASH-02 | Open to practice or continue | 04-04 | `Start quiz` CTA + `cardVariantFor` |
| CORE-PRAC-01 | Keyboard 1–4 | 04-04 | QuizSession existing handler (no regression) |
| CORE-PRAC-02 | Session score summary | 04-03, 04-04 | `activityTracking.test.ts`, done page load |

---

## Locked Decision Traceability

| Decision | Plan | Task reference |
|----------|------|----------------|
| D-01 | 04-04 | Task 2 — Quiz + disabled Flashcards CTAs |
| D-02 | 04-04 | Task 2 — putStudySetMeta mode_selected |
| D-03 | 04-02 | Task 2 — canonical-only preflight reads |
| D-04 | 04-01 | Task 2 — quiz_generator_v1.json |
| D-05 | 04-02 | Task 2 — single LLM call |
| D-06 | 04-01 | Task 3 — quizGeneratorOutputSchema |
| D-07 | 04-02 | Task 1 — dedupeAndCapQuestions |
| D-08 | 04-02 | Task 2 — bulk insert before return |
| D-09 | 04-01, 04-02 | Task 1 verify AI; Task 2 LLM call |
| D-10 | 04-01, 04-02 | quizGenerateBodySchema + route parse |
| D-11 | 04-03 | Task 1 — studySetDb Supabase CRUD |
| D-12 | 04-02 | Task 2 — stage quiz + response fields |
| D-13 | 04-04 | Task 2 — ReviewSection wire |
| D-14 | 04-04 | Task 2 — QuizSession bank load |
| D-15 | 04-03, 04-04 | recordQuizCompletion + done page |
| D-16 | 04-04 | Task 3 — dashboard CTA labels |
| D-P1-17 | 04-02 | Task 3 — replace 501 stub |
| D-P1-08 | 04-02, 04-03 | approved_questions schema mapping |
| D-P3 | 04-04 | Source page at /sets/[id]/source |

---

## Wave Dependency Graph

```text
Phase 3 (upstream)
  03-01 ──┬──► 04-01 (Wave 1)
  03-02 ──┼──► 04-02 (Wave 2)
          └──► 04-03 (Wave 2, parallel)

04-01 ──► 04-02
04-02 ──┬──► 04-04 (Wave 3)
04-03 ──┘
```

| Wave | Plans | Autonomous | Parallel |
|------|-------|------------|----------|
| 1 | 04-01 | yes | — |
| 2 | 04-02, 04-03 | yes | yes (no file overlap) |
| 3 | 04-04 | no (human checkpoint) | — |

---

## Test Coverage Map

| Req ID | Test file | Created in |
|--------|-----------|------------|
| QUIZ-01–03 | `src/lib/pipeline/quizSchemas.test.ts` | 04-01 |
| QUIZ-01–03 | `src/lib/pipeline/quizPrompt.test.ts` | 04-01 |
| QUIZ-04 | `src/lib/pipeline/dedupeAndCapQuestions.test.ts` | 04-02 |
| QUIZ-05 | `src/lib/pipeline/quizGenerate.test.ts` | 04-02 |
| QUIZ-05 | `src/app/api/study-sets/[id]/quiz/generate/route.test.ts` | 04-02 |
| QUIZ-06 | `src/lib/client/studySetDb.test.ts` | 04-03 |
| CORE-PRAC-02 | `src/lib/client/activityTracking.test.ts` | 04-03 |
| MODE-01, QUIZ-07, CORE-* | Human checkpoint | 04-04 |

---

## Phase Gate Checklist

- [ ] All 4 plans executed with SUMMARY.md
- [ ] `npm test` green
- [ ] `npm run build` passes
- [ ] Human checkpoint approved (04-04)
- [ ] No deferred ideas (FLASH, CORE-MIST-01) in implementation
- [ ] Phase 3 canonical data available for E2E verification

---

*Phase 4 validation matrix — v2.1 MVP Pipeline*
