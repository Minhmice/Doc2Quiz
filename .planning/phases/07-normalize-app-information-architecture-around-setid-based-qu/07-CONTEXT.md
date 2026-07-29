# Phase 7: Normalize App Information Architecture - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current mixed route tree (`/edit/*`, `/sets/*`, legacy aliases) with a coherent, `setId`-based information architecture for quiz and flashcard workflows. Ship a sidebar-primary app shell with route-aware navigation states, unified library filtering on `/dashboard`, set overview pages as the default card destination, and hard cutover to the new URL structure with no backward-compatible redirects.

In scope: route restructure, navigation shell, link/constants migration, create wizard placement, set overview pages, library query-param filtering, practice navigation behavior, deletion of legacy route folders and dead navigation logic.

Out of scope: new product capabilities beyond navigation/IA (comments, sharing, search beyond existing library search, billing redesign), merging review and edit into one screen (they remain separate routes), translating user-generated study content (Phase 6 boundary still applies).
</domain>

<decisions>
## Implementation Decisions

### Route migration (hard cutover)
- **D-01:** Hard cutover only. Delete legacy routes, aliases, redirects, route guards, loaders, components, and internal links supporting old paths. Old URLs must return normal 404 — no redirects or backward compatibility.
- **D-02:** Canonical route tree:

```txt
/dashboard
/create

/quiz/create
/quiz/[setId]              # set overview (index)
/quiz/[setId]/review
/quiz/[setId]/edit
/quiz/[setId]/play
/quiz/[setId]/results
/quiz/[setId]/drill-mistake

/flashcard/create
/flashcard/[setId]         # set overview (index)
/flashcard/[setId]/review
/flashcard/[setId]/edit
/flashcard/[setId]/play
/flashcard/[setId]/results
/flashcard/[setId]/drill-mistake

/help
/settings
```

- **D-03:** Remove entirely (non-exhaustive): `/edit/new/quiz`, `/edit/quiz/[id]`, `/sets/[id]/source`, `/flashcards/[id]`, and all legacy `/edit/*`, `/sets/*`, `/flashcards/*` app routes plus `next.config.ts` redirects that preserved them.
- **D-04:** Use singular `flashcard` in URLs (not `flashcards`). Preserve database `setId` values; only URL/navigation changes.
- **D-05:** Before deletion: grep entire codebase for old paths; update buttons, cards, sidebar, navbar, server actions, middleware, tests, and route constants; delete unused route folders/dead components; run typecheck, lint, build, and route tests.
- **D-06:** Completion uses `/results`, not `/done`. After play ends, persist session output and redirect to `/quiz/[setId]/results` or `/flashcard/[setId]/results`. Results page includes score/completion summary, correct/incorrect items, retry session, drill mistakes, edit set, return to dashboard. Do not route completion to `/review`.
- **D-07:** `/create` is format selection only. After choice: Quiz → `/quiz/create`, Flashcard → `/flashcard/create`. Upload, MarkItDown conversion, canonicalization, and generation live inside each create route as one wizard: Source → Convert → Generate → Review. Reuse shared components and backend pipeline; do not duplicate conversion logic; do not recreate `/sets/[id]/source`.
- **D-08:** Review and Edit are separate routes and pages for MVP. May share components underneath, but URLs and primary intent remain distinct. Review = inspect generated output; Edit = manual fixes.

### Set overview (dashboard card destination)
- **D-09:** Dashboard cards open set overview routes: `/quiz/[setId]` or `/flashcard/[setId]` — not play, not review directly.
- **D-10:** Overview content is status-driven hub showing: title, type, source, item count, readiness/status (generating, needs review, ready, failed), progress, last studied, latest score.
- **D-11:** Primary CTA by state: generating → View progress; needs review → Review content; ready/new → Start studying; has mistakes → Drill mistakes.
- **D-12:** Secondary actions: Edit, Review, Results history, Duplicate, Delete.
- **D-13:** Short preview only (max 3 compact items). Quiz preview: question text truncated 2 lines, item number/type, no answers. Flashcard preview: front text only truncated 2 lines; back hidden. Prioritize flagged/unreviewed items when status = needs review; otherwise first 3. Show total count above preview. Link “View all in Review”. No pagination, carousel, or inline editing on overview.

### Library filtering
- **D-14:** Single library on `/dashboard` with query params as source of truth. Sidebar Quizzes/Flashcards/All sets change `type` only — not separate dashboards.
- **D-15:** Default `/dashboard` normalizes to `/dashboard?type=all`. Invalid/missing `type` falls back to `all`. Preserve other params (`search`, `status`, `sort`, `practice`) when switching `type`.
- **D-16:** “All sets” shows quizzes and flashcards together, sorted by active sort option.
- **D-17:** Do not persist library filter in localStorage. URL query string is authoritative for `type`, `search`, `sort`, `status`, and `practice`.

### Sidebar-primary shell
- **D-18:** Sidebar-primary layout. Persistent left sidebar contains: logo, Dashboard, Create, All sets, Quizzes, Flashcards, Continue studying, Mistake drills, Settings, Help, user avatar/name/plan-usage.
- **D-19:** Slim top bar only: sidebar toggle, page title/breadcrumb, global search when relevant, route-specific actions (Create, Save, Done). Remove account menu, theme toggle, and duplicated nav from top bar (relocate into sidebar/account surfaces per design).
- **D-20:** Sidebar supports user-toggleable collapse in addition to route rules. “Create new” remains primary coral CTA in sidebar.
- **D-21:** Force-hide sidebar only on active study sessions: `/quiz/[setId]/play`, `/quiz/[setId]/drill-mistake`, `/flashcard/[setId]/play`, `/flashcard/[setId]/drill-mistake`. User cannot reopen sidebar on these routes; provide clear Exit control.
- **D-22:** Results routes restore normal shell (sidebar available per user toggle): `/quiz/[setId]/results`, `/flashcard/[setId]/results`.
- **D-23:** Mobile: bottom nav only on top-level pages (Dashboard, Library, Create, Account). Nested workflow pages use compact top bar with Back/Exit and contextual actions (overview, create wizard, review, edit, results). Hide all persistent navigation during play and drill-mistake. No hamburger drawer as primary mobile navigation.

### Practice navigation
- **D-24:** Continue studying uses smart resume: (1) if unfinished session exists, resume exact session at last item; (2) else if recently studied set exists, open its overview; (3) else `/dashboard` empty state “Start your first set”. Show compact resume picker only when multiple unfinished sessions exist.
- **D-25:** Unfinished session progress must persist server-side and survive reload/browser close (MVP requirement).
- **D-26:** Mistake drills opens `/dashboard?practice=mistakes` showing only sets with unresolved mistakes, sorted by most mistakes then most recently studied. Cards show mistake count, type, last practiced, and Drill mistakes CTA → `/quiz/[setId]/drill-mistake` or `/flashcard/[setId]/drill-mistake`. Empty state when no mistakes.
- **D-27:** Help opens in-app `/help` page (shortcuts, workflow guide, FAQ).

### Claude's Discretion
- Exact breadcrumb copy and page title patterns in slim top bar.
- Sidebar collapse width/token values and animation timing (must respect reduced motion).
- Compact resume picker UI when multiple unfinished sessions exist.
- `/help` page content depth for MVP (structure and placement are locked; depth can be lightweight).
- Internal module naming while updating `studySetPaths.ts` and dashboard link helpers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and product context
- `.planning/ROADMAP.md` — Phase 7 goal and dependencies (Phase 6)
- `.planning/PROJECT.md` — product scope, keyboard-first quiz, immediate save constraints
- `.planning/REQUIREMENTS.md` — existing CORE/DASH requirements to preserve
- `docs/pipeline.md` — ingest → canonical → generate pipeline (wizard must reuse this)

### Current route and navigation code (migration targets)
- `src/lib/routes/studySetPaths.ts` — canonical path helpers to replace
- `src/lib/dashboard/studySetDashboardLinks.ts` — dashboard card/play/editor links
- `next.config.ts` — legacy redirects to delete
- `src/components/layout/AppShell.tsx` — current study-mode detection
- `src/components/layout/AppTopBar.tsx` — current top-heavy chrome to refactor
- `src/components/dashboard/DashboardHomeClient.tsx` — library + card navigation
- `src/components/dashboard/DashboardMobileBottomNav.tsx` — mobile nav to realign

### Design and voice (Phase 6 carry-forward)
- `TASTE.md` — Chaos Study Mode; workflow clean, personality chaotic
- `.planning/phases/06-bilingual-en-vi-language-selector-and-reusable-contextual-sl/06-UI-SPEC.md` — selector geometry, copy hierarchy (apply to new shell)
- `src/lib/locale/messages.ts` — navigation strings to extend for new IA labels

### Architecture maps
- `.planning/codebase/STRUCTURE.md` — app route layout
- `.planning/codebase/ARCHITECTURE.md` — pipeline and client/server boundaries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/routes/studySetPaths.ts` — centralize new path builders here (rename/expand rather than scatter hrefs).
- `src/lib/dashboard/studySetDashboardLinks.ts` — update `openEditorHref`, `playHref`, `reviewMistakesHref` to new overview/results/drill routes.
- `src/components/layout/AppShell.tsx` — already detects study mode via pathname regex; extend for sidebar force-hide rules.
- `src/components/layout/CommandPalette.tsx` + `LibrarySearchContext` — global search can move to slim top bar.
- `src/components/locale/*` — EN/VI navigation labels for new sidebar items.
- Shared processing components from Phase 6 (`ConversionProgressShell`, ingest/canonicalize/generate cards) — embed in create wizards.

### Established Patterns
- App Router route groups under `src/app/(app)/`.
- `setId` is UUID throughout Supabase `study_sets` — URL param name should be `[setId]` consistently.
- Quiz mistakes currently use `?review=mistakes` on play route — replace with `/drill-mistake` dedicated route.
- Dashboard library already has client-side `filter`/`sort` hooks (`useDashboardHome`) — promote filter state to URL query sync.

### Integration Points
- All `Link`/`router.push` call sites referencing `/edit/*`, `/sets/*`, `/flashcards/*`.
- `next.config.ts` redirects — remove after hard cutover.
- Layout composition: `(app)/layout.tsx` becomes sidebar-primary wrapper.
- Session resume + mistake filtering need server-backed queries (activity/wrong-history tables from prior phases).
- Tests: `src/lib/locale/coverage.test.ts` and any route/link unit tests must be updated for new paths.

</code_context>

<specifics>
## Specific Ideas

User-provided IA sketch (locked):

```txt
/create
  ├─ Quiz → /quiz/create → review → edit → play → results
  └─ Flashcards → /flashcard/create → review → edit → play → results
```

Sidebar sections:

```txt
MAIN: Dashboard, Create new
LIBRARY: All sets, Quizzes, Flashcards
PRACTICE: Continue studying, Mistake drills
ACCOUNT: Settings, Help
Bottom: avatar, name, plan/usage
```

Behavior highlights:
- Active nav item clearly highlighted.
- “Create new” primary coral button.
- Quizzes/Flashcards filter library, not separate dashboards.
- Collapsed sidebar acceptable on conversion/create wizard contexts; user toggle also supported.
- Play/drill sessions hide all chrome for focus.

</specifics>

<deferred>
## Deferred Ideas

- Merge review and edit into a single workspace with tabs (acceptable future simplification; explicitly out of scope for Phase 7 MVP).
- Hamburger drawer as primary mobile navigation (rejected).
- Backward-compatible redirects for legacy bookmarks (rejected — hard cutover).
- Persisting library filter in localStorage (rejected — URL is source of truth).

</deferred>

---

*Phase: 07-normalize-app-information-architecture-around-setid-based-qu*
*Context gathered: 2026-07-26*
