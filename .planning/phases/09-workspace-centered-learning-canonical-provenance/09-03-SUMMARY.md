---
phase: 09-workspace-centered-learning-canonical-provenance
plan: 03
subsystem: api
tags: [canonical, provenance, checksum, pagination, IntersectionObserver, workspace]

requires:
  - phase: 09-01
    provides: persist_canonical_version RPC, checksum helpers, canonical_version_sections
  - phase: 09-02
    provides: workspace document versions and authenticated write patterns
provides:
  - Append-only workspace-native runCanonicalVersion with redacted provenance
  - Metadata and bounded section-page reader APIs (limit clamp 1–50)
  - Progressive CanonicalMarkdownViewer with IntersectionObserver + Load more
affects:
  - 09-04/09-05 multi-source generation selection by canonical version ID
  - 09-06 workspace detail UI
  - 09-07/09-08 legacy adapters (replace_canonical_content remains legacy-only)

tech-stack:
  added: []
  patterns:
    - Validate AI/heuristic output before persist_canonical_version only
    - Metadata endpoint returns headings/ordinals; bodies via paginated sections
    - Client page cache clamp + unmount far ReactMarkdown bodies
    - IntersectionObserver sentinel with accessible Load more fallback

key-files:
  created:
    - src/lib/pipeline/canonicalVersion.ts
    - src/lib/pipeline/canonicalVersion.test.ts
    - src/lib/workspaces/canonicalReader.ts
    - src/lib/workspaces/canonicalReader.test.ts
    - src/lib/client/canonicalReader.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route.ts
    - src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route.test.ts
    - src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/route.ts
    - src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/route.test.ts
    - src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/sections/route.ts
  modified:
    - src/components/canonical/CanonicalMarkdownViewer.tsx
    - src/components/canonical/CanonicalSourceReview.tsx

key-decisions:
  - "CANONICAL_PARSER_VERSION = 1.0 for workspace-native parser identity"
  - "Deleted document versions remain readable for historical canonical snapshots"
  - "Legacy CanonicalSourceReview preview path preserved; progressive props optional"
  - "No virtualization package; IntersectionObserver + page cache only"

patterns-established:
  - "Never call replace_canonical_content on workspace-native path"
  - "Reader responses omit raw_markdown / full canonical_markdown / all bodies"
  - "Dedupe in-flight section fetches by versionId:afterOrdinal"

requirements-completed: [WORK-04, WORK-05, WORK-08, WORK-09]

duration: 25min
completed: 2026-07-30
---

# Phase 09: Plan 03 Summary

**Append-only canonical versions with checksum provenance and progressive paginated section reader**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-30T06:09:00+07:00
- **Completed:** 2026-07-30T06:18:00+07:00
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- `runCanonicalVersion` appends immutable versions via `persist_canonical_version` with dual checksums and secret-free provenance
- Authenticated canonicalize + metadata + section-page routes with 400/403/404/422/503 contracts
- Progressive viewer loads bounded pages, caches ≤5 pages, unmounts far markdown bodies, Load more fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: append-only canonical version service** - `cdb2a90` (feat)
2. **Task 2: canonical version and bounded reader APIs** - `ed7db67` (feat)
3. **Task 3: progressive canonical section reader UI** - `e343730` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `src/lib/pipeline/canonicalVersion.ts` — workspace-native append-only canonicalize
- `src/lib/workspaces/canonicalReader.ts` — metadata + section page services
- `src/app/api/workspaces/**/canonicalize` / `canonical-versions/**` — routes + tests
- `src/lib/client/canonicalReader.ts` — browser metadata/section/canonicalize clients
- `CanonicalMarkdownViewer.tsx` / `CanonicalSourceReview.tsx` — progressive + legacy paths

## Decisions Made
- Parser identity constant `CANONICAL_PARSER_VERSION` separate from prompt version
- Soft-deleted source versions still serve historical canonical reads; active selection excludes them elsewhere
- Legacy study-set `preview` prop kept on CanonicalSourceReview for adapters

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule — Adaptation] Map editor/viewer via workspace errors**
- **Found during:** Task 2
- **Issue:** Plan validation errors alone cannot express 403 vs 404 for membership
- **Fix:** `runCanonicalVersion` throws `WorkspaceForbiddenError` / `WorkspaceNotFoundError` for role/access; routes map 403/404
- **Files modified:** `canonicalVersion.ts`, canonicalize route
- **Verification:** canonicalize route tests cover 403/404
- **Committed in:** `ed7db67`

**2. [Rule — Intent] Legacy preview path retained on CanonicalSourceReview**
- **Found during:** Task 3
- **Issue:** Flashcard review still uses study-set `CanonicalPreviewData`
- **Fix:** Added optional `progressive` props; legacy `preview` unchanged
- **Files modified:** `CanonicalSourceReview.tsx`
- **Verification:** existing flashcard review import still typechecks
- **Committed in:** `e343730`

---

**Total deviations:** 2 auto-fixed (1 adaptation, 1 intent)
**Impact on plan:** Required for HTTP contracts and non-breaking legacy UI; no scope creep.

## Self-Check

- [x] `src/lib/pipeline/canonicalVersion.ts` exists
- [x] `src/lib/workspaces/canonicalReader.ts` exists
- [x] `src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/sections/route.ts` exists
- [x] Progressive viewer uses IntersectionObserver (no new virtualization deps)
- [x] Task commits present on branch
- [x] Tests: canonicalVersion + canonicalReader + canonical-versions routes pass (20/20 in plan verify set; 27 including canonicalize route)

**Self-Check: PASSED**

## Issues Encountered
- Pre-existing `src/app/api/usage/route.ts` TS2589 typecheck failure unrelated to 09-03 (same as 09-02)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 09-04 multi-source quiz generation selecting canonical version IDs
- Progressive reader client ready for workspace detail UI in 09-06
- Legacy `replace_canonical_content` / study-set canonicalize remain for adapters

---
*Phase: 09-workspace-centered-learning-canonical-provenance*
*Completed: 2026-07-30*
