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

**Plans:** 7/7 plans complete

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

- [x] 06-07-PLAN.md — Coverage audit, full automated gates, and human EN/VI route/layout verification

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

- [x] 07-09-PLAN.md — Delete legacy routes, deterministic route smoke (human matrix pending)

### Phase 8: Freemium & Coupons

**Goal:** Free users are limited to 10 successful study-set generations per calendar week (Monday 00:00 UTC+7); Pro users are unlimited; users redeem coupon codes for bonus generation credits.
**Requirements:** PLAN-01–10
**Depends on:** Phase 7 (or executable in parallel once generate routes stable — no hard IA dependency)
**Success Criteria:**

  1. Quiz and flashcard generate APIs enforce quota server-side; regenerate on same set does not re-consume
  2. Free user at weekly limit with zero bonus receives HTTP 402 with structured `quota_exceeded` payload
  3. `GET /api/usage` drives sidebar and Settings plan card; `/quiz/[setId]` preflights before canonicalize
  4. User redeems case-insensitive coupon codes in Settings; bonus credits stack; each code once per user
  5. Vitest + build pass; EN/VI plan copy complete

**Plans:** 6/7 plans complete

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — Migration + quota server lib + GET /api/usage + quiz route hooks + tests (tracer)

**Wave 2** *(blocked on Wave 1)*

- [x] 08-02-PLAN.md — Flashcard route + client 402 + sidebar/settings usage + quiz preflight/block UI

**Wave 3** *(blocked on Wave 2)*

- [x] 08-03-PLAN.md — Coupon RPC + redeem API + Settings coupon form + seed codes + locale

**Wave 4** *(gap closure; blocked on 08-01 and 08-03)*

- [x] 08-04-PLAN.md — Atomic Postgres quota reservation, commit/release lifecycle, RLS hardening, and deterministic concurrency proof

**Wave 5** *(gap closure; blocked on 08-04)*

- [x] 08-05-PLAN.md — Typed reservation RPC adapter and availability-backed quota usage authority

**Wave 6** *(gap closure; blocked on 08-05)*

- [x] 08-06-PLAN.md — Reserve-before-generation route lifecycle and deterministic failure-release tests for quiz and flashcards

**Wave 7** *(gap closure; blocked on 08-06)*

- [ ] 08-07-PLAN.md — Fix GET /api/usage TypeScript build failure (TS2589) without runtime behavior change

### Phase 9: Workspace-Centered Learning & Canonical Provenance

**Goal:** Replace standalone study-set creation with durable workspaces that preserve document and canonical-version provenance while generating multi-source quizzes and flashcards.
**Requirements:** WORK-01–09
**Depends on:** Phase 8
**Success Criteria:**

  1. First upload creates a workspace automatically; dashboard lists workspaces and users can rename them later.
  2. Source-file replacement creates a new immutable document version; metadata changes do not replace source material.
  3. Canonical versions store complete reproducibility metadata and render progressive section-based reading views.
  4. Quiz and flashcard generation supports multiple canonical document versions and persists frozen snapshots.
  5. Soft-deleting documents or canonical versions preserves existing generated outputs and provenance.

**Plans:** 9/9 plans complete

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Workspace schema, backfill, RLS, atomic RPCs, and checksum contract

**Wave 2** *(blocked on Wave 1)*

- [x] 09-02-PLAN.md — Workspace-native first ingest, immutable document lifecycle, and import client

**Wave 3** *(blocked on Wave 2)*

- [x] 09-03-PLAN.md — Append-only canonical versions and progressive section reader

**Wave 4** *(blocked on Wave 3)*

- [x] 09-04-PLAN.md — Multi-source quiz generation, frozen snapshots, and quiz bridge

**Wave 5** *(blocked on Wave 4)*

- [x] 09-05-PLAN.md — Multi-source flashcard parity, frozen snapshots, and flashcard bridge

**Wave 6** *(blocked on Wave 5)*

- [x] 09-06-PLAN.md — Workspace dashboard summary, detail API, and reader/output navigation

**Wave 7** *(blocked on Wave 6)*

- [x] 09-07-PLAN.md — Legacy non-flashcard adapter resolver contracts and tests

**Wave 8** *(blocked on Wave 7)*

- [x] 09-08-PLAN.md — Legacy flashcard adapter contract and tests

**Wave 9** *(blocked on Wave 8)*

- [x] 09-09-PLAN.md — SQL/static compatibility audit, full automated gates, and human verification

### Phase 10: Safe Collaboration, Sharing & Friends

**Goal:** Add secure workspace collaboration and anonymous study without public edit links or provenance-breaking access paths.
**Requirements:** COLLAB-01–07
**Depends on:** Phase 9
**Success Criteria:**

  1. Owner, editor, and viewer roles enforce distinct workspace permissions.
  2. Public workspace, quiz, and flashcard links allow anonymous view/study only and never confer membership or edit rights.
  3. Authenticated users receive workspace access only through explicit invitations with a selected role.
  4. Anonymous quiz attempts persist locally, import safely after login, and avoid duplicates.
  5. Username-based friend requests use normalized unique usernames, rate limits, and block/report controls.

**Plans:** 10 plans

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Confirm Phase 9 schema, seed RLS fixture, and enforce workspace-role RLS (completed 2026-07-30)

**Wave 2** *(blocked on Wave 1)*

- [ ] 10-02-PLAN.md — Owner invitations, membership authority, and private share lifecycle APIs

**Wave 3** *(blocked on Wave 2 or Wave 1; plans run in parallel)*

- [ ] 10-03-PLAN.md — Build locked opaque share authority, safe study DTO, and SQL coverage
- [ ] 10-05-PLAN.md — Build locked social safety authority and SQL coverage
- [ ] 10-09-PLAN.md — Migrate six exact Phase 9 workspace content routes to editor authorization

**Wave 4** *(blocked on prerequisite feature plans; plans run in parallel)*

- [ ] 10-04-PLAN.md — Public share route/UI and literal EN/VI safety copy
- [ ] 10-07-PLAN.md — Protected profile and friend/block/report API wiring

**Wave 5** *(blocked on public/social feature plans; plans run in parallel)*

- [ ] 10-06-PLAN.md — Anonymous public-quiz outbox, idempotent import, and SQL coverage
- [ ] 10-08-PLAN.md — Tested reachable role-aware workspace collaboration UI

**Wave 6** *(blocked on social APIs and workspace UI locale ownership)*

- [ ] 10-10-PLAN.md — Tested accessible social safety Settings UI

---

*Last updated: 2026-07-30 — planned Phase 10 safe collaboration, anonymous study, and friend safety*
