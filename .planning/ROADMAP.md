# Doc2Quiz — Roadmap

## Milestone: v2.1 — MVP Pipeline

**Status:** Verifying  
**Goal:** Multi-format input → MarkItDown → Canonical Knowledge (Supabase) → Quiz or Flashcards → practice.

**Spec:** [docs/pipeline.md](../docs/pipeline.md)

**v1.0 archive:** [`.planning/milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md)  
**v2.0 archive:** Clean-slate strip (`.planning/milestones/v2.0-phases/`)

---

## Overview

Rebuild backend around MarkItDown conversion and a Canonical Knowledge Builder stored in Supabase. Wire existing frontend shell for mode selection, quiz review/practice, and flashcard learning. Five phases: foundation → ingest → canonicalize → quiz path → flashcard path + E2E.

---

## Phases

- [x] **Phase 1: Foundation** — Supabase schema, auth, API skeleton for pipeline (executed 2026-07-25)
- [x] **Phase 2: Input & MarkItDown** — Input zone (all formats), validation, raw Markdown conversion (completed 2026-07-25)
- [x] **Phase 3: Canonical Knowledge** — Builder service, sections/metadata, Supabase persistence (completed 2026-07-25)
- [x] **Phase 4: Quiz Pipeline** — Concept detection, MCQ generation, save, review, practice wire-up (completed 2026-07-25)
- [x] **Phase 5: Flashcards & E2E** — Flashcard wizard, generation, learning, dashboard integration (completed 2026-07-25)

---

## Phase Details

### Phase 1: Foundation

**Goal:** Authenticated users can connect to Supabase; schema supports canonical knowledge storage
**Depends on:** Nothing
**Requirements:** CORE-AUTH-01, CORE-AUTH-02, CANON-09, INPUT-VAL-01
**Success Criteria:**

  1. User can sign in and out; protected app routes require auth
  2. Supabase tables exist for study sets, canonical documents (original, raw md, canonical md, metadata, sections)
  3. API route structure exists for pipeline steps (stub handlers OK)

**Plans:** 5 plans

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Delete legacy migrations + v2.1 baseline SQL (files-only per D-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Supabase SSR clients + proxy session refresh
- [x] 01-03-PLAN.md — INPUT-VAL-01 validation contract + tests (parallel wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Authenticated study-sets API + pipeline step stubs
- [x] 01-05-PLAN.md — studySetDb, types, auth UI wiring + auth smoke checkpoint

### Phase 2: Input & MarkItDown

**Goal:** User can submit any supported input type and receive stored raw Markdown
**Depends on:** Phase 1
**Requirements:** INPUT-01–12, CONV-01, CONV-02
**Success Criteria:**

  1. Input zone accepts PDF, Office, images, audio, HTML, CSV, JSON, XML, paste, YouTube URL
  2. Invalid inputs are rejected with clear errors before conversion
  3. MarkItDown produces raw Markdown; original/source reference is stored

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Phase 1 verify + INPUT-VAL-01 enforcement + MarkItDown subprocess module + requirements.txt

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Ingest orchestration + dual-mode POST /api/study-sets/[id]/ingest (INPUT-01–12, CONV-01–02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Unified input zone UI + client Storage upload + legacy cleanup + source placeholder

**UI hint:** yes

### Phase 3: Canonical Knowledge

**Goal:** Raw Markdown becomes cleaned, sectioned canonical knowledge in Supabase
**Depends on:** Phase 2
**Requirements:** CANON-01–08
**Success Criteria:**

  1. Noise removed, duplicates collapsed; headings/tables/formulas/examples preserved
  2. Language and content type (theory/exam/mixed) detected and stored
  3. Existing Q&A extracted when present; stable sections with title/filename generated without invention
  4. User can view canonical output before choosing learning mode

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — section_key migration + prompt loader + Zod schemas + restore AI server lib

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — canonicalize service + POST/GET API routes + tests

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Canonical preview UI + auto-canonicalize from raw stage

**UI hint:** yes

### Phase 4: Quiz Pipeline

**Goal:** User generates MCQs from canonical knowledge, reviews them, and starts practice
**Depends on:** Phase 3
**Requirements:** MODE-01, QUIZ-01–07, CORE-DASH-01, CORE-DASH-02, CORE-PRAC-01, CORE-PRAC-02
**Success Criteria:**

  1. User selects Quiz mode after canonical save
  2. System recommends count and generates MCQs (4 options, 1 correct, no duplicate concepts)
  3. Questions save to Supabase before review; user can edit/delete
  4. User can start keyboard-first quiz from dashboard

**Plans:** 4/4 plans complete

Plans:
**Wave 1** *(blocked on Phase 3 Wave 1 — 03-01)*

- [x] 04-01-PLAN.md — quiz_generator_v1.json + Zod schemas + verify server AI lib

**Wave 2** *(blocked on Wave 1 + Phase 3 Wave 2 — 03-02; 04-02 and 04-03 parallel)*

- [x] 04-02-PLAN.md — runQuizGenerate + POST /quiz/generate + approved_questions insert
- [x] 04-03-PLAN.md — studySetDb approved bank CRUD + activityTracking quiz_sessions

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — Mode selection + generation UX + review→practice + dashboard CTAs (human verify)

**UI hint:** yes

### Phase 5: Flashcards & E2E

**Goal:** User completes flashcard path and full practice loop is verified
**Depends on:** Phase 4
**Requirements:** FLASH-01–07, CORE-MIST-01
**Success Criteria:**

  1. User answers goal, coverage, and amount prompts; system picks card format
  2. Flashcards generate from canonical knowledge and save immediately
  3. User can start flashcard learning session
  4. Mistakes drill works for quiz sessions; `next build` passes

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Flashcard prompt JSON + Zod schemas + unit tests (FLASH-01–04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — runFlashcardGenerate + POST /flashcards/generate + dedupe/cap (FLASH-04–06)
- [x] 05-03-PLAN.md — Client flashcard bank CRUD + postFlashcardGenerate helper (FLASH-06–07) *(parallel with 05-02)*

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Wizard UI + enable Flashcards CTA + dashboard + mistakes drill + E2E checkpoint (FLASH-01–07, CORE-MIST-01, MODE-01)

**UI hint:** yes

---

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Foundation | 5/5 | Complete   | 2026-07-25 |
| 2. Input & MarkItDown | 3/3 | Complete   | 2026-07-25 |
| 3. Canonical Knowledge | 3/3 | Complete   | 2026-07-25 |
| 4. Quiz Pipeline | 4/4 | Complete   | 2026-07-25 |
| 5. Flashcards & E2E | 4/4 | Complete   | 2026-07-25 |

### Phase 6: Bilingual EN/VI language selector and reusable contextual slang system

**Goal:** Users can choose persistent English or Vietnamese UI and receive safe, context-aware supporting slang across study workflows without losing clear product copy, accessibility, current functionality, or layout.
**Requirements:** LOCALE-01–05, SLANG-01–04
**Depends on:** Phase 5
**Success Criteria:**

  1. User can switch EN/VI from account and Settings controls; preference persists, synchronizes across tabs, and hydrates without warnings
  2. Typed EN/VI catalogs cover loading, upload, conversion, generation, feedback, retry, success, empty, warning, streak, score, navigation, results, badges, toasts, progress, and secondary labels
  3. Contextual slang rotates naturally without immediate consecutive repeats and remains deterministic in tests
  4. Literal product copy stays primary; destructive, privacy, auth, accessibility, serious-error, and shaming copy contains no slang
  5. Lint, typecheck, tests, build, route matrix, and mobile/desktop layout verification pass with existing functionality unchanged

**Plans:** 6/7 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Typed EN/VI catalogs, curated contextual slang, deterministic no-repeat selection, and validated storage

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-PLAN.md — Hydration-safe LocaleProvider, persistent account/settings selectors, and shared shell localization

**Wave 3** *(blocked on Wave 2)*

- [x] 06-03-PLAN.md — Reusable literal-plus-slang composition and shared upload/conversion/generation progress integration

**Wave 4** *(blocked on Wave 3; plans run in parallel)*

- [x] 06-04-PLAN.md — Import, canonical generation, quiz review, and flashcard review localization
- [x] 06-05-PLAN.md — Quiz/flashcard practice, feedback, score, progress, and results localization
- [x] 06-06-PLAN.md — Dashboard empty states, cards, stats, streaks, badges, and navigation localization

**Wave 5** *(blocked on Wave 4)*

- [ ] 06-07-PLAN.md — Coverage audit, full automated gates, and human EN/VI route/layout verification

### Phase 7: Normalize app information architecture around setId-based quiz and flashcard routes, unified creation flows, library filtering, set-detail navigation, and a responsive sidebar that persists, collapses, or hides by workflow context

**Goal:** Users can create, find, open, review, edit, resume, practice, and inspect results for quiz and flashcard sets through one coherent setId-based information architecture with responsive, context-aware navigation.
**Requirements:** IA-01–10
**Depends on:** Phase 6
**Success Criteria:**

  1. Every supported workflow uses the singular canonical `/quiz/*` and `/flashcard/*` tree; removed legacy paths return normal 404 responses with no redirects.
  2. `/create` selects a format and each type-specific wizard completes Source → Convert → Generate → Review through the existing shared pipeline while preserving study-set IDs and content.
  3. `/dashboard` URL parameters authoritatively drive combined library filtering, search, sort, status, and mistake-practice views; cards open status-aware type-specific overviews with no more than three safe previews.
  4. Desktop uses a collapsible sidebar and slim contextual top bar; mobile uses top-level bottom navigation and nested contextual bars; play/drill hides persistent navigation while results restores it.
  5. Server-persisted unfinished quiz and flashcard sessions resume at the exact item after reload/browser close, and final verification passes route-contract, migration, locale, accessibility, responsive, typecheck, lint, test, and build gates.

**Plans:** 9 plans

Plans:
**Wave 1**

- [ ] 07-01-PLAN.md — Dirty-workspace authorization gate plus canonical route/link contracts

**Wave 2** *(blocked on Wave 1)*

- [ ] 07-02-PLAN.md — Exact resumable-session state machine and durable cross-mode mistake ledger

**Wave 3** *(blocked on Waves 1–2; plans run in parallel)*

- [ ] 07-03-PLAN.md — Canonical create chooser and shared type-specific pipeline wizards
- [ ] 07-04-PLAN.md — URL-driven dashboard, tested D-09–D-13 cards, mistakes, and smart resume
- [ ] 07-05-PLAN.md — Sidebar-primary responsive shell, localized navigation, and Help page

**Wave 4** *(blocked on dashboard/session foundations; plans run in parallel)*

- [ ] 07-06-PLAN.md — Quiz overview, review/edit, play, results, drill, and exact resume route slice
- [ ] 07-07-PLAN.md — Flashcard overview, review/edit, play, results, drill, and exact resume route slice

**Wave 5** *(blocked on all feature plans)*

- [ ] 07-08-PLAN.md — Migrate residual callers/config/tests and record zero-reference deletion precondition

**Wave 6** *(blocked on recorded zero-reference gate)*

- [ ] 07-09-PLAN.md — Delete legacy routes, deterministic authenticated route smoke, full gates, and human matrix

---

*Last updated: 2026-07-25 — v2.1 MVP Pipeline from docs/pipeline.md*
