# Phase 5: Flashcards & E2E — Requirement Coverage Matrix

**Generated:** 2026-07-25  
**Phase:** 05-flashcards-e2e  
**Plans:** 4 (05-01 through 05-04)

---

## Multi-Source Coverage Audit

| Source | Item | Plan | Status |
|--------|------|------|--------|
| **GOAL** (ROADMAP) | User completes flashcard path and full practice loop verified | 05-02, 05-04 | COVERED |
| **GOAL** | User answers goal, coverage, amount prompts; system picks card format | 05-01, 05-04 | COVERED |
| **GOAL** | Flashcards generate from canonical knowledge and save immediately | 05-02 | COVERED |
| **GOAL** | User can start flashcard learning session | 05-03, 05-04 | COVERED |
| **GOAL** | Mistakes drill works; next build passes | 05-04 | COVERED |
| **REQ** FLASH-01 | Learning goal: memorize, understand, exam preparation | 05-01, 05-04 | COVERED |
| **REQ** FLASH-02 | Coverage: entire document or selected sections | 05-01, 05-02, 05-04 | COVERED |
| **REQ** FLASH-03 | Amount: recommended or custom count | 05-01, 05-02, 05-04 | COVERED |
| **REQ** FLASH-04 | System auto-detects best card format | 05-01, 05-02, 05-04 | COVERED |
| **REQ** FLASH-05 | Generate from canonical knowledge only | 05-02 | COVERED |
| **REQ** FLASH-06 | Cards save to Supabase immediately | 05-02, 05-03 | COVERED |
| **REQ** FLASH-07 | Start flashcard learning from saved cards | 05-03, 05-04 | COVERED |
| **REQ** CORE-MIST-01 | Mistakes-only drill from wrong answers | 05-04 | COVERED |
| **REQ** MODE-01 | Flashcards path after canonical save | 05-04 | COVERED |
| **CONTEXT** D-01 | Flashcards CTA sets content_kind + mode_selected | 05-04 | COVERED |
| **CONTEXT** D-02 | Mode-specific resume strips | 05-04 | COVERED |
| **CONTEXT** D-03 | Three wizard prompts only | 05-01, 05-04 | COVERED |
| **CONTEXT** D-04 | Inline wizard on source page | 05-04 | COVERED |
| **CONTEXT** D-05 | No legacy FlashcardGenerationConfig | 05-01, 05-04 | COVERED |
| **CONTEXT** D-06 | Canonical knowledge only input | 05-02 | COVERED |
| **CONTEXT** D-07 | flashcard_generator_v1.json | 05-01 | COVERED |
| **CONTEXT** D-08 | detected_format per batch | 05-02 | COVERED |
| **CONTEXT** D-09 | Output Zod schema per card | 05-01, 05-02 | COVERED |
| **CONTEXT** D-10 | Bulk insert before API response | 05-02 | COVERED |
| **CONTEXT** D-11 | pipeline_stage=flashcards + response shape | 05-02 | COVERED |
| **CONTEXT** D-12 | POST body schema | 05-01, 05-02, 05-03 | COVERED |
| **CONTEXT** D-13 | Requires pipeline_stage ≥ canonical | 05-02 | COVERED |
| **CONTEXT** D-14 | Port flashcard bank CRUD | 05-03 | COVERED |
| **CONTEXT** D-15 | FlashcardSession real bank + keyboard | 05-04 | COVERED |
| **CONTEXT** D-16 | Flashcard done summary | 05-04 | COVERED |
| **CONTEXT** D-17 | Dashboard Start flashcards CTA | 05-04 | COVERED |
| **CONTEXT** D-18 | recordQuizCompletion populates mistakes | 05-04 | COVERED |
| **CONTEXT** D-19 | Dashboard Drill mistakes link | 05-04 | COVERED |
| **CONTEXT** D-20 | npm test + build gate | 05-04 | COVERED |
| **CONTEXT** D-21 | Human checkpoint both express paths | 05-04 | COVERED |
| **CONTEXT** D-P4-01 | Enable Flashcards CTA | 05-04 | COVERED |
| **CONTEXT** D-P4-09 | Server env AI | 05-02 | COVERED |
| **CONTEXT** D-P1-08 | approved_flashcards table | 05-02, 05-03 | COVERED |
| **CONTEXT** D-P1-17 | Replace 501 flashcards/generate stub | 05-02 | COVERED |
| **RESEARCH** Mirror quiz pipeline file-for-file | All pipeline modules | 05-01, 05-02 | COVERED |
| **RESEARCH** Cross-mode delete approved_questions | On flashcard generate | 05-02 | COVERED |
| **RESEARCH** Inline wizard on source page | Not modal | 05-04 | COVERED |
| **DEFERRED** Flashcard edit/review workspace polish | Post-MVP | — | EXCLUDED |
| **DEFERRED** Spaced repetition | Post-MVP | — | EXCLUDED |

**Audit result:** All in-scope GOAL, REQ, CONTEXT, and RESEARCH items covered. No unplanned gaps.

---

## Requirement → Plan Mapping

| Requirement ID | Description | Plan(s) | Verification |
|----------------|-------------|---------|--------------|
| MODE-01 | Flashcards path after canonical save | 05-04 | Human checkpoint Task 4 |
| FLASH-01 | Learning goal selection | 05-01, 05-04 | `flashcardSchemas.test.ts`, wizard UI |
| FLASH-02 | Coverage selection | 05-01, 05-02, 05-04 | Body schema + section filter in generate |
| FLASH-03 | Amount selection | 05-01, 05-02, 05-04 | Body schema bounds 5–60 |
| FLASH-04 | Auto-detect card format | 05-01, 05-02, 05-04 | `dedupeAndCapFlashcards.test.ts`, API `detectedFormat` |
| FLASH-05 | Canonical-only generation | 05-02 | `flashcardGenerate.test.ts` |
| FLASH-06 | Immediate Supabase save | 05-02, 05-03 | `flashcardGenerate.test.ts` persist ordering |
| FLASH-07 | Start practice from saved cards | 05-03, 05-04 | Human checkpoint flashcard path |
| CORE-MIST-01 | Mistakes-only drill | 05-04 | `activityTracking.test.ts` + human drill steps |

---

## Locked Decision Traceability

| Decision | Plan | Task reference |
|----------|------|----------------|
| D-01 | 05-04 | Task 1–2 — enable Flashcards CTA + mode_selected |
| D-02 | 05-04 | Task 1 — mode-specific resume strips |
| D-03 | 05-01, 05-04 | Task 2 schemas; Task 1 wizard steps |
| D-04 | 05-04 | Task 1 — inline wizard on source page |
| D-05 | 05-01, 05-04 | No legacy vision types |
| D-06 | 05-02 | Task 2 — canonical-only preflight |
| D-07 | 05-01 | Task 1 — flashcard_generator_v1.json |
| D-08 | 05-02 | Task 1 — resolveDominantFormat |
| D-09 | 05-01 | Task 2 — flashcardGeneratorOutputSchema |
| D-10 | 05-02 | Task 2 — bulk insert before return |
| D-11 | 05-02 | Task 2 — stage flashcards + response fields |
| D-12 | 05-01, 05-02, 05-03 | Body schema + route + client helper |
| D-13 | 05-02 | Task 2 — stage ≥ canonical guard |
| D-14 | 05-03 | Task 1 — studySetDb flashcard CRUD |
| D-15 | 05-04 | Task 2 — FlashcardSession wiring |
| D-16 | 05-04 | Task 2 — flashcards done page |
| D-17 | 05-04 | Task 3 — dashboard Start flashcards |
| D-18 | 05-04 | Task 3 — recordQuizCompletion error surfacing |
| D-19 | 05-04 | Task 3 — Drill mistakes dashboard link |
| D-20 | 05-04 | Task 3 automated gates + Task 4 checklist |
| D-21 | 05-04 | Task 4 — human checkpoint both paths |
| D-P4-01 | 05-04 | Task 1 — enable Flashcards footer |
| D-P4-09 | 05-02 | Server AI in runFlashcardGenerate |
| D-P1-08 | 05-02, 05-03 | approved_flashcards mapping + CRUD |
| D-P1-17 | 05-02 | Task 3 — replace 501 stub |

---

## Wave Dependency Graph

```text
Phase 4 (upstream)
  04-01 ──┬──► 05-01 (Wave 1)
  04-02 ──┼──► 05-02 (Wave 2)
  04-03 ──┼──► 05-03 (Wave 2, parallel)

05-01 ──► 05-02
05-02 ──┬──► 05-04 (Wave 3)
05-03 ──┘
```

| Wave | Plans | Autonomous | Parallel |
|------|-------|------------|----------|
| 1 | 05-01 | yes | — |
| 2 | 05-02, 05-03 | yes | yes (no file overlap) |
| 3 | 05-04 | no (human checkpoint) | — |

---

## Test Coverage Map

| Req ID | Test file | Created in |
|--------|-----------|------------|
| FLASH-01–03 | `src/lib/pipeline/flashcardSchemas.test.ts` | 05-01 |
| FLASH-01–03 | `src/lib/pipeline/flashcardPrompt.test.ts` | 05-01 |
| FLASH-04 | `src/lib/pipeline/dedupeAndCapFlashcards.test.ts` | 05-02 |
| FLASH-05–06 | `src/lib/pipeline/flashcardGenerate.test.ts` | 05-02 |
| FLASH-06 | `src/lib/pipeline/mapFlashcardOutputToRows.test.ts` | 05-02 |
| FLASH-06 | `src/app/api/study-sets/[id]/flashcards/generate/route.test.ts` | 05-02 |
| FLASH-07 | `src/lib/client/studySetDb.test.ts` (flashcard section) | 05-03 |
| FLASH-07 | `src/lib/client/flashcardGenerateStudySet.test.ts` | 05-03 |
| CORE-MIST-01 | `src/lib/client/activityTracking.test.ts` | existing + 05-04 verify |
| MODE-01, FLASH-07, D-20–21 | Human checkpoint | 05-04 |

---

## Phase Gate Checklist

- [ ] All 4 plans executed with SUMMARY.md
- [ ] `npm test run` green
- [ ] `npm run build` passes
- [ ] Human checkpoint approved (05-04)
- [ ] No deferred ideas (flashcard edit polish, spaced repetition) in implementation
- [ ] Phase 4 quiz path regression verified in human checkpoint

---

*Phase 5 validation matrix — v2.1 MVP Pipeline*
