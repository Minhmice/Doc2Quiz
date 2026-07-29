# Phase 9 Validation Matrix — Workspace-Centered Learning & Canonical Provenance

**Phase:** 09-workspace-centered-learning-canonical-provenance  
**Revision:** 3  
**Scope:** WORK-01–09 only. No Phase 10 invitation, sharing, public-link, anonymous, or friend workflows.

## Ownership by Wave

| Wave | Plan | Validation ownership | Automated command |
|---|---|---|---|
| 1 | 09-01 | Checksum contract, migration backfill, output bridge, RLS | `npm run test -- src/lib/provenance/checksum.test.ts --run` and `supabase db reset && supabase test db` |
| 2 | 09-02 | First ingest, document lifecycle, workspace write routes | `npm run test -- src/lib/workspaces/createWorkspaceIngest.test.ts src/lib/workspaces/documentVersions.test.ts src/app/api/workspaces --run` |
| 3 | 09-03 | Canonical append contract, reader APIs, progressive reader | `npm run test -- src/lib/pipeline/canonicalVersion.test.ts src/lib/workspaces/canonicalReader.test.ts src/app/api/workspaces/[workspaceId]/canonical-versions --run` |
| 4 | 09-04 | Quiz multi-source selection, frozen snapshots, quiz bridge | `npm run test -- src/lib/provenance/outputSnapshot.test.ts src/lib/pipeline/multiSourceGenerate.test.ts src/app/api/workspaces/[workspaceId]/outputs/quiz/route.test.ts src/app/api/study-sets/[id]/quiz/generate/route.test.ts --run` |
| 5 | 09-05 | Flashcard parity, frozen snapshots, and flashcard bridge | `npm run test -- src/lib/pipeline/flashcardMultiSourceGenerate.test.ts src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.test.ts src/app/api/study-sets/[id]/flashcards/generate/route.test.ts --run` |
| 6 | 09-06 | Workspace summaries, detail API, and dashboard navigation | `npm run test -- src/lib/workspaces/workspaceSummary.test.ts src/app/api/workspaces/route.test.ts src/app/api/workspaces/[workspaceId]/route.test.ts --run` |
| 7 | 09-07 | Legacy non-flashcard adapter behavior | `npm run test -- src/lib/workspaces/legacyBridge.test.ts src/app/api/study-sets/[id]/route.test.ts src/app/api/study-sets/[id]/canonical/route.test.ts src/app/api/study-sets/[id]/ingest/route.test.ts src/app/api/study-sets/[id]/canonicalize/route.test.ts src/app/api/study-sets/[id]/quiz/generate/route.test.ts --run` |
| 8 | 09-08 | Legacy flashcard adapter behavior | `npm run test -- src/lib/workspaces/legacyBridge.test.ts src/app/api/study-sets/[id]/flashcards/generate/route.test.ts --run` |
| 9 | 09-09 | SQL/static compatibility audit and all final gates | `npm run verify:phase9-workspace && npm run typecheck && npm run lint && npm run test -- --run && npm run build` |

## Requirements to Tests

| Requirement | Automated proof | Owner | Manual proof |
|---|---|---|---|
| WORK-01 | First valid ingest creates workspace, owner membership, document, and version; invalid input performs no RPC/storage work. | 09-02 | Upload from `/create`; no title prompt; derived workspace title appears. |
| WORK-02 | Summary/detail route returns only readable active workspaces, aggregate counts, documents, versions, outputs, and no canonical body markdown; dashboard card reaches detail. | 09-06 | Open dashboard card; navigate document/version reader, output overview, and practice. |
| WORK-03 | Replacement appends `N+1`; metadata patch has no source fields; backfill preserves versions. | 09-01, 09-02 | Rename/edit metadata then replace source; confirm separate immutable version. |
| WORK-04 | Checksum tests enforce D-02 bytes; canonicalization appends versions and persists model/prompt/parser/settings/checksums. | 09-01, 09-03 | Canonicalize same document version twice; compare version/provenance/date labels. |
| WORK-05 | Reader metadata excludes raw/full markdown; slices enforce ordered cursor and 1–50 limit. | 09-03 | Scroll/load more; confirm progressive sections and accessible fallback. |
| WORK-06 | Quiz/flashcard reject empty, duplicate, incomplete, deleted, cross-workspace selections; selected source IDs only. | 09-04, 09-05 | Select two completed canonical versions, then generate each output kind. |
| WORK-07 | Output RPC atomically creates output-specific bridge set, frozen snapshots, and item `study_set_id`/`output_id`; returned bridge preserves quota/session/mistake semantics. | 09-01, 09-04, 09-05 | Open generated output using current setId route after source deletion. |
| WORK-08 | Soft-deleted source vanishes from active lists/selection while output snapshot remains readable and studyable. | 09-02, 09-05, 09-06, 09-08, 09-09 | Soft-delete selected source; reopen output and study it. |
| WORK-09 | SQL owner/editor/viewer/nonmember matrix and route tests deny direct membership escalation; readable/mutable scopes match role. | 09-01, 09-07, 09-08, 09-09 | Confirm no invitation, public-link, anonymous, or member-management surface exists. |

## Locked Contract Tests

### D-01 — Output bridge and dual-mode legacy backfill

`supabase/tests/workspace_rls.sql` must seed a legacy `study_sets` fixture with both question and flashcard banks and assert:

1. Backfill creates two distinct `learning_outputs`, one `quiz` and one `flashcards`.
2. Each output receives one distinct compatible bridge `study_sets` row and unique `learning_outputs.legacy_study_set_id`.
3. Original legacy study set remains retained as immutable parent/reference, never reused as either output bridge.
4. Every quiz/card item carries matching bridge `study_set_id` and `output_id`; no output has mixed item kinds.
5. No legacy `quota_consumptions`, `study_sessions`, or `study_mistakes` row is duplicated, rewritten, or rekeyed: historic rows remain on original parent `study_sets.id`, and both derived outputs retain that ID as immutable `legacy_parent_study_set_id`.
6. Resolver contract is deterministic: output-specific bridge ID reads resolve current bridge/output first and never fall back to parent history; historic parent ID requires route kind and selects only quiz child for quiz route or flashcard child for flashcard route while exposing historic records by parent lookup only.
7. New workspace-native output records allocate one bridge and persist all new quota/session/mistake relationships on that bridge ID; no new bridge record may read parent history.
8. Nonmembers cannot resolve either historic parent or output-specific bridge, and parent/bridge lookup cannot cross workspace membership.
9. New `create_learning_output` rollback leaves no bridge, output, snapshot, or item rows after any validation/cardinality failure.

### D-02 — Checksum bytes

`src/lib/provenance/checksum.test.ts` must assert:

1. Markdown with LF, CRLF, and CR yields identical lowercase SHA-256 after normalization.
2. Leading/trailing whitespace changes digest; no trimming occurs.
3. `canonical_content_checksum` excludes provenance metadata.
4. `sections_checksum` serializes ordered tuples with exact field order `ordinal`, `section_key`, `heading`, `section_type`, `body_markdown`.
5. Reordering tuples or changing any listed field changes digest; metadata does not.

### D-03 — Canonical rerun and source selection

`canonicalVersion.test.ts`, reader route tests, and generation route tests must assert:

1. Every canonical rerun appends an immutable new version for same document version.
2. Reader metadata returns version number, provenance/model-prompt-parser identity, and creation date.
3. Generation requires explicit selected completed IDs; after user selection, no service/adapter resolves mutable latest.
4. UI may visibly preselect latest completed version only when no prior selection exists, and user can change it.

## RLS and Backfill Gate

Run after Wave 1 and again in Wave 6:

```bash
supabase db reset && supabase test db
```

SQL checks must cover auth-null denial, owner/editor/viewer/nonmember read/write matrix, no direct membership mutation, hardened helper grants/search path, legacy cardinality, canonical section parity, dual-mode split, bridge/item mapping, and snapshot-or-explicit-exception coverage.

## Final Automated Gate

```bash
supabase db reset && supabase test db && npm run verify:phase9-workspace && npm run typecheck && npm run lint && npm run test -- --run && npm run build
```

`verify:phase9-workspace` runs static adapter audit plus focused bridge behavior tests. It must reject retained adapters that bypass `resolveLegacyStudySetBridge`, invoke mutable canonical/replace RPCs, alter legacy response contracts, authorize without membership scope, select unrequested sources, or lose quota/session/mistake/snapshot-study behavior.

## Human Verification

After automated gate passes:

1. Upload source from `/create`; confirm auto-created workspace and no naming prompt.
2. Rename workspace and edit document metadata; replace source; confirm metadata remains and new document version exists.
3. Canonicalize twice; check version/provenance/date labels; use progressive reader.
4. Generate quiz and flashcards from explicit completed-version selections; confirm setId overview/practice routes work.
5. Soft-delete selected source; confirm output stays studyable from frozen snapshot and dashboard counts remain correct.
6. Confirm absent Phase 10 UI: no invitations, public links, anonymous study, friends, blocks, or reports.
