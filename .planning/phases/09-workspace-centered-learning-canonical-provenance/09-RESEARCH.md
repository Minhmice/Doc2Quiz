# Phase 9: Workspace-Centered Learning & Canonical Provenance — Research

**Researched:** 2026-07-30
**Domain:** Supabase/Postgres schema migration, immutable source and canonical provenance, multi-source learning generation
**Confidence:** HIGH

## User Constraints

### Locked Decisions
- Never force user to name workspace before first upload; auto-create then rename later.
- A document replacement creates a new document_version. Metadata edits do not replace source material.
- Quiz/flashcard must store canonical_version_id and frozen provenance: model, prompt, parser, generator settings, checksum.
- Canonical content is per document version, not auto-merged. Users select one or more processed canonical documents when generating each output.
- Existing outputs must not change from later document/canonical changes.
- Soft-delete document and canonical versions; preserve old generated output evidence.
- Canonical reader must load/render by sections or pages; do not mount full huge text.
- Owner/editor/viewer data-model distinction begins here; collaboration/link behavior belongs Phase 10.

### Claude's Discretion
- Exact table, endpoint, route, and UI composition that preserves current working study-set behavior during migration.
- Exact checksum serialization and snapshot payload shape.

### Deferred Ideas (OUT OF SCOPE)
- Invitations, membership management UI, public links, anonymous study/import, friends, blocks, reports, and Phase 10 collaboration workflows.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | First uploaded source auto-creates workspace; rename later | Transactional workspace + document creation endpoint; derive initial title from source, PATCH workspace title later. |
| WORK-02 | Dashboard lists workspace contents | Workspace list query with aggregate counts and recent output metadata; replace N+1 browser reads. |
| WORK-03 | Immutable document versions; metadata edits do not replace source | Separate `documents` identity from append-only `document_versions`; metadata lives on document/workspace. |
| WORK-04 | Canonical version retains reproducibility metadata | Append-only `canonical_versions` plus `canonical_sections`; SHA-256 checksum and structured JSONB provenance. |
| WORK-05 | Progressive canonical reader | Section list metadata plus paginated section-body endpoint; never select `canonical_markdown` in reader/list queries. |
| WORK-06 | Multi-source generation selection | Generation request accepts completed `canonical_version_ids[]`; server validates common readable workspace and deduplicates IDs. |
| WORK-07 | Generated outputs retain frozen source snapshots | `output_source_snapshots` copied in same persistence RPC as output/item rows. |
| WORK-08 | Soft delete preserves outputs | `deleted_at` on documents/versions; no cascade from soft-deleted sources to output snapshots. |
| WORK-09 | Owner/editor/viewer data-model distinction | `workspace_members` with role enum/check and owner invariant; RLS helper boundary now, invitation/share UI deferred. |
</phase_requirements>

## Summary

Current system binds one `study_sets` row to one mutable `canonical_documents` row via unique `study_set_id`. Ingest overwrites raw/source fields (`src/lib/pipeline/ingest.ts`); canonicalization replaces content and sections through `replace_canonical_content`; quiz and flashcard generation replace output rows. This directly conflicts with immutable versions, multi-source output, and durable provenance. Existing raw/canonical/output data must migrate as an initial version, not be discarded.

**Primary recommendation:** Introduce workspace and document/version tables beside existing tables, backfill every `study_sets` row into a workspace + document + document version + canonical version + generated output, then move new create/ingest/canonical/generate paths to workspace IDs. Keep legacy `study_sets` IDs as stable output IDs during Phase 9 through a one-to-one bridge. Do not rename or drop legacy tables until every caller, session FK, quota record, and dashboard route is migrated.

Use append-only source and canonical version rows. Generation persists a frozen per-source snapshot at output creation, including canonical text/sections needed to explain output after a source soft-delete. Store immutable provenance as typed columns where queried and JSONB for model/prompt/parser/settings details. SHA-256 is available through installed `pgcrypto`, but compute the canonical serialization in application code before persistence so checksum covers exactly defined bytes. [CITED: https://www.postgresql.org/docs/current/pgcrypto.html]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace/document/version persistence | Database / Storage | API / Backend | Constraints, append-only rows, FKs, and RLS enforce identity and durability. |
| First-upload workspace creation | API / Backend | Browser / Client | Server transaction owns identity creation; browser only submits source and optional intent. |
| Source conversion and canonicalization | API / Backend | Database / Storage | Existing Node pipeline and AI calls remain server-side; results append immutable versions. |
| Frozen generation provenance | Database / Storage | API / Backend | Source snapshots must persist atomically with generated output, not rely on mutable references. |
| Multi-source prompt assembly | API / Backend | Database / Storage | Server authorizes selected canonical versions, fetches ordered sections, records exact input. |
| Canonical progressive reader | Browser / Client | API / Backend | Browser virtualizes/page-loads sections; endpoint exposes small ordered slices. |
| Workspace roles | Database / Storage | API / Backend | Membership relation and RLS decide access; APIs express allowed phase-9 actions. |

## Current Codebase Map

| File | Current role | Phase 9 consequence |
|------|--------------|---------------------|
| `supabase/migrations/20260725120000_v21_baseline.sql` | `study_sets` owns one mutable canonical document and output rows | Existing FKs cascade from set; cannot represent workspace documents/versions. |
| `supabase/migrations/20260729140000_atomic_canonical_replace.sql` | Mutates canonical document, deletes/reinserts sections | Replace with append-only canonical-version persistence RPC. Retire only after callers migrate. |
| `supabase/migrations/20260729120000_atomic_quiz_replace.sql` | Deletes/replaces quiz rows for a study set | New output persistence must create a new output/source snapshot; preserve legacy route during bridge. |
| `src/lib/pipeline/ingest.ts` | Upserts `canonical_documents` on `study_set_id`; paths use `{user}/{studySet}` | Refactor to create a `document_versions` row and immutable storage path `{workspace}/{document}/{version}`. |
| `src/lib/pipeline/canonicalize.ts` | Reads raw markdown, calls AI/heuristic builder, mutates canonical document | Append `canonical_versions` and sections. Persist AI model/config/parser/checksum. |
| `src/lib/pipeline/quizGenerate.ts` | Reads one canonical doc/sections; replaces questions | Accept selected canonical versions and persist per-output frozen sources. |
| `src/lib/pipeline/flashcardGenerate.ts` | Same one-source assumption; destructive cross-mode cleanup | Same multi-source source snapshot flow; do not delete other output type. |
| `src/lib/pipeline/mapQuizOutputToRows.ts` | Per-item JSON source has prompt version and excerpt | Keep item citation data, add immutable `output_id`; authoritative whole-source provenance moves to snapshot table. |
| `src/lib/pipeline/mapFlashcardOutputToRows.ts` | Per-card JSON source has generator context | Same migration pattern. |
| `src/lib/client/ingestStudySet.ts` | Browser creates study set before upload | Replace with one `POST /api/workspaces/ingest` operation; server creates workspace on success path. |
| `src/components/edit/new/import/UnifiedInputZone.tsx` | Drives create → ingest → redirect around study-set ID | Preserve visual component; change client contract to return workspace/document/version and route onward. |
| `src/lib/client/studySetDb.ts` and `src/hooks/useDashboardHome.ts` | Browser direct reads plus per-set N+1 output/mistake queries | Replace with workspace list/read APIs returning aggregate counts and roles. |
| `src/app/api/study-sets/[id]/canonical/route.ts` | Returns entire raw + canonical markdown and all sections | Split reader into version metadata and paginated section endpoint. |
| `src/app/api/study-sets/[id]/route.ts` | Direct metadata PATCH and hard DELETE | Workspace rename stays PATCH; document/version delete becomes soft-delete only. |
| `supabase/migrations/20260726150000_resumable_study_sessions.sql` | Session/mistake FKs reference study sets | Bridge old sets through Phase 9; later migrate sessions to output IDs only after output compatibility routes exist. |

## Standard Stack

### Core

| Library / platform | Version | Purpose | Why standard |
|--------------------|---------|---------|--------------|
| PostgreSQL + Supabase RLS | Existing Supabase CLI `2.109.1` | Versioned relational data, constraints, authorization | Existing database and auth system; RLS policies enforce data boundaries. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| `pgcrypto` | Existing extension | SHA-256 `digest()` available for DB verification/backfill | Already enabled in baseline migration; supports `digest(data, 'sha256')`. [CITED: https://www.postgresql.org/docs/current/pgcrypto.html] |
| `@supabase/supabase-js` | `^2.110.8` installed | Existing authenticated database/storage client | No dependency change required. [VERIFIED: codebase package.json] |
| Next.js route handlers | `^16.2.11` installed | Authenticated server API boundary | Existing API convention uses `requireApiUser()`. [VERIFIED: codebase package.json] |
| Vitest | `^3.2.4` installed | Pure mapping/service/route tests | Existing test runner, no install needed. [VERIFIED: codebase package.json] |

### Supporting

| Library / platform | Version | Purpose | When to use |
|--------------------|---------|---------|-------------|
| `react-markdown` + `remark-gfm` | Installed | Render one canonical section body | Existing renderer dependency; mount only fetched sections. [VERIFIED: codebase package.json] |
| Zod | `^4.4.3` installed | Validate create, replacement, selection, and generation payloads | Every client-to-API payload and model output. [VERIFIED: codebase package.json] |

**Installation:** None. Existing platform and packages cover Phase 9.

## Architecture Patterns

### System Architecture Diagram

```text
Browser upload/paste/URL
  │ POST /api/workspaces/ingest
  ▼
API: require user + create workspace if needed
  │ transaction/RPC creates workspace, owner membership, document, document_version
  ▼
Storage path keyed by immutable version ──► MarkItDown conversion
  │                                         │
  └─────────────────────────────────────────┤ append raw/provenance
                                            ▼
                                 canonicalize document_version
                                            │ append canonical_version + sections
                                            ▼
Browser selects completed canonical versions
  │ POST /api/workspaces/:id/outputs/{quiz|flashcards}
  ▼
API authorizes editor, loads selected versions + sections
  │ creates immutable output + output_source_snapshots + items atomically
  ▼
Reader/list endpoints ──► workspace/document/version metadata + section slices
```

### Recommended Tables and Migration Path

Use append-only versions; mutable display metadata is separate.

```text
workspaces
  id, owner_id, title, subtitle, created_at, updated_at, deleted_at
workspace_members
  workspace_id, user_id, role ('owner'|'editor'|'viewer'), created_at

documents
  id, workspace_id, title, description, created_at, updated_at, deleted_at
  -- document metadata only; no source bytes or raw text

document_versions
  id, document_id, version_number, source_kind, original_storage_path,
  original_filename, original_mime_type, source_url, raw_markdown,
  raw_markdown_checksum, conversion_provenance jsonb, created_by, created_at,
  deleted_at
canonical_versions
  id, document_version_id, version_number, status,
  canonical_checksum, model, prompt_version, parser_version,
  generator_settings jsonb, provenance jsonb, metadata jsonb,
  created_by, created_at, deleted_at
canonical_sections
  id, canonical_version_id, ordinal, section_key, heading,
  body_markdown, section_type, checksum, created_at

learning_outputs
  id, workspace_id, legacy_study_set_id nullable unique, kind,
  title, status, generation_provenance jsonb, created_by, created_at, updated_at,
  deleted_at
output_source_snapshots
  id, output_id, canonical_version_id nullable, ordinal,
  canonical_checksum, canonical_metadata jsonb, canonical_markdown text,
  sections jsonb, source_provenance jsonb, created_at
quiz_questions / flashcards
  output_id plus current item columns; per-item citation JSON remains
```

**Schema decisions:**
- `document_versions.version_number` unique per `document_id`; `canonical_versions.version_number` unique per `document_version_id`.
- Do not model canonical content as a mutable `canonical_markdown` field on `documents`. A completed canonical version has immutable content plus immutable ordered section rows.
- Canonical generation rerun for same document version produces a new canonical version (normally version 1, 2, ...); generation selection targets a completed canonical version ID, never “latest”.
- Metadata edits update `documents` (display title/description) or `workspaces`; never update source/version content. Version-specific extracted metadata belongs to canonical version `metadata`.
- Keep `model`, `prompt_version`, `parser_version`, and `generator_settings` as explicit provenance values. `provenance` retains provider/base URL policy, canonicalization mode (`ai`/`heuristic`), conversion/MarkItDown version, fallback reason, and timestamps.
- Serialize checksum input explicitly as UTF-8 normalized line endings (`\r\n`/`\r` to `\n`) without trimming. Store lowercase hex SHA-256. Never checksum JSONB text output: object-key serialization is not contract-stable. PostgreSQL `digest()` supports SHA-256 if database-side backfill is needed. [CITED: https://www.postgresql.org/docs/current/pgcrypto.html]
- Snapshot complete canonical markdown and ordered section payload into `output_source_snapshots` at output creation. References alone cannot meet WORK-07 when source access changes or a future migration changes canonical schema. Snapshot is evidence; `canonical_version_id` is a nullable historical locator, not current truth.
- `deleted_at timestamptz null` implements soft delete. “Active” queries add `deleted_at is null`; create partial active indexes matching that predicate. Historical output/read routes load snapshots without requiring source version to be active. PostgreSQL indexes can use predicates. [CITED: https://www.postgresql.org/docs/current/sql-createtable.html]

### Existing Data Preservation Migration

1. Create new tables, constraints, indexes, role type/check, and RLS helpers. Do not change legacy FKs or destructive RPCs.
2. Backfill one workspace per existing `study_sets` row. Create owner membership from `study_sets.user_id`; create one document named from set title; create document version 1 from `canonical_documents` source/raw fields; create canonical version 1 only if canonical markdown is nonempty; copy sections ordered by ordinal.
3. Backfill `learning_outputs` one-to-one with `study_sets` only where quiz/flashcard items exist. Preserve `legacy_study_set_id`, existing title/kind/timestamps; copy item rows or add `output_id` columns then backfill. Build snapshot from canonical version 1. Rows without canonical source receive `canonical_version_id = null` plus a provenance warning, never invented source evidence.
4. Preserve `quota_consumptions`, `study_sessions`, and `study_mistakes` only on their original legacy parent `study_sets.id`; do not duplicate or rewrite those rows. Store that immutable ID as `legacy_parent_study_set_id` on every derived output/bridge mapping. A deterministic kind-aware resolver handles reads: an output-specific bridge ID resolves its own output and bridge-keyed records first with no parent fallback; a historic parent ID selects only its child whose kind matches route kind (`quiz` or `flashcard`) and exposes historic quota/session/mistake rows by parent-resolution lookup. New workspace-native outputs allocate one output-specific bridge and store every new quota/session/mistake relationship on that bridge ID.
5. Deploy new workspace APIs/UI and run backfill assertions: every legacy set has one workspace/member/document/version; every legacy canonical section count matches; every generated output has a snapshot or explicit migration exception; parent history remains unchanged; each dual-mode route resolves only its matching output; bridge-keyed reads never fall back to parent; unauthorized callers resolve neither parent nor bridge.
6. Only after read/write traffic moves, make legacy routes adapters to workspace/output identities. Defer legacy table/FK removal to a later dedicated migration after a zero-reference audit.

### Pattern: Atomic Version and Output Writes

Use one SQL RPC for each compound state transition:
- `create_workspace_document_version(...)`: creates workspace + owner membership + document + version for first upload, or document version only for a replacement.
- `persist_canonical_version(...)`: inserts canonical version and all sections only after model output validates.
- `create_learning_output(...)`: inserts output, source snapshots, and generated rows in one transaction.

Use `security invoker` for ordinary ownership-based RPCs. If an RLS membership helper needs `SECURITY DEFINER`, place it in non-exposed schema when possible, use an explicit empty `search_path`, schema-qualify every relation, revoke default execute, then grant only intended role. Supabase recommends invoker by default and these definer hardening steps. [CITED: https://supabase.com/docs/guides/database/functions]

### Pattern: Progressive Canonical Reader

1. `GET /api/workspaces/:workspaceId/canonical-versions/:id` returns version metadata, section count, and section headings/ordinals only.
2. `GET .../sections?afterOrdinal=N&limit=20` returns body markdown for next ordered slice. Clamp limit server-side (for example 1–50) and include `nextAfterOrdinal`.
3. Client renders loaded slices using installed `react-markdown`; use an `IntersectionObserver` sentinel or explicit Next button. Keep fetched text in a bounded page cache; unmount far-away section components.
4. Do not return `raw_markdown`, full `canonical_markdown`, or all `body_markdown` fields from a list/reader metadata endpoint. Current canonical route does all three and violates WORK-05.

No new virtualization package needed. Browser native `IntersectionObserver` plus section pagination is enough. [ASSUMED]

### API/UI Least-Risk Transition

- Replace browser-side `createStudySetEarlyMeta()` in `src/lib/client/ingestStudySet.ts` with `POST /api/workspaces/ingest`. Keep `UnifiedInputZone` input validation/progress and return `{ workspaceId, documentId, documentVersionId }`.
- Initial title may derive from filename/source without user interaction. Workspace PATCH rename is later; document display metadata PATCH is independent of version replacement.
- Add workspace routes before deleting study-set routes: workspace dashboard, document detail/version list, canonical reader, replacement, soft delete/restore if included, output generation and output overview.
- Refactor `runIngest`, `runCanonicalize`, `runQuizGenerate`, and `runFlashcardGenerate` behind new parameters. Do not make one overloaded “if legacy else workspace” service; create workspace-native services and narrow adapters for legacy IDs while transition exists.
- Generation UI shows completed canonical versions grouped by document. User must select at least one; selection payload sends IDs, not markdown. Server selects and freezes exact records.
- Dashboard changes from `listStudySetMetas()` + per-row bank/mistake queries to one workspace summary API. Existing `useDashboardHome.ts` has an N+1 pattern and needs replacement, not a workspace wrapper around it.

## RLS and Phase-10 Boundary

### Required now

- `workspaces`: owner can create/update/soft-delete own workspace; readable through membership.
- `workspace_members`: create owner row in same trusted RPC/transaction; users can read their own membership and workspace members only where needed. Direct client insert/update/delete must be denied.
- `documents`, versions, sections, outputs, snapshots: SELECT requires workspace membership; mutation requires owner/editor helper; viewer has no mutation policy.
- Storage objects use immutable version paths. Do not use `owner = auth.uid()` alone because Phase 10 editors need workspace access; store workspace/version path convention and authorize through a signed server endpoint or compatible membership-aware storage policy.
- Include `auth.uid() is not null`; Supabase documents that unauthenticated `auth.uid()` is null. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]
- Wrap fixed membership helper calls in `(select private.can_workspace(...))` to avoid per-row helper execution in RLS. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]

### Defer to Phase 10

- Invitation token tables/endpoints, accept/revoke flows, membership-management UI.
- Public workspace/output links, anonymous policy branches, local anonymous attempt import.
- Owner transfer and collaboration activity/audit UX.
- Friend/user discovery, rate limits, block/report mechanics.

Phase 9 only establishes roles and policy predicates. Do not allow users to self-promote to editor/viewer or expose any public-link access path.

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Checksum primitive | Custom hash implementation | SHA-256 via Node `crypto.createHash` or PostgreSQL `digest()` | Correct, interoperable digest implementation already exists. [CITED: https://www.postgresql.org/docs/current/pgcrypto.html] |
| Cross-table all-or-nothing persistence | Chained client inserts with manual cleanup | Postgres RPC transaction | Avoids partial workspace/version/output provenance. |
| Authorization | UI role checks or `user_id` copied on each row | RLS + workspace membership helper | Browser checks are bypassable; rows need membership-derived access. [CITED: https://supabase.com/docs/guides/database/postgres/row-level-security] |
| Reader loading | Full-document mount or a new virtual-list package | Paginated sections + native `IntersectionObserver` | Meets requirement with existing browser feature and dependencies. [ASSUMED] |
| Output provenance | JSON references to “latest” canonical document | Frozen snapshot rows | Mutable references break reproducibility and historical evidence. |

## Common Pitfalls

### Pitfall 1: Reusing mutable canonical persistence
**What goes wrong:** `replace_canonical_content` overwrites canonical text and deletes old sections. Existing output then points at changed evidence.
**Avoid:** New canonicalization inserts a distinct canonical version; never call legacy replacement RPC for workspace-native data.

### Pitfall 2: Destructive regenerate semantics
**What goes wrong:** Current quiz/flashcard services delete existing rows before inserts, and flashcard generation deletes quiz rows. This erases historic output.
**Avoid:** Generation creates a new `learning_outputs` record. Editing remains item-level inside one output; regeneration is a separate output/revision, never a replace-all source operation.

### Pitfall 3: Snapshot references without content
**What goes wrong:** Only recording `canonical_version_id` makes historical provenance depend on present storage/schema/RLS.
**Avoid:** Snapshot checksum, canonical metadata, exact canonical markdown, and ordered sections at output creation.

### Pitfall 4: Hard delete/cascade
**What goes wrong:** Existing FKs use `on delete cascade`; deleting a legacy set destroys documents, outputs, sessions, and mistake evidence.
**Avoid:** Soft delete workspace documents and versions. Historical output fetches snapshots. Keep legacy hard-delete endpoint away from workspace objects.

### Pitfall 5: Client-created workspace orphan
**What goes wrong:** Browser creates workspace before upload; upload/conversion failure leaves empty workspaces.
**Avoid:** Server creates workspace and first document/version only after request input validates. If source upload must precede conversion, retain failed version with explicit conversion status, not a silent orphan.

### Pitfall 6: RLS recursion or definer overreach
**What goes wrong:** Membership policies query membership table recursively or a definer function gets default public execute/search path.
**Avoid:** Use hardened helper with explicit grants/search path and test owner/editor/viewer matrices. [CITED: https://supabase.com/docs/guides/database/functions]

### Pitfall 7: Dashboard N+1 and full canonical payload
**What goes wrong:** Current dashboard fetches each bank/mistake after set list; canonical endpoint returns full text. Large workspace libraries will slow and memory-spike.
**Avoid:** Server summary query and section-slice reader endpoints.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.4` |
| Config file | `vitest.config.ts` should be confirmed during planning; `package.json` exposes `npm run test -- <path>` |
| Quick run command | `npm run test -- <focused test path> --run` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | First ingest creates workspace/owner/document/version exactly once | service + route | `npm run test -- src/lib/workspaces/createWorkspaceIngest.test.ts --run` | Wave 0 |
| WORK-02 | Dashboard summary only shows active readable workspaces/counts | route + client model | `npm run test -- src/app/api/workspaces/route.test.ts --run` | Wave 0 |
| WORK-03 | Replacement appends version; metadata PATCH does not | service + migration integration | `npm run test -- src/lib/workspaces/documentVersions.test.ts --run` | Wave 0 |
| WORK-04 | Canonical provenance/checksum stable; canonical write append-only | unit + RPC contract | `npm run test -- src/lib/provenance/checksum.test.ts src/lib/pipeline/canonicalVersion.test.ts --run` | Wave 0 |
| WORK-05 | Reader requests slices and never receives whole markdown | route + component | `npm run test -- src/app/api/workspaces/canonical-sections/route.test.ts --run` | Wave 0 |
| WORK-06 | Generation rejects empty/cross-workspace/non-complete sources | service + route | `npm run test -- src/lib/pipeline/multiSourceGenerate.test.ts --run` | Wave 0 |
| WORK-07 | Output persistence copies frozen snapshots before success response | service + RPC contract | `npm run test -- src/lib/provenance/outputSnapshot.test.ts --run` | Wave 0 |
| WORK-08 | Soft delete hides source but output remains studyable | service + route | `npm run test -- src/lib/workspaces/softDelete.test.ts --run` | Wave 0 |
| WORK-09 | Owner/editor/viewer access matrix | Supabase local integration / SQL policy test | `supabase test db` | Wave 0 |

### Wave 0 Gaps

- [ ] Workspace/version/provenance pure service test files above.
- [ ] Supabase local SQL/RLS policy test fixture and seeded three-user role matrix.
- [ ] Migration backfill verification SQL: cardinality, section counts, snapshot exceptions, no missing owner membership.
- [ ] Route payload schemas for workspace ingest, metadata patch, replacement, source selection, and section pagination.

### Phase Gate

Run focused Vitest tests per task, `npm run typecheck`, `npm run lint`, `npm run test -- --run`, `npm run build`, `supabase db reset` against migrations, and `supabase test db` for authorization/backfill behavior. Supabase CLI is installed (`2.109.1`). [VERIFIED: local environment]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Next routes/tests/checksum | Yes | `v25.2.1` | — |
| npm | scripts/tests | Yes | `11.6.2` | — |
| Supabase CLI | migration reset and RLS tests | Yes | `2.109.1` | Manual remote migration review only; not preferred |
| Supabase project credentials | live DB/storage validation | Unknown | — | Local Supabase test stack if configured |
| AI provider credentials | canonical/generation manual smoke | Unknown | — | Existing heuristic canonical fallback only; output generation remains provider-dependent |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Existing `requireApiUser()` on all workspace/document/output routes. |
| V3 Session Management | Yes | Supabase SSR client/session refresh pattern. |
| V4 Access Control | Yes | RLS membership helpers; owner/editor/viewer write/read predicates; no direct membership mutation. |
| V5 Input Validation | Yes | Zod route schemas and existing upload validators before storage/MarkItDown/AI work. |
| V6 Cryptography | Yes | Standard SHA-256 checksum primitive only; no custom crypto. |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Cross-workspace source ID injection | Tampering / disclosure | Server checks every canonical version belongs to requested workspace and caller is editor before prompt assembly. |
| Source replacement rewrites evidence | Tampering | Append immutable document/canonical versions and frozen output snapshots. |
| RLS privilege escalation | Elevation | Membership roles server-created only; hardened helper function; deny direct membership changes. |
| Large canonical reader response | Denial of service | Paginated section endpoint, hard limit, no full document payload. |
| AI prompt/model provenance leak | Disclosure | Store configuration identity/settings but never API keys; redact URL secrets from provenance. |
| Deletion destroys evidence | Repudiation / tampering | Soft delete sources; output snapshots remain readable under output authorization. |

## Implementation Ordering

1. **Schema foundation and data migration:** tables, role model, RLS helpers/policies, immutable storage convention, backfill and assertions. This is tracer; no UI before data exists.
2. **Workspace/document APIs + first-upload flow:** server-owned auto-create, replace-source append flow, metadata/rename, soft delete. Preserve old study-set route adapters.
3. **Canonical version persistence + reader:** refactor ingest/canonicalization append semantics, provenance/checksum, progressive endpoints and UI.
4. **Multi-source output tracer:** output table/snapshots, quiz generation against selected completed canonical versions, compatibility overview/practice reads.
5. **Flashcard parity + dashboard migration:** same snapshots/selection, workspace dashboard summaries, document/version/output navigation, soft-delete behavior.
6. **Full validation/backfill/RLS matrix:** migration reset, local policy tests, legacy preservation assertions, type/lint/test/build, manual large-document reader check.

## State of the Art

| Old approach | Current approach | Impact |
|--------------|------------------|--------|
| One mutable “document” per study set | Immutable source and canonical version records | Enables reproducibility and safe replacement. |
| Generator reads current canonical row | Generator receives selected immutable versions and persists snapshots | Later canonical edits cannot alter old output evidence. |
| `user_id = auth.uid()` RLS | Workspace membership authorization | Enables collaboration-ready boundaries without granting links or invitations yet. |
| Full canonical GET payload | Section metadata + paginated bodies | Handles large documents without mounting all text. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Native `IntersectionObserver` plus paginated sections meets reader UX without a virtualization dependency | Architecture Patterns / Don't Hand-Roll | Reader may need virtualization only if UI measurements show thousands of concurrently retained mounted sections. |
| A2 | Legacy `study_sets` IDs can remain output bridge IDs throughout Phase 9 | Existing Data Preservation Migration | Route/session migration scope may expand if schema/UX requires breaking IDs earlier. |

## Open Questions (RESOLVED)

1. **Output identity and current routes — resolved**
   - Per locked decision D-01, current `/quiz/[setId]` and `/flashcard/[setId]` routes remain Phase 9 external contracts. Every newly created `learning_output` atomically allocates exactly one output-specific compatible `study_sets` bridge row; `learning_outputs.legacy_study_set_id` stores that ID and each compatible quiz/card item stores both `study_set_id` and `output_id`.
   - Compatibility IDs use deterministic kind-aware semantics. For an output-specific bridge ID, resolver reads its own output and bridge-keyed quota/session/mistake records first and never falls back to parent history. For a historic parent ID, resolver requires route kind, selects `quiz` child for quiz routes or `flashcards` child for flashcard routes, and exposes unchanged historic quota/session/mistake rows through parent-resolution lookup only. New workspace-native outputs write all new quota/session/mistake relationships on their output-specific bridge ID.
   - A legacy `study_sets` row with both approved-question and flashcard banks backfills into two distinct one-kind `learning_outputs` and two distinct bridge rows. Original set remains immutable `legacy_parent_study_set_id` on each derived output/bridge, never a bridge target. Do not duplicate or rewrite quota consumption, sessions, or mistakes. Backfill assertions prove two outputs/two bridges, matching-kind item allocation, unchanged parent-history cardinality/content, no duplicate history, no bridge-to-parent fallback, and parent/bridge authorization denial for nonmembers.

2. **Checksum contract scope — resolved**
   - `canonical_content_checksum` is lowercase SHA-256 of UTF-8 canonical markdown after only `\r\n`/`\r` line-ending normalization to `\n`; do not trim.
   - `sections_checksum` is lowercase SHA-256 of deterministic JSON serialization of ordered `{ordinal, section_key, heading, section_type, body_markdown}` tuples. Tuple field order is fixed as written; every string line ending is normalized to `\n`; provenance metadata is excluded from both content checksums.

3. **Canonical rerun policy — resolved**
   - Every canonicalization rerun for same document version appends a new immutable canonical version. UI labels canonical version number, provenance/model-prompt-parser identity, and creation date.
   - Generation requires explicit canonical-version selection. Only when user has no prior selection may UI default to latest completed canonical version; that default must be visible and user-changeable. No route or service silently resolves a mutable “latest” version after user selection.

## Sources

### Primary (HIGH confidence)
- [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.uid()` behavior, policy structure, helper-function optimization.
- [Supabase database functions guide](https://supabase.com/docs/guides/database/functions) — invoker default, `SECURITY DEFINER` search-path and execute-grant hardening.
- [PostgreSQL pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html) — SHA-256 `digest()`.
- [PostgreSQL CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html) — foreign-key requirements and predicate indexes.
- Local migrations and source paths listed in Current Codebase Map.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None beyond assumptions explicitly logged.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling already installed; database guidance checked against official docs.
- Architecture: HIGH — derived from current schema/services and locked product decisions.
- Pitfalls: HIGH — confirmed destructive/mutable patterns in current migrations and generation services.

**Research date:** 2026-07-30
**Valid until:** 2026-08-29
