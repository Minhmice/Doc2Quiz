---
phase: 03-canonical-knowledge
plan: 03
subsystem: ui
tags: [react-markdown, remark-gfm, canonical-preview, sonner]

requires:
  - phase: 03-canonical-knowledge
    plan: 02
    provides: POST/GET canonical API routes and runCanonicalize service
provides:
  - Canonical preview page at /sets/[id]/source with auto-canonicalize
  - Six canonical UI components per UI-SPEC
  - Client helpers postCanonicalize and fetchCanonicalPreview
  - Scoped d2q-prose markdown rendering without typography plugin
affects: [04-quiz-pipeline, mode-selection UI]

tech-stack:
  added: [react-markdown, remark-gfm]
  patterns: [auto-canonicalize with Strict Mode ref guard, UI-SPEC state machine, scoped d2q-prose]

key-files:
  created:
    - src/lib/client/canonicalizeStudySet.ts
    - src/components/canonical/CanonicalPreviewHeader.tsx
    - src/components/canonical/CanonicalMetadataChips.tsx
    - src/components/canonical/CanonicalMarkdownViewer.tsx
    - src/components/canonical/CanonicalSectionToc.tsx
    - src/components/canonical/CanonicalizeProgressCard.tsx
    - src/components/canonical/CanonicalNextStepPlaceholder.tsx
  modified:
    - src/app/(app)/sets/[id]/source/page.tsx
    - src/app/globals.css
    - package.json

key-decisions:
  - "useParams for client page id — matches other sets/[id] client routes"
  - "Section-based markdown render with section-{ordinal} anchors for TOC scroll"
  - "MathJax deferred — plain text fallback acceptable for Phase 3"

patterns-established:
  - "Pattern: canonicalizeStartedRef prevents double POST on React Strict Mode remount"
  - "Pattern: preview data via fetchCanonicalPreview API, meta via Supabase for pipeline_stage"
  - "Pattern: d2q-prose scoped typography without @tailwindcss/typography"

requirements-completed: [CANON-01, CANON-02, CANON-03, CANON-04, CANON-05, CANON-06, CANON-07]

duration: 25min
completed: 2026-07-25
---

# Phase 3 Plan 03: Canonical Preview UI Summary

**Read-only canonical preview at `/sets/[id]/source` with auto-canonicalize on raw stage, metadata chips, section TOC, and Phase 4 placeholder CTA**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-25T06:36:00Z
- **Completed:** 2026-07-25T07:01:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Replaced legacy source page redirect with full canonical preview state machine (D-09)
- Auto-POST canonicalize when `pipeline_stage=raw` with progress UI and Strict Mode guard (D-10)
- Read-only markdown viewer with metadata chips, optional TOC, and disabled mode-selection CTA (D-11)
- Client API helpers mirroring ingest fetch patterns with network error mapping

## Task Commits

1. **Task 1: Client API helpers + markdown dependencies** — `042adc3` (feat)
2. **Task 2: Canonical preview components (UI-SPEC)** — `28e2d15` (feat)
3. **Task 3: Replace source page — state machine + auto-canonicalize** — `7b32b9f` (feat)

## Files Created/Modified

- `src/lib/client/canonicalizeStudySet.ts` — postCanonicalize, fetchCanonicalPreview, typed payloads
- `src/components/canonical/CanonicalPreviewHeader.tsx` — eyebrow, H1, subcopy, chips row
- `src/components/canonical/CanonicalMetadataChips.tsx` — Language, Content, Sections badges
- `src/components/canonical/CanonicalMarkdownViewer.tsx` — react-markdown + remark-gfm, section anchors
- `src/components/canonical/CanonicalSectionToc.tsx` — desktop sidebar, mobile collapsible TOC
- `src/components/canonical/CanonicalizeProgressCard.tsx` — building/error progress card
- `src/components/canonical/CanonicalNextStepPlaceholder.tsx` — disabled Phase 4 CTA footer
- `src/app/(app)/sets/[id]/source/page.tsx` — full state machine, auto-canonicalize, preview layout
- `src/app/globals.css` — scoped `d2q-prose` typography utilities
- `package.json` — react-markdown, remark-gfm

## Decisions Made

- Used `useParams()` instead of async page params prop — consistent with other client routes in `sets/[id]/`
- Render markdown per-section when sections exist for TOC anchor targets
- MathJax wiring deferred; formulas render as plain text in Phase 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Canonicalize on the preview page requires AI provider env vars when auto-triggering from raw stage:
- `AI_PROVIDER_URL`
- `AI_PROVIDER_KEY`

## Next Phase Readiness

- Phase 4 can wire "Choose learning mode" CTA and mode-selection flow
- Preview page is post-ingest landing surface — user reviews canonical output before mode choice
- Manual smoke: ingest → `/sets/{id}/source` → progress → preview with chips and markdown

## Self-Check: PASSED

- FOUND: src/lib/client/canonicalizeStudySet.ts
- FOUND: src/components/canonical/CanonicalMarkdownViewer.tsx
- FOUND: src/components/canonical/CanonicalizeProgressCard.tsx
- FOUND: src/app/(app)/sets/[id]/source/page.tsx
- FOUND: 042adc3
- FOUND: 28e2d15
- FOUND: 7b32b9f

---
*Phase: 03-canonical-knowledge*
*Completed: 2026-07-25*
