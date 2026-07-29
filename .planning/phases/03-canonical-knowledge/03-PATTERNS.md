# Phase 3: Canonical Knowledge - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 18
**Analogs found:** 14 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/study-sets/[id]/canonicalize/route.ts` | route | request-response, transform | `src/app/api/study-sets/[id]/ingest/route.ts` + stub `canonicalize/route.ts` | exact |
| `src/app/api/study-sets/[id]/canonical/route.ts` | route | CRUD (read) | `src/app/api/study-sets/[id]/route.ts` (GET) | exact |
| `src/lib/pipeline/canonicalize.ts` | service | batch, transform | `src/lib/pipeline/ingest.ts` + git `extractCanonicalSourceUnits.ts` | partial |
| `src/lib/pipeline/canonicalSchemas.ts` | utility | transform | `src/lib/pipeline/ingestSchemas.ts` + git `canonicalUnitSchemas.ts` | role-match |
| `src/lib/pipeline/canonicalPrompt.ts` | utility | transform | `prompt/canonical_builder_v1.json` (locked spec) — no loader analog | partial |
| `src/lib/pipeline/canonicalize.test.ts` | test | transform | `src/lib/pipeline/ingest.test.ts` | role-match |
| `src/app/api/study-sets/[id]/canonicalize/route.test.ts` | test | request-response | `src/app/api/study-sets/[id]/ingest/route.test.ts` | exact |
| `supabase/migrations/*_canonical_section_key.sql` (optional) | migration | batch | `supabase/migrations/20260725120000_v21_baseline.sql` (`canonical_sections`) | role-match |
| `src/lib/client/canonicalizeStudySet.ts` | utility | request-response | `src/lib/client/ingestStudySet.ts` | exact |
| `src/app/(app)/sets/[id]/source/page.tsx` | component | request-response | current `source/page.tsx` + `03-UI-SPEC.md` | exact |
| `src/components/canonical/CanonicalPreviewHeader.tsx` | component | request-response | `src/app/(app)/sets/[id]/source/page.tsx` header block | role-match |
| `src/components/canonical/CanonicalMetadataChips.tsx` | component | request-response | `src/components/review/MappingQualityBadge.tsx` (Badge usage) | role-match |
| `src/components/canonical/CanonicalMarkdownViewer.tsx` | component | transform | no markdown renderer in repo | no analog |
| `src/components/canonical/CanonicalSectionToc.tsx` | component | request-response | `03-UI-SPEC.md` TOC contract | partial |
| `src/components/canonical/CanonicalizeProgressCard.tsx` | component | event-driven | `src/components/edit/new/import/IngestProgressCard.tsx` | exact |
| `src/components/canonical/CanonicalNextStepPlaceholder.tsx` | component | request-response | `03-UI-SPEC.md` footer CTA | partial |
| `src/app/api/ai/forward/route.ts` (restore if missing) | route | request-response | git HEAD `src/app/api/ai/forward/route.ts` | exact (deleted) |
| `src/lib/ai/sameOriginForward.ts` (restore if missing) | utility | request-response | git HEAD `src/lib/ai/sameOriginForward.ts` | exact (deleted) |
| Legacy cleanup (`generateFromFile/canonical*`, `canonical_document_extractions`) | — | — | delete only | n/a |

## Pattern Assignments

### `src/app/api/study-sets/[id]/canonicalize/route.ts` (route, request-response + transform)

**Analog:** `src/app/api/study-sets/[id]/ingest/route.ts` + existing stub

**Imports + auth** (ingest lines 1–9, canonicalize stub lines 1–43):

```typescript
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  CanonicalizeError,
  CanonicalizeValidationError,
  runCanonicalize,
} from "@/lib/pipeline/canonicalize";
```

**Keep `verifyStudySet` helper** — copy unchanged from stub (`canonicalize/route.ts` lines 5–28) or ingest (`ingest/route.ts` lines 13–36).

**POST handler skeleton** (ingest lines 38–51 + delegate to service):

```typescript
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  const { id } = await ctx.params;
  const verified = await verifyStudySet(auth.supabase, auth.user.id, id);
  if ("error" in verified) {
    return verified.error as Response;
  }

  try {
    const result = await runCanonicalize({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
    });
    return NextResponse.json(result);
  } catch (error) {
    // map errors — see Error handling below
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
```

**Error status mapping** (mirror ingest lines 92–117):

| Error | Status | Body shape |
|-------|--------|------------|
| `CanonicalizeValidationError` (bad stage, empty raw) | `400` | `{ error: "validation_error", message }` |
| LLM / schema failure after guardrails | `422` | `{ error: "canonicalize_error", message }` |
| `ZodError` on output | `422` | `{ error: "validation_error", message }` |
| DB / unexpected | `500` | `{ error: "internal_error", message }` |

On failure per D-06: service sets `metadata.canonicalization_status = failed` without overwriting `canonical_markdown` / sections.

---

### `src/app/api/study-sets/[id]/canonical/route.ts` (route, CRUD read)

**Analog:** `src/app/api/study-sets/[id]/route.ts` (GET)

**Auth + ownership** (`route.ts` lines 8–35):

```typescript
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const { data: studySet, error: studySetError } = await supabase
    .from("study_sets")
    .select("id,title,pipeline_stage")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (studySetError) {
    return NextResponse.json({ error: studySetError.message }, { status: 500 });
  }
  if (!studySet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // join canonical_documents + canonical_sections — return { data: { studySet, document, sections } }
}
```

**Sections query** — order by `ordinal` ascending; select `id, ordinal, heading, body_markdown, section_type` plus `section_key` when column exists.

---

### `src/lib/pipeline/canonicalize.ts` (service, batch + transform)

**Analog:** `src/lib/pipeline/ingest.ts` (Supabase persistence) + git `extractCanonicalSourceUnits.ts` (LLM + Zod + repair)

**Custom error classes** (ingest lines 24–30):

```typescript
export class CanonicalizeValidationError extends Error {
  readonly name = "CanonicalizeValidationError";
}

export class CanonicalizeError extends Error {
  readonly name = "CanonicalizeError";
}
```

**Pre-flight reads** — load `study_sets.pipeline_stage` and `canonical_documents` row:

```typescript
const { data: doc, error } = await supabase
  .from("canonical_documents")
  .select("id, raw_markdown, original_filename, metadata")
  .eq("study_set_id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

if (!doc || !doc.raw_markdown?.trim()) {
  throw new CanonicalizeValidationError("Raw markdown is required.");
}
// pipeline_stage must be at least `raw` (D-07)
```

**Failure metadata without overwriting canonical** (ingest `persistConversionFailure` lines 137–165):

```typescript
await supabase.from("canonical_documents").update({
  metadata: {
    ...existingMetadata,
    canonicalization_status: "failed",
    canonicalization_error: message,
  },
}).eq("study_set_id", studySetId).eq("user_id", userId);
```

**Success persistence** (ingest success upsert lines 286–317):

```typescript
await supabase.from("canonical_documents").update({
  canonical_markdown: output.canonical_markdown,
  metadata: {
    ...mergedMetadata,
    title: output.title,
    clean_filename: output.filename,
    language: output.language,
    content_type: output.document_type,
    topics: output.topics,
    extracted_questions: output.extracted_questions,
    warnings: output.warnings,
    prompt_version: "1.0",
    canonicalization_status: "ok",
  },
}).eq("study_set_id", studySetId).eq("user_id", userId);

// delete existing sections for document id, then insert new rows
await supabase.from("canonical_sections").delete()
  .eq("canonical_document_id", doc.id).eq("user_id", userId);

await supabase.from("canonical_sections").insert(sectionRows);

await supabase.from("study_sets").update({
  pipeline_stage: "canonical",
  title: output.title, // when present (D-05)
}).eq("id", studySetId).eq("user_id", userId);
```

**Section row mapping** (baseline schema lines 83–98):

| LLM field | DB column |
|-----------|-----------|
| array index + 1 | `ordinal` |
| `title` | `heading` |
| `content` | `body_markdown` |
| `content_type` | `section_type` |
| `id` (`sec_001`) | `section_key` column **or** nested in jsonb metadata |

**LLM call pattern** (git `extractCanonicalSourceUnits.ts` lines 13–127):

```typescript
function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

const first = await postChatCompletionAssistantText({
  configUrl,
  apiKey,
  model,
  messages: [
    { role: "system", content: prompt.system },
    { role: "user", content: filledUserPayload },
  ],
  responseFormatJsonObject: true,
  temperature: 0,
  signal,
});

let parsed = canonicalBuilderOutputSchema.safeParse(
  JSON.parse(stripJsonFence(first.text)),
);
if (!parsed.success) {
  // one repair pass with assistant + "Invalid schema … Return ONLY JSON"
}
```

**AI config resolution** — restore git `src/app/api/ai/forward/route.ts` pattern: `getAiProcessingConfig(resolveUserAiTier(user))` + `postChatCompletionAssistantText` (server-only direct upstream). Do **not** embed vendor keys in canonicalize route.

---

### `src/lib/pipeline/canonicalSchemas.ts` (utility, transform)

**Analog:** `src/lib/pipeline/ingestSchemas.ts` + git `canonicalUnitSchemas.ts`

**Zod enums from locked `output_schema`** (`prompt/canonical_builder_v1.json`):

```typescript
import { z } from "zod";

export const documentTypeSchema = z.enum(["theory", "exam", "mixed"]);
export const sectionContentTypeSchema = z.enum([
  "theory",
  "question",
  "answer_key",
  "example",
  "reference",
]);

export const canonicalSectionSchema = z.object({
  id: z.string().regex(/^sec_\d{3}$/),
  title: z.string().min(1),
  content: z.string(),
  content_type: sectionContentTypeSchema,
});

export const extractedQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string().nullable(),
  section_id: z.string(),
});

export const canonicalBuilderOutputSchema = z.object({
  title: z.string().min(1),
  filename: z.string().endsWith(".md"),
  language: z.string().min(1),
  document_type: documentTypeSchema,
  topics: z.array(z.string()),
  canonical_markdown: z.string(),
  sections: z.array(canonicalSectionSchema).min(1),
  extracted_questions: z.array(extractedQuestionSchema),
  warnings: z.array(z.string()),
});

export type CanonicalBuilderOutput = z.infer<typeof canonicalBuilderOutputSchema>;
```

**Discriminated union style** from ingestSchemas (lines 9–25) — use plain object + `safeParse` / `parse` like ingest route, not discriminated union (single output shape).

---

### `src/lib/pipeline/canonicalPrompt.ts` (utility, transform)

**Analog:** locked `prompt/canonical_builder_v1.json` — **no existing runtime prompt loader**

**Load prompt** (`tsconfig.json` has `resolveJsonModule: true`):

```typescript
import promptSpec from "../../../prompt/canonical_builder_v1.json";

export function buildCanonicalBuilderMessages(input: {
  source_id: string;
  source_type: string;
  original_filename: string;
  raw_markdown: string;
}): { system: string; user: string } {
  const userPayload = {
    source_id: input.source_id,
    source_type: input.source_type,
    original_filename: input.original_filename,
    raw_markdown: input.raw_markdown,
  };
  return {
    system: promptSpec.system,
    user: JSON.stringify(userPayload),
  };
}

export const CANONICAL_PROMPT_VERSION = promptSpec.version;
```

**Do not** duplicate `system`, `tasks`, or `constraints` strings in code (D-13). Optionally append `tasks` + `constraints` to system message by joining `promptSpec.tasks` / `promptSpec.constraints` from JSON.

**Input template variables** (D-14): `source_id` ← `study_set_id`; `source_type` ← `metadata.input_type`; `original_filename` ← `canonical_documents.original_filename`; `raw_markdown` ← `raw_markdown`.

---

### `src/lib/client/canonicalizeStudySet.ts` (utility, request-response)

**Analog:** `src/lib/client/ingestStudySet.ts`

**POST helper** (ingest `postIngestJson` lines 94–114):

```typescript
export async function postCanonicalize(studySetId: string): Promise<void> {
  const res = await fetch(`/api/study-sets/${studySetId}/canonicalize`, {
    method: "POST",
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        "We couldn't build canonical knowledge from this source.",
    );
  }
}
```

**GET helper** — mirror ingest fetch error handling for preview page:

```typescript
export async function fetchCanonicalPreview(studySetId: string) {
  const res = await fetch(`/api/study-sets/${studySetId}/canonical`);
  // parse { data } or throw with friendly message
}
```

**Network errors** (ingest lines 207–210): `TypeError` → `Connection lost. Check your network and try again.`

---

### `src/app/(app)/sets/[id]/source/page.tsx` (component, request-response)

**Analog:** current `source/page.tsx` + `03-UI-SPEC.md` state machine

**Supabase client reads** (source page lines 35–82):

```typescript
const supabase = createSupabaseBrowserClient();
const { data: studySet } = await supabase
  .from("study_sets")
  .select("title,pipeline_stage,content_kind")
  .eq("id", id)
  .maybeSingle();

const { data: document } = await supabase
  .from("canonical_documents")
  .select("raw_markdown,canonical_markdown,metadata,original_filename")
  .eq("study_set_id", id)
  .maybeSingle();
```

**Phase 3 changes:** prefer `fetchCanonicalPreview` API for canonical stage; auto-`postCanonicalize` when `pipeline_stage === "raw"` and non-empty `raw_markdown` (UI-SPEC state machine). Replace raw `<pre>` preview with `CanonicalMarkdownViewer` when `pipeline_stage >= canonical`.

**Layout shell** (source page lines 113–134) — keep card ring pattern:

```tsx
<div className="rounded-xl border border-border/50 bg-card/60 p-5 ring-1 ring-foreground/10">
  <p className="font-label text-xs font-extrabold uppercase tracking-wide text-chart-2">
    Study set
  </p>
  <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">
    {title}
  </h1>
</div>
```

**Parent layout** (`sets/[id]/layout.tsx` lines 7–10) — do not add competing `max-w-*` wrapper.

**Post-ingest navigation** already lands here via `studySetSource(id)` (`edit/new/quiz/page.tsx` lines 9–12).

---

### `src/components/canonical/CanonicalizeProgressCard.tsx` (component, event-driven)

**Analog:** `src/components/edit/new/import/IngestProgressCard.tsx`

**Card shell + accent stripe** (IngestProgressCard lines 70–84):

```tsx
<div className="rounded-xl bg-card ring-1 ring-foreground/10">
  <div className="border-l-[6px] border-d2q-accent px-5 py-5">
    <p className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
      Canonical knowledge
    </p>
    <p className="mt-2 text-base font-extrabold text-foreground" aria-live="polite">
      Building canonical knowledge…
    </p>
  </div>
  {/* indeterminate d2q-progress-stripes row — IngestProgressCard lines 117–121 */}
</div>
```

Copy from UI-SPEC: eyebrow `Canonical knowledge`, headline `Building canonical knowledge…`, optional subcopy; error variant eyebrow `Canonicalization failed`.

---

### `src/components/canonical/CanonicalMetadataChips.tsx` (component)

**Analog:** `src/components/review/MappingQualityBadge.tsx` + `src/components/ui/badge.tsx`

**Outline chip pattern** (MappingQualityBadge lines 28–35 + UI-SPEC):

```tsx
<Badge variant="outline" className="text-xs">
  Language · EN
</Badge>
```

Three chips: Language, Content (Theory|Exam|Mixed), Sections count. Missing values show `—`.

---

### `src/components/canonical/CanonicalMarkdownViewer.tsx` (component, transform)

**Analog:** none — no `react-markdown` / `remark` usage in `src/`

**Fallback until markdown lib added** — current source page `<pre>` (lines 136–142):

```tsx
<pre className="max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
  {content}
</pre>
```

**Target** (UI-SPEC): prose-scoped read-only viewer, `max-w-[72ch]`, body tier only (`text-sm` / weight 400). Planner may add `react-markdown` + `prose` classes per `03-UI-SPEC.md` Typography section.

---

### `supabase/migrations/*_canonical_section_key.sql` (optional migration)

**Analog:** `supabase/migrations/20260725120000_v21_baseline.sql` (`canonical_sections` lines 83–98)

**Add column pattern** (extend baseline table, do not rewrite baseline file):

```sql
begin;

alter table public.canonical_sections
  add column if not exists section_key text null;

create unique index if not exists canonical_sections_document_section_key_unique
  on public.canonical_sections (canonical_document_id, section_key)
  where section_key is not null;

commit;
```

Alternative (D-17 discretion): store `sec_001` in jsonb `metadata` on section row — no migration; ingest pattern uses jsonb on `canonical_documents.metadata` (ingest lines 67–73, 294–300).

---

### `src/app/api/ai/forward/route.ts` + `src/lib/ai/sameOriginForward.ts` (restore)

**Status:** deleted from working tree; present at git HEAD.

**Restore when:** server canonicalize or client helpers need same-origin AI proxy (D-01, PROJECT.md).

**Client forward** (git `sameOriginForward.ts`):

```typescript
export async function forwardAiPost(params: {
  body: unknown;
  signal?: AbortSignal;
  method?: "GET" | "POST";
}): Promise<Response> {
  return fetch("/api/ai/forward", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: params.body, method: params.method ?? "POST" }),
  });
}
```

**Server forward auth** (git `forward/route.ts` lines 93–108):

```typescript
const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Client JSON LLM example** (git `generateStudySetTitle.ts` lines 46–64):

```typescript
const res = await forwardAiPost({
  body: {
    model: "server",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: 220,
    stream: false,
  },
});
```

Canonicalize **server service** should prefer `postChatCompletionAssistantText` (git `openAiChatCompletion.ts`) like legacy `extractCanonicalSourceUnits.ts`, not browser `forwardAiPost`.

---

### Tests

**Route test analog:** `src/app/api/study-sets/[id]/ingest/route.test.ts`

```typescript
vi.mock("@/lib/pipeline/canonicalize", () => ({
  runCanonicalize: (...args: unknown[]) => runCanonicalizeMock(...args),
}));
vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));
```

Cases: 401 unauthenticated, 404 not found, 400 validation (empty raw), 422 canonicalize failure, 200 success.

**Service test analog:** `src/lib/pipeline/ingest.test.ts` — mock Supabase client chains for `from().select().eq()…`.

---

## Shared Patterns

### API authentication
**Source:** `src/lib/api/requireApiUser.ts` (lines 5–18)
**Apply to:** all new study-set API routes

```typescript
export async function requireApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { supabase, user } as const;
}
```

### Study-set ownership guard
**Source:** `canonicalize/route.ts` lines 5–28
**Apply to:** `canonicalize`, `canonical` routes

```typescript
const { data, error } = await supabase
  .from("study_sets")
  .select("id")
  .eq("id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();
```

### Supabase document upsert
**Source:** `src/lib/pipeline/ingest.ts` lines 286–303
**Apply to:** canonical failure metadata + success `canonical_documents` update

```typescript
await supabase.from("canonical_documents").upsert(
  { user_id, study_set_id, raw_markdown, metadata: { ... } },
  { onConflict: "study_set_id" },
);
```

### Pipeline stage transition
**Source:** `ingest.ts` lines 309–317
**Apply to:** set `pipeline_stage: "canonical"` on success

```typescript
await supabase
  .from("study_sets")
  .update({ pipeline_stage: "canonical" })
  .eq("id", studySetId)
  .eq("user_id", userId);
```

### Zod route error mapping
**Source:** `ingest/route.ts` lines 92–110

```typescript
if (error instanceof ZodError) {
  return NextResponse.json(
    { error: "validation_error", message: "Invalid request." },
    { status: 400 },
  );
}
```

### Toast + sonner
**Source:** `UnifiedInputZone.tsx` lines 5, 87–96
**Apply to:** canonical preview page errors

```typescript
import { toast } from "sonner";
toast.error("Connection lost. Check your network and try again.");
```

### Baseline schema reference
**Source:** `supabase/migrations/20260725120000_v21_baseline.sql`

| Table | Key columns for Phase 3 |
|-------|-------------------------|
| `study_sets` | `pipeline_stage`, `title` |
| `canonical_documents` | `raw_markdown`, `canonical_markdown`, `metadata` jsonb, `original_filename` |
| `canonical_sections` | `ordinal`, `heading`, `body_markdown`, `section_type` |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/canonical/CanonicalMarkdownViewer.tsx` | component | transform | No markdown renderer dependency in repo; use `<pre>` interim or add `react-markdown` |
| `src/lib/pipeline/canonicalPrompt.ts` | utility | transform | No runtime JSON prompt loader; import `prompt/canonical_builder_v1.json` directly |
| `src/components/canonical/CanonicalSectionToc.tsx` | component | request-response | No section TOC / scroll-spy component in v2.1 codebase |
| Legacy `generateFromFile/*` | service | — | Reference only for Zod+repair pattern; do not resurrect v1 pipeline (D-12) |

---

## Metadata

**Analog search scope:** `src/app/api/study-sets/**`, `src/lib/pipeline/**`, `src/lib/client/**`, `src/app/(app)/sets/**`, `src/components/edit/new/**`, `src/components/review/**`, git HEAD for deleted `src/lib/ai/**`, `src/lib/server/**`, `supabase/migrations/**`
**Files scanned:** ~45
**Pattern extraction date:** 2026-07-25
