# Doc2Quiz — Roadmap

## Milestone: v2.1 — MVP Pipeline

**Status:** Active — Phase 15 execution and Phase 16 gap closure remain  
**Goal:** Multi-format input → MarkItDown → Canonical Knowledge (Supabase) → Quiz or Flashcards → practice.

**Spec:** [docs/pipeline.md](../docs/pipeline.md)

**v1.0 archive:** [`.planning/milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md)  
**v2.0 archive:** Clean-slate strip (`.planning/milestones/v2.0-phases/`)

---

## Overview

Rebuild backend around MarkItDown conversion and Canonical Knowledge in Supabase, then extend the learning shell with localization, stable navigation, quotas, workspaces, safe collaboration, social study, scalable presence, and account themes.

---

## Phases

- [x] **Phase 1: Foundation** — Supabase schema, auth, API skeleton for pipeline (executed 2026-07-25)
- [x] **Phase 2: Input & MarkItDown** — Input zone (all formats), validation, raw Markdown conversion (completed 2026-07-25)
- [x] **Phase 3: Canonical Knowledge** — Builder service, sections/metadata, Supabase persistence (completed 2026-07-25)
- [x] **Phase 4: Quiz Pipeline** — Concept detection, MCQ generation, save, review, practice wire-up (completed 2026-07-25)
- [x] **Phase 5: Flashcards & E2E** — Flashcard wizard, generation, learning, dashboard integration (completed 2026-07-25)
- [x] **Phase 11: Friends, Messaging & Playful Reactions** — Accepted-friend lists, private messaging, recent-activity presence, and preset recipient-controlled reactions. Implementation imported 2026-07-30; two-account human verification remains documented as debt.
- [x] **Phase 12: Study Together** — Durable friend lifecycle, asynchronous quiz challenges, immutable quiz snapshots, in-app notifications, scalable friends hub, and responsive messaging. Depends on existing quiz practice and Phase 11 social primitives. Requirements: SOCIAL-01–10. Success: a user can challenge an accepted friend with an owned quiz; recipient accepts and starts a snapshot-based attempt; both see result comparison under configured reveal policy; missed realtime events reconcile from durable notifications. (completed 2026-08-03)
- [x] **Phase 14: Friend presence and chat layout repair** — Correct online/offline tabs and presence indicators in friend lists; wrap long chat messages inside their bubbles. Depends on Phase 12 social UI. (completed 2026-08-01)
- [ ] **Phase 15: Social presence scaling** — Redis-backed ephemeral presence, conversation-scoped typing indicators, durable activity batching, rate limits, accepted-friend privacy, and graceful Redis degradation for 100–1,000 concurrent users. Five plans remain unexecuted.
- [ ] **Phase 16: IDE-Inspired Themes** — Account-persisted IDE palettes and accessible appearance controls. Plans 1–2 executed; Plan 3 gap closure remains.

### Phase 11: Friends, Messaging & Playful Reactions

**Goal:** Turn safe username-based friend requests into accepted-friend lists, private 1:1 messaging, recent-activity presence, and fixed recipient-controlled reactions.
**Depends on:** Phase 10
**Requirements:** FRIEND-01–05, MSG-01–03, SAFE-01–02, REACT-01–02
**Success Criteria:**

1. Accepted, non-blocked friends can list each other and open durable private conversations without exposing non-friends.
2. Authenticated API routes validate bounded messages and fixed reaction IDs while preserving generic authorization failures.
3. Navbar friend UI exposes requests, presence buckets, messaging, and motion-safe reactions with recipient opt-out controls.
4. Two-account privacy, block, presence, messaging, reaction, responsive, keyboard, and reduced-motion behavior receives human verification.

**Plans:** 3/3 implementation records present; final human verification remains debt

Plans:
- [x] 11-01-PLAN.md — Social database authority and typed client contracts
- [x] 11-02-PLAN.md — Authenticated social API contracts
- [x] 11-03-PLAN.md — Navbar, chat, reactions, and social safety UI; human checkpoint pending

### Phase 12: Study Together

**Goal:** Turn friendship into a durable study loop: users challenge accepted friends with creator-owned quizzes, both practice an immutable session snapshot, and durable notifications return them when action or results are ready.
**Depends on:** Phase 10, Phase 11, existing quiz practice engine
**Requirements:** SOCIAL-01–10
**Success Criteria:**

1. User can remove a friend separately from blocking, then send an accepted friend an asynchronous score or practice challenge sourced only from their own ready, non-deleted, non-empty quiz.
2. Challenge creation authorizes source access server-side and stores an immutable snapshot; recipient accepts and starts exactly one resumable attempt without source answer access.
3. Durable session, participant, attempt, result, and notification records survive missed broadcasts, source edits/deletion, refreshes, reconnects, and navigation failure; realtime only accelerates delivery.
4. Recipient and challenger view results only under configured reveal policy, defaulting to after both finish; no answer leakage occurs before permitted reveal.
5. Responsive `/friends` hub provides scalable Friends, Requests, Invites, Messages, and Blocked areas while topbar menu stays a compact launcher with server-derived unread badge.

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 12-01-PLAN.md — Secure immutable challenge, notification, reaction, and remove-friend authority

**Wave 2** *(blocked on Wave 1; plans run in parallel)*
- [x] 12-02-PLAN.md — Validated challenge and durable notification API contracts
- [x] 12-07-PLAN.md — Additive private realtime topic RLS and isolation proof

**Wave 3** *(blocked on Wave 2)*
- [x] 12-03-PLAN.md — Durable notification, request, and message count reconciliation

**Wave 4** *(blocked on Waves 2–3)*
- [x] 12-04-PLAN.md — Ready-owned challenge play, notifications UI, and locale

**Wave 5** *(blocked on Waves 2–4)*
- [x] 12-05-PLAN.md — Separate remove-friend, avatar, and action-menu repair

**Wave 6** *(blocked on prerequisite social contracts; plans run in parallel)*
- [x] 12-08-PLAN.md — Authenticated bounded social-list RPCs/routes/tests, responsive `/friends` hub, and compact launcher links
- [x] 12-09-PLAN.md — Shared responsive chat, mobile full-screen route, and history/reconnect proof

**Wave 7** *(blocked on all implementation plans)*
- [x] 12-06-PLAN.md — Validation-contract proof and two-account responsive verification


### Phase 15: Social presence scaling

**Goal:** Keep hot presence and typing traffic out of PostgreSQL while preserving privacy, durable activity, and graceful Redis failure behavior at 100–1,000 concurrent users.
**Depends on:** Phase 14, Spike 001 (`.planning/spikes/001-redis-social-presence-scaling/README.md`)
**Requirements:** SCALE-01–10
**Success Criteria:**

1. Stateless Next.js heartbeat handlers write per-session presence keys to Redis with bounded cadence and TTL; no heartbeat writes to Postgres.
2. Accepted-friend snapshots aggregate multiple sessions, use bounded batched Redis reads, expose coarse status buckets, and suppress blocked users.
3. Conversation participants see five-second TTL typing indicators with server-side throttling and automatic expiry.
4. Meaningful activity drains through a retryable idempotent batch path to durable `private.social_activity`.
5. Redis outage preserves messaging, serves last-known state only during grace, then returns `unknown`; no high-frequency Postgres fallback occurs.
6. Rate limits, privacy checks, observability, load evidence, and focused failure tests pass.

**Plans:** 0/5 plans complete

Plans:
- [ ] 15-01-PLAN.md — Redis contracts, heartbeat, rate limiting, observability, and activity seam
- [ ] 15-02-PLAN.md — Canonical presence snapshots, privacy, typing, and activity handoff
- [ ] 15-03-PLAN.md — Bounded durable activity queue and worker integration
- [ ] 15-04-PLAN.md — Client presence, typing, invalidation-only realtime, and load integration
- [ ] 15-05-PLAN.md — Executable validation and external load evidence

### Phase 16: IDE-Inspired Themes

**Goal:** Signed-in users select and persist an IDE-inspired visual theme from Settings without wrong-theme first paint, account-boundary drift, mutation races, keyboard failures, or contrast failures.
**Depends on:** Phase 15 for numbering only; implementation is otherwise independent
**Requirements:** THEME-01–05
**Success Criteria:**

1. Validated account preference seeds first paint and System maps to VS Code Light or Dark.
2. Rapid selections converge UI, DOM, optional storage, and authenticated profile persistence on the latest choice.
3. Four named palettes preserve readable semantic shell, quiz, and flashcard surfaces.
4. Appearance radios support complete wrapped arrow-key navigation and visible selection state.
5. Focused tests, typecheck, lint, build, and credential-gated browser verification pass.

**Plans:** 2/3 plans complete

Plans:
- [x] 16-01-PLAN.md — Theme persistence contract and SSR-safe controller
- [x] 16-02-PLAN.md — IDE palette tokens and accessible appearance selector
- [ ] 16-03-PLAN.md — Gap closure for account boundaries, races, keyboard behavior, and contrast

### Phase 14: Friend presence and chat layout repair

**Goal:** Friends appear in their actual presence tab with offline presence visuals suppressed, while all chat messages remain readable inside their bubbles.
**Depends on:** Phase 12 social UI
**Requirements:** SOCIAL-09, SOCIAL-10
**Success Criteria:**

1. An online friend appears only in the Online tab; an offline friend appears only in the Offline tab.
2. Offline friend rows never show an online presence dot or online status text; online rows retain the existing live presence presentation.
3. Long unbroken and normal chat text wraps or breaks safely within its bubble on desktop and mobile, without horizontal overflow.
4. Existing friend-list paging, realtime presence updates, messaging history, and responsive chat behavior remain intact.

**Plans:** 2/2 plans complete

Plans:
- [x] 14-01-PLAN.md — Tracer: server-authoritative presence buckets, cursor paging, and contract tests
- [x] 14-02-PLAN.md — Presence tabs/row visuals and shared chat-bubble overflow repair

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
| 15. Social presence scaling | 0/? | Planned | — |

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

**Plans:** 8/9 plans executed

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

**Plans:** 10/10 plans complete

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Confirm Phase 9 schema, seed RLS fixture, and enforce workspace-role RLS

**Wave 2** *(blocked on Wave 1)*

- [x] 10-02-PLAN.md — Owner invitations, membership authority, and private share lifecycle APIs

**Wave 3** *(blocked on Wave 2 or Wave 1; plans run in parallel)*

- [x] 10-03-PLAN.md — Build locked opaque share authority, safe study DTO, and SQL coverage
- [x] 10-05-PLAN.md — Build locked social safety authority and SQL coverage
- [x] 10-09-PLAN.md — Migrate six exact Phase 9 workspace content routes to editor authorization

**Wave 4** *(blocked on prerequisite feature plans; plans run in parallel)*

- [x] 10-04-PLAN.md — Public share route/UI and literal EN/VI safety copy
- [x] 10-07-PLAN.md — Protected profile and friend/block/report API wiring

**Wave 5** *(blocked on public/social feature plans; plans run in parallel)*

- [x] 10-06-PLAN.md — Anonymous public-quiz outbox, idempotent import, and SQL coverage
- [x] 10-08-PLAN.md — Tested reachable role-aware workspace collaboration UI

**Wave 6** *(blocked on social APIs and workspace UI locale ownership)*

- [x] 10-10-PLAN.md — Tested accessible social safety Settings UI

---

*Last updated: 2026-07-30 — planned Phase 10 safe collaboration, anonymous study, and friend safety*
