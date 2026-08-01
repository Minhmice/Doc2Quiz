---
quick_task: 260731-0t1-rebuild-dashboard-as-workspace-only-dash
type: execute
autonomous: true
files_modified:
  - src/hooks/useDashboardHome.ts
  - src/components/dashboard/workspaceDashboardModel.ts
  - src/components/dashboard/workspaceDashboardModel.test.ts
  - src/components/dashboard/DashboardHomeClient.tsx
  - src/components/dashboard/DashboardHero.tsx
  - src/components/dashboard/DashboardLibraryHeader.tsx
  - src/components/layout/AppTopBar.tsx
  - src/lib/locale/types.ts
  - src/lib/locale/messages.ts
  - src/lib/locale/coverage.test.ts
  - src/components/dashboard/DashboardLibraryClient.tsx
must_haves:
  truths:
    - "Dashboard presents workspaces only; no study-set card or mixed-entity language remains on dashboard surface."
    - "User sees one primary Continue studying action, with Review pending and New workspace as secondary actions."
    - "Every workspace card reports Sources, Quiz, Flashcards, Last activity, one of Processing/Ready/Needs review/Empty, and Open workspace."
    - "Search, filter, sort, cache revalidation, loading, retry, no-results, empty-workspace, responsive, keyboard, and screen-reader behavior remain available."
    - "Desktop workspace list never exceeds three columns."
  artifacts:
    - path: "src/components/dashboard/workspaceDashboardModel.ts"
      provides: "WorkspaceCardModel, WorkspaceStatus, workspaceDashboardLinks, status derivation, and resume recommendation contracts"
    - path: "src/hooks/useDashboardHome.ts"
      provides: "coherent useDashboardData/useWorkspaceFilters/useResumeRecommendation dashboard logic"
    - path: "src/components/dashboard/DashboardHomeClient.tsx"
      provides: "workspace-only dashboard composition and workspace cards"
    - path: "src/components/dashboard/workspaceDashboardModel.test.ts"
      provides: "deterministic status, links, filtering/sorting, and resume recommendation checks"
  key_links:
    - from: "src/hooks/useDashboardHome.ts"
      to: "src/lib/client/workspaceApi.ts"
      via: "useDashboardData fetches and revalidates workspace summaries while retaining appDataCache behavior"
    - from: "src/components/dashboard/DashboardHomeClient.tsx"
      to: "src/components/dashboard/workspaceDashboardModel.ts"
      via: "cards and hero consume shared workspace models and links rather than study-set routes"
    - from: "src/components/layout/AppTopBar.tsx"
      to: "src/components/layout/LibrarySearchContext.tsx"
      via: "existing shared search state receives workspace-specific accessible copy"
---

<objective>
Rebuild `/dashboard` as a workspace-only re-entry surface.

Purpose: Match current workspace domain, prioritize returning to study, and remove legacy study-set hierarchy without weakening dashboard resilience.
Output: Shared workspace dashboard contract, decomposed state logic, compact hero, three-column workspace cards, workspace-specific copy, and targeted tests.
</objective>

<execution_context>
@PRODUCT.md
@DESIGN.md
@TASTE.md
@src/app/(app)/dashboard/page.tsx
@src/app/(app)/dashboard/loading.tsx
@src/lib/workspaces/workspaceSummary.ts
@src/lib/client/appDataCache.ts
@src/lib/client/workspaceApi.ts
</execution_context>

<context>
Locked product decisions:
- Dashboard models only workspaces.
- Rename dashboard/library language to Workspaces, Search workspaces, and New workspace.
- Hero height drops about 40%; Continue studying is sole primary CTA; Review pending and New workspace remain secondary.
- Cards show Sources, Quiz, Flashcards, Last activity; omit Canonical and repeated owner role; status is Processing, Ready, Needs review, or Empty; primary action is Open workspace.
- Desktop grid is exactly up to three columns, never four.
- Preserve search/filter/sort, cache, loading/error/empty behavior, responsive behavior, and accessibility.
- Follow product register: precise, calm, instrument-like, flat surfaces, strong hierarchy, no gradients, decorative glass, wide card shadows, oversized rounding, or gratuitous motion.

<interfaces>
Existing source contract from `src/lib/workspaces/workspaceSummary.ts`:
- `WorkspaceSummary`: `id`, `title`, `subtitle`, `role`, `createdAt`, `updatedAt`, `documentCount`, `canonicalVersionCount`, `quizOutputCount`, `flashcardOutputCount`, `recentOutputs`.
- `RecentOutputSummary`: `kind`, `status`, `updatedAt`, `bridgeStudySetId` and output identity fields.

Existing dashboard data path from `src/hooks/useDashboardHome.ts`:
- `fetchWorkspaceSummaries()` and `getActivityStats()` load in parallel.
- `getDashboardCache`/`setDashboardCache` provide stale-while-revalidate behavior.
- app activity and study-set-list events invalidate and refresh cache.
- top-bar `LibrarySearchContext` search and URL query state both contribute to filtering.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Establish workspace dashboard contracts and focused logic</name>
  <files>src/components/dashboard/workspaceDashboardModel.ts, src/components/dashboard/workspaceDashboardModel.test.ts, src/hooks/useDashboardHome.ts</files>
  <behavior>
    - A workspace with active/in-flight recent output status is Processing; completed output is Ready; canonical content without usable output is Needs review; no source/content/output is Empty.
    - Status precedence is explicit and tested for mixed recent-output states; unknown output statuses cannot silently become Ready.
    - WorkspaceCardModel exposes title/subtitle, source/quiz/flashcard counts, formatted activity input, status, and `Open workspace` URL; it excludes canonical count and owner badge presentation.
    - Resume recommendation selects most recently active playable workspace/output and returns null when nothing is playable.
    - Search checks title and subtitle; status filters and recent/title sort remain deterministic.
  </behavior>
  <action>Create `WorkspaceStatus`, `WorkspaceCardModel`, and `workspaceDashboardLinks` in `workspaceDashboardModel.ts`. Keep all workspace URL construction there: workspace open route plus quiz/flashcard resume route from `bridgeStudySetId`. Add pure builders/selectors for card model, status, filters/sort, and resume recommendation so tests do not need React rendering. Derive status only from fields available in `WorkspaceSummary`; document exact output-status vocabulary found in current data producers before mapping Processing/Ready, and treat canonical-without-ready-output as Needs review and truly blank workspace as Empty.

Refactor `useDashboardHome.ts` into coherent internal hooks/functions named `useDashboardData`, `useWorkspaceFilters`, and `useResumeRecommendation` (or exported equivalents if useful), retaining `useDashboardHome` as compatibility orchestration when that avoids unrelated caller churn. `useDashboardData` owns fetch/cache/event refresh/loading/error/revalidating. `useWorkspaceFilters` owns URL params, shared top-bar search, status filtering, and sorting. `useResumeRecommendation` owns Continue studying and Review pending recommendations. Remove legacy study-set counts/mistakes and unsupported type/practice filtering from dashboard return shape only after confirming no live caller needs them; preserve existing query parsing where bookmarked URLs require graceful fallback rather than breakage. No new dependency.</action>
  <verify>
    <automated>npm test -- --run src/components/dashboard/workspaceDashboardModel.test.ts</automated>
  </verify>
  <done>Pure tests prove all four statuses, workspace links, resume choice, search/filter/sort behavior, and empty cases; dashboard hook exposes workspace-only models while cache refresh and errors keep existing behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Recompose hero and workspace grid</name>
  <files>src/components/dashboard/DashboardHomeClient.tsx, src/components/dashboard/DashboardHero.tsx, src/components/dashboard/DashboardLibraryHeader.tsx</files>
  <action>Replace inline `WorkspaceSummary` card logic in `DashboardHomeClient` with rendering from shared `WorkspaceCardModel`. Card hierarchy: status text with non-color cue, workspace title and optional subtitle, compact four-item metadata for Sources, Quiz, Flashcards, Last activity, then a clear `Open workspace` action. Remove Canonical, aggregate output prose, and role/owner badge. Keep semantic heading order, visible focus, at least 44px touch targets where interactive, no nested interactive whole-card click target, and status meaning independent of color. Use flat card/ring treatment from DESIGN.md; no gradient, backdrop blur, decorative shadow, or animation.

Rework `DashboardHero` to consume workspace/resume recommendation terms, reduce vertical footprint about 40% through smaller fixed product typography, tighter padding/gaps, and removal of oversized marketing treatment. Render exactly one high-emphasis `Continue studying` CTA when a resume target exists; render `Review pending` and `New workspace` as lower-emphasis text/outline actions. For no resume target, preserve honest empty guidance and make New workspace reachable without inventing a misleading Continue target. Keep display-name prompt functional but compact and subordinate.

Rename `DashboardLibraryHeader` surface semantics to Workspaces and workspace status filters. Preserve controlled filter and sort behavior. In `DashboardHomeClient`, rename anchor/ARIA semantics from library to workspaces while accepting legacy `#library` hash as a compatibility alias if existing links use it. Use `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`; remove every four-column breakpoint. Preserve retry alert, loading status/skeleton contract, zero-workspace CTA, filtered/search no-results copy, mobile spacing, and keyboard/screen-reader semantics.</action>
  <verify>
    <automated>npm run lint -- --file src/components/dashboard/DashboardHomeClient.tsx --file src/components/dashboard/DashboardHero.tsx --file src/components/dashboard/DashboardLibraryHeader.tsx</automated>
  </verify>
  <done>Dashboard shows only workspace cards and requested metadata/status/actions; hero hierarchy matches locked CTA rules at materially reduced height; wide desktop tops out at three columns; all prior state branches remain explicit and accessible.</done>
</task>

<task type="auto">
  <name>Task 3: Align localized shell copy and retire dead legacy dashboard code</name>
  <files>src/components/layout/AppTopBar.tsx, src/lib/locale/types.ts, src/lib/locale/messages.ts, src/lib/locale/coverage.test.ts, src/components/dashboard/DashboardLibraryClient.tsx</files>
  <action>Change dashboard-facing English and Vietnamese message contracts from study-set/library language to workspace language: Workspaces, Search workspaces, New workspace, Continue studying, Review pending, card metrics/status/action labels, loading/error/empty/no-match copy, filter ARIA, and workspace counts. Rename message keys where practical so identifiers no longer encode obsolete study-set semantics; update `AppTopBar` to consume the workspace search labels. Limit copy changes to dashboard and dashboard-specific shell navigation; do not rename legitimate Library wording inside quiz/flashcard/workspace-detail flows outside this domain.

Run an exact import/reference search for `DashboardLibraryClient`. Current evidence shows no runtime import and only locale coverage naming it. If still runtime-unused, delete `DashboardLibraryClient.tsx` and update `locale/coverage.test.ts` to assert localization on the replacement dashboard client. If a runtime importer appears during execution, keep the file and update only its shared type imports as required; do not delete code still imported. Do not delete `DashboardStudySetCard` or its model/tests unless a separate repository-wide reference check proves they are unused outside this quick task; avoiding unrelated cleanup is preferred.</action>
  <verify>
    <automated>npm test -- --run src/components/dashboard/workspaceDashboardModel.test.ts src/lib/locale/coverage.test.ts &amp;&amp; npm run lint -- --file src/hooks/useDashboardHome.ts --file src/components/dashboard/workspaceDashboardModel.ts --file src/components/dashboard/workspaceDashboardModel.test.ts --file src/components/dashboard/DashboardHomeClient.tsx --file src/components/dashboard/DashboardHero.tsx --file src/components/dashboard/DashboardLibraryHeader.tsx --file src/components/layout/AppTopBar.tsx --file src/lib/locale/types.ts --file src/lib/locale/messages.ts --file src/lib/locale/coverage.test.ts &amp;&amp; npm run typecheck</automated>
  </verify>
  <done>Dashboard and top-bar copy consistently describe workspaces in both locales, targeted model/locale tests pass, changed files lint, TypeScript passes, and `DashboardLibraryClient` is removed only when no runtime import remains.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Workspace API → dashboard client | Membership-authorized server summaries become rendered user content and navigation targets. |
| URL/search input → filtering/history | Untrusted query and typed search values affect selection and browser URL state. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QD-01 | Information disclosure | `WorkspaceCardModel` / dashboard cards | mitigate | Render aggregate counts and supplied title/subtitle only; do not add canonical/raw body content or ownership details. |
| T-QD-02 | Tampering | URL filter/sort params | mitigate | Parse through explicit unions and fall back to safe defaults; never interpolate query values into routes. |
| T-QD-03 | Spoofing | workspace/output navigation | mitigate | Build links only from IDs in membership-authorized `WorkspaceSummary`; authorization remains enforced by destination routes. |
| T-QD-SC | Tampering | package supply chain | accept | No package install or dependency change planned. |
</threat_model>

<verification>
1. Run focused model and locale tests, targeted ESLint, then TypeScript command from Task 3.
2. Search changed dashboard/shell files for user-visible `Library`, `Your library`, `study set`, `Create new set`, `Canonical`, `owner`, and `2xl:grid-cols-4`; allow only deliberate legacy compatibility identifiers/anchors or comments.
3. Inspect `/dashboard` with populated, processing, needs-review, and empty workspace fixtures at mobile, tablet, and wide desktop widths. Confirm one/two/three columns, never four; keyboard focus order; labelled filters/search; non-color status labels; retry and no-result states.
4. Confirm cache-hit render followed by background refresh still avoids blanking existing workspace cards, and failed refresh preserves clear recovery behavior.
</verification>

<success_criteria>
- Dashboard domain uses workspace data and workspace language end to end.
- Hero is roughly 40% shorter and has one primary Continue studying CTA, with Review pending/New workspace secondary.
- Cards expose exactly requested workspace facts and all four statuses, with Open workspace as primary action.
- Existing search/filter/sort/cache/loading/error/empty/responsive/a11y contracts survive.
- Desktop grid tops out at three columns.
- Logic boundaries and shared contracts are named, pure where possible, and covered by focused tests.
- No dead component is deleted while imported; no unrelated legacy study flow is renamed or removed.
</success_criteria>

<output>
Create `.planning/quick/260731-0t1-rebuild-dashboard-as-workspace-only-dash/SUMMARY.md` after execution.
</output>
