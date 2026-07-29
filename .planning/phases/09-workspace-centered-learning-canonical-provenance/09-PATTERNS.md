# Phase 9: Workspace-Centered Learning & Canonical Provenance - Pattern Map

**Mapped:** 2026-07-30  
**Files analyzed:** 32 likely new/modified files  
**Analogs found:** 32 / 32

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<phase9>_workspace_foundation.sql` | migration | CRUD/backfill | `supabase/migrations/20260725120000_v21_baseline.sql` | role-match |
| `supabase/migrations/<phase9>_workspace_rpcs.sql` | migration/RPC | request-response | `supabase/migrations/20260729140000_atomic_canonical_replace.sql` | role-match |
| `supabase/migrations/<phase9>_output_snapshots_backfill.sql` | migration/RPC | batch | `supabase/migrations/20260729120000_atomic_quiz_replace.sql` | role-match |
| `supabase/tests/workspace_rls.sql` | migration test | request-response | baseline RLS policies | partial |
| `src/lib/provenance/checksum.ts` | utility | transform | `src/lib/pipeline/mapQuizOutputToRows.ts` | partial |
| `src/lib/workspaces/createWorkspaceIngest.ts` | service | request-response/file-I/O | `src/lib/pipeline/ingest.ts` | role-match |
| `src/lib/workspaces/documentVersions.ts` | service | CRUD | `src/lib/pipeline/ingest.ts` | role-match |
| `src/lib/workspaces/workspaceSummary.ts` | service | request-response | `src/hooks/useDashboardHome.ts` | partial |
| `src/lib/workspaces/canonicalReader.ts` | service | request-response | `src/app/api/study-sets/[id]/canonical/route.ts` | role-match |
| `src/lib/provenance/outputSnapshot.ts` | service | CRUD/transform | `src/lib/pipeline/mapQuizOutputToRows.ts` | role-match |
| `src/lib/pipeline/canonicalVersion.ts` | service | request-response | `src/lib/pipeline/canonicalize.ts` | exact |
| `src/lib/pipeline/multiSourceGenerate.ts` | service | request-response | `src/lib/pipeline/quizGenerate.ts` | role-match |
| `src/lib/pipeline/flashcardMultiSourceGenerate.ts` | service | request-response | `src/lib/pipeline/flashcardGenerate.ts` | role-match |
| `src/lib/client/ingestWorkspace.ts` | client API | request-response/file-I/O | `src/lib/client/ingestStudySet.ts` | exact |
| `src/lib/client/workspaceApi.ts` | client API | request-response | `src/lib/client/canonicalizeStudySet.ts` | role-match |
| `src/lib/client/canonicalReader.ts` | client API | paginated request-response | `src/lib/client/canonicalizeStudySet.ts` | role-match |
| `src/app/api/workspaces/route.ts` | route | request-response | `src/app/api/study-sets/[id]/route.ts` | role-match |
| `src/app/api/workspaces/ingest/route.ts` | route | request-response/file-I/O | `src/app/api/study-sets/[id]/ingest/route.ts` | exact |
| `src/app/api/workspaces/[workspaceId]/route.ts` | route | CRUD | `src/app/api/study-sets/[id]/route.ts` | exact |
| `src/app/api/workspaces/[workspaceId]/documents/[documentId]/route.ts` | route | CRUD | `src/app/api/study-sets/[id]/route.ts` | role-match |
| `src/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route.ts` | route | request-response/file-I/O | `src/app/api/study-sets/[id]/ingest/route.ts` | role-match |
| `src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/route.ts` | route | request-response | `src/app/api/study-sets/[id]/canonical/route.ts` | exact |
| `src/app/api/workspaces/[workspaceId]/canonical-versions/[versionId]/sections/route.ts` | route | paginated request-response | `src/app/api/study-sets/[id]/canonical/route.ts` | role-match |
| `src/app/api/workspaces/[workspaceId]/outputs/quiz/route.ts` | route | request-response | `src/app/api/study-sets/[id]/quiz/generate/route.ts` | exact |
| `src/app/api/workspaces/[workspaceId]/outputs/flashcards/route.ts` | route | request-response | `src/app/api/study-sets/[id]/flashcards/generate/route.ts` | exact |
| `src/components/edit/new/import/UnifiedInputZone.tsx` | client component | event-driven/file-I/O | same file | modify |
| `src/components/canonical/CanonicalMarkdownViewer.tsx` | reader component | paginated render | same file | modify |
| `src/components/canonical/CanonicalSourceReview.tsx` | reader component | request-response/render | same file | modify |
| `src/hooks/useDashboardHome.ts` | client hook | request-response/event-driven | same file | modify |
| `src/components/dashboard/DashboardHomeClient.tsx` | client component | event-driven | same file | modify |
| `src/app/api/workspaces/**/*.test.ts` | route tests | request-response | `src/app/api/study-sets/[id]/quiz/generate/route.test.ts` | exact |
| `src/lib/{workspaces,provenance,pipeline}/*.test.ts` | unit/service tests | transform/request-response | existing `*.test.ts` beside pipeline modules | role-match |

## Pattern Assignments

### Schema foundation, backfill, RLS, and RPC migrations

**Analogs:** `supabase/migrations/20260725120000_v21_baseline.sql`, `20260729140000_atomic_canonical_replace.sql`, `20260729120000_atomic_quiz_replace.sql`

**Foundation pattern** (`20260725120000_v21_baseline.sql`, lines 11-49):

```sql
create extension if not exists "pgcrypto";

create table if not exists public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger study_sets_set_updated_at
before update on public.study_sets
for each row
execute function public.set_updated_at();
```

Copy table/constraint/trigger ordering. Phase 9 migration must add workspace, membership, document, document-version, canonical-version, output, snapshot tables first; backfill second; preserve all legacy tables/FKs/routes. Use `deleted_at`, partial active indexes, `unique(document_id, version_number)`, `unique(document_version_id, version_number)`, and `unique(legacy_study_set_id)` for bridge. Do **not** alter legacy cascade FKs or call old destructive RPCs for workspace-native rows.

**RLS pattern** (`20260725120000_v21_baseline.sql`, lines 177-242):

```sql
alter table public.canonical_documents enable row level security;

create policy canonical_documents_select_own on public.canonical_documents
  for select to authenticated using (user_id = auth.uid());
create policy canonical_documents_insert_own on public.canonical_documents
  for insert to authenticated with check (user_id = auth.uid());
```

Phase 9 differs deliberately: membership derives access. Create hardened helper boundary, use `(select private.can_workspace(...))`, require `auth.uid() is not null`, allow `owner|editor` mutation and member reads. No direct `workspace_members` mutation policy. Keep default function grants revoked.

**Atomic RPC validation pattern** (`20260729140000_atomic_canonical_replace.sql`, lines 19-34, 76-101):

```sql
if v_user_id is null then
  raise exception 'Authentication required';
end if;
if jsonb_typeof(p_sections) <> 'array' then
  raise exception 'Sections payload must be an array';
end if;

get diagnostics v_inserted_count = row_count;
if v_inserted_count <> p_expected_section_count then
  raise exception 'Expected to insert %, inserted %',
    p_expected_section_count, v_inserted_count;
end if;
```

New `create_workspace_document_version`, `persist_canonical_version`, and `create_learning_output` RPCs validate cardinality/ownership, then insert all related rows in one transaction. Copy `security invoker`, explicit `search_path`, revoke/grant pattern from lines 9-12 and 96-101. Replace update/delete semantics with append-only inserts and snapshots.

**Compatibility/backfill pattern** (`20260729120000_atomic_quiz_replace.sql`, lines 34-45, 80-103): verify parent before rows; count rows after insert; grant only authenticated. New output persistence inserts `learning_outputs`, snapshot rows, then items. Never copy legacy `delete from approved_questions` line 43-45. Backfill source-less legacy outputs with explicit provenance exception, not fabricated evidence.

### Workspace services and provenance utilities

**Ingest analog:** `src/lib/pipeline/ingest.ts` (entrypoint starts line 227). Keep source validation/conversion/storage concerns server-side. Split workspace-native service from legacy adapter; no overloaded legacy/workspace parameter object.

**Canonical service analog:** `src/lib/pipeline/canonicalize.ts` (entrypoint starts line 426). Preserve AI/heuristic selection, model-output validation, and typed domain errors. Replace mutable canonical document RPC with `persist_canonical_version`; return IDs/count/provenance needed by route.

**Quiz and flashcard analogs:** `src/lib/pipeline/quizGenerate.ts` (entrypoint starts line 911) and `src/lib/pipeline/flashcardGenerate.ts` (entrypoint starts line 214). Keep model generation and existing mapping logic. New service validates nonempty, distinct completed canonical-version IDs belong to writable requested workspace, assembles ordered section content, then calls one output/snapshot RPC. Do not clean up other output kind or prior generated rows.

**Row mapper analog:** `src/lib/pipeline/mapQuizOutputToRows.ts`, exports at lines 26-76. Keep item citation JSON shape. Add `output_id` at persistence boundary; whole-source truth belongs in frozen `output_source_snapshots`, not each item.

**Checksum utility:** no exact existing analog. Use native Node `crypto.createHash('sha256')`; normalize `\r\n`/`\r` to `\n`, do not trim, return lowercase hex. Keep pure module and Vitest assertion tests. No custom hash.

### Workspace API routes

**Shared auth/error shell:** `src/app/api/study-sets/[id]/ingest/route.ts`, lines 39-52 and 93-121.

```ts
const auth = await requireApiUser();
if ("error" in auth) {
  return auth.error as Response;
}

try {
  // parse + validate + service
} catch (error) {
  if (error instanceof IngestValidationError) {
    return NextResponse.json(
      { error: "validation_error", message: error.message },
      { status: 400 },
    );
  }
  console.error("ingest route error", error);
  return NextResponse.json(
    { error: "internal_error", message: "Ingest failed." },
    { status: 500 },
  );
}
```

All workspace routes call `requireApiUser()`, use Zod before service work, map expected typed errors to stable JSON error code/status, log only unknown errors, and export `runtime = "nodejs"` for storage/AI routes. Do not trust client-provided workspace membership, canonical content, storage path ownership, or selected source data.

**Metadata CRUD analog:** `src/app/api/study-sets/[id]/route.ts`, lines 38-99.

```ts
let body: { title?: string; subtitle?: string | null };
try {
  body = (await req.json()) as typeof body;
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

const patch: Record<string, unknown> = {};
if (typeof body.title === "string") patch.title = body.title.trim();
if (Object.keys(patch).length === 0) {
  return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
}
```

Use for workspace/document metadata PATCH, but replace manual type assertions with Phase 9 Zod schemas. DELETE updates `deleted_at`; never delete workspace documents/versions. Return 404 on no authorized active row.

**Progressive reader analog:** `src/app/api/study-sets/[id]/canonical/route.ts`, lines 17-55. Preserve auth, `maybeSingle`, DB-error 500, missing 404, ordering. New metadata route must select only canonical-version fields plus section `id, ordinal, heading, section_type, section_key`; never select raw/canonical markdown or `body_markdown`. Slice route adds validated/clamped `afterOrdinal` and `limit`, filters `ordinal > afterOrdinal`, orders ascending, returns bodies plus `nextAfterOrdinal`.

**Generation route analog:** `src/app/api/study-sets/[id]/quiz/generate/route.ts`, lines 41-107 and 108-159; flashcard counterpart lines 41-153. Preserve auth, Zod parsing, quota before generator, stable typed errors, and `maxDuration = 300`. Replace `verifyStudySet` with workspace access/source selection validation inside workspace-native pipeline/service. Keep legacy routes as narrow adapters via `legacy_study_set_id` during Phase 9.

### Client ingest, dashboard, and canonical reader

**Ingest client:** `src/lib/client/ingestStudySet.ts`, lines 95-137 and 140-213.

```ts
const res = await fetch(`/api/study-sets/${studySetId}/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const payload = (await res.json().catch(() => ({}))) as {
  error?: string;
  message?: string;
};
if (!res.ok) throw new Error(payload.message ?? payload.error ?? "Conversion failed.");
```

Create `ingestWorkspace` with same source union, UI state callbacks, and network normalization. Remove browser `createStudySetEarlyMeta` and browser auth/storage orchestration. New API returns `{ workspaceId, documentId, documentVersionId }`; source/initial title derives server-side after validation.

**Import component:** `src/components/edit/new/import/UnifiedInputZone.tsx`, lines 88-181. Preserve local input validation, progress state, toast handling, and redirect pattern. Change result contract/`getPostIngestHref` to workspace/document/version identity. Do not ask title before upload.

**Reader API/client types:** `src/lib/client/canonicalizeStudySet.ts`, lines 1-37 and 83-102. Split full `CanonicalPreviewData` into version metadata/list type and paginated `CanonicalSectionPage`; use API `data` envelope and same `mapNetworkError`. Never keep whole content in metadata model.

**Markdown component:** `src/components/canonical/CanonicalMarkdownViewer.tsx`, lines 113-157. Reuse `MarkdownBlock`, `remarkGfm`, accessible external-link renderer, and per-section `id`. Replace `markdown` fallback/full section list contract with loaded pages. Add native `IntersectionObserver` sentinel or explicit load-more; bound loaded page cache and unmount far sections when large. No new virtualization dependency.

**Source review component:** `src/components/canonical/CanonicalSourceReview.tsx`, lines 16-50. Keep metadata header/action composition. Remove raw/full canonical fields and direct `<pre>` source display for progressive route; feed section metadata and paginated viewer.

**Dashboard hook:** `src/hooks/useDashboardHome.ts`, lines 106-167. Preserve refresh sequence guard, cache, event invalidation, filters/sorting. Replace `listStudySetMetas()` plus per-set `getApproved*`/`hasMistakesForStudySet()` loop (lines 117-140) with one authenticated workspace-summary API call. API response includes active readable workspaces, role, output/document counts, recent output metadata; client must not reconstruct counts through N+1 browser reads.

## Tests

**Route test analog:** `src/app/api/study-sets/[id]/quiz/generate/route.test.ts`, lines 1-83 and 85-254.

```ts
const runQuizGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

describe("POST /api/study-sets/[id]/quiz/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
});
```

Use same top-level mocks/import-after-mocks style. Cover 401, inaccessible/404, invalid JSON/Zod 400, forbidden cross-workspace source IDs, incomplete sources, quota error, typed service failures, and exact success payload/service call.

**Pipeline/utility test pattern:** colocated Vitest files such as `src/lib/pipeline/canonicalize.test.ts` and `src/lib/pipeline/mapQuizOutputToRows.test.ts`. Keep pure inputs/outputs, no live Supabase. Add deterministic checksum normalization, source-ID dedupe/order, snapshot serialization, soft-delete query contract, and migration compatibility fixtures.

**SQL tests:** No close existing file. Add `supabase/tests/workspace_rls.sql` following Supabase local DB test conventions. Seed owner/editor/viewer/nonmember and assert read/write/soft-delete rules plus no direct membership escalation. Include migration backfill assertions for legacy bridge cardinality, section count parity, and snapshot-or-explicit-exception coverage.

## Shared Patterns

### Authentication and authorization
**Sources:** `src/app/api/study-sets/[id]/ingest/route.ts` lines 39-52; baseline migration lines 177-242.

Routes authenticate with `requireApiUser`; database is final authorization boundary. Phase 9 replaces route `.eq("user_id", userId)` ownership checks with RLS membership predicates and service checks for requested workspace/source IDs.

### Input validation and error contract
**Sources:** `src/app/api/study-sets/[id]/ingest/route.ts` lines 74-110; `src/app/api/study-sets/[id]/quiz/generate/route.ts` lines 56-74.

Use Zod at HTTP boundaries. Expected validation errors return 400, missing/inaccessible resources 404, invalid model output/source eligibility 422, persistence outage 503, quota 402, unknown 500. Preserve `{ error, message? }` shape.

### Atomic persistence
**Sources:** canonical RPC lines 19-92; quiz RPC lines 16-96.

Compound transitions belong in a single invoker RPC. Validate auth/input/cardinality, mutate all records, verify row count, return concise result. Workspace-native paths append immutable version/output rows; old replacement RPCs remain legacy-only adapters.

### Legacy compatibility
**Sources:** `src/app/api/study-sets/[id]/route.ts`; current study-set generation routes.

Keep `study_sets` IDs and routes viable via `learning_outputs.legacy_study_set_id`. Do not delete, rename, or repoint `quiz_sessions`, mistakes, quota, or legacy FKs during Phase 9. New workspace routes are primary; legacy routes adapt narrowly until later migration.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `supabase/tests/workspace_rls.sql` | migration test | request-response | No checked-in Supabase SQL policy tests. |
| `src/lib/provenance/checksum.ts` | utility | transform | No existing checksum contract; use Node `crypto`, not a project helper. |

## Metadata

**Analog search scope:** `supabase/migrations`, `src/app/api`, `src/lib/{pipeline,client}`, `src/hooks`, `src/components/{edit,canonical,dashboard}`  
**Files scanned:** 20 focused source/migration/test files  
**Pattern extraction date:** 2026-07-30
