# Phase 2: Input & MarkItDown - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 16
**Analogs found:** 13 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/study-sets/[id]/ingest/route.ts` | route | request-response, file-I/O | `src/app/api/study-sets/[id]/ingest/route.ts` (stub) + `src/app/api/study-sets/route.ts` | exact |
| `src/lib/pipeline/validation.ts` | utility | transform | `src/lib/pipeline/validation.ts` + git `src/lib/pdf/validatePdfFile.ts` | exact |
| `src/lib/pipeline/validation.test.ts` | test | transform | `src/lib/pipeline/validation.test.ts` | exact |
| `src/lib/pipeline/markitdown.ts` | service | transform, file-I/O | `02-RESEARCH.md` Pattern 2 (no codebase subprocess analog) | no analog |
| `src/lib/pipeline/markitdown.test.ts` | test | transform | `src/lib/pipeline/validation.test.ts` | role-match |
| `src/lib/pipeline/ingest.ts` | service | batch, file-I/O | `src/app/api/study-sets/route.ts` + git `src/lib/db/studySetDb.ts` storage helpers | partial |
| `src/lib/pipeline/ingest.test.ts` | test | batch | `src/lib/pipeline/validation.test.ts` | role-match |
| `src/lib/pipeline/ingestSchemas.ts` (or inline in route) | utility | transform | `src/lib/validations/question.ts` | role-match |
| `src/components/edit/new/NewStudySetUnifiedImportFlow.tsx` | component | request-response, file-I/O | `src/components/edit/new/NewStudySetTextImportFlow.tsx` + git `NewStudySetPdfImportFlow.tsx` | role-match |
| `src/components/edit/new/import/StudySetNewImportStepContext.tsx` | provider | event-driven | current file (extend labels only) | exact |
| `src/app/(app)/edit/new/quiz/page.tsx` | component | request-response | current `quiz/page.tsx` | exact |
| `src/app/(app)/edit/new/flashcards/page.tsx` | component | request-response | current `flashcards/page.tsx` | exact |
| `src/lib/client/ingestStudySet.ts` (recommended helper) | utility | request-response, file-I/O | `src/lib/client/studySetDb.ts` + git PDF import `fetch` | partial |
| `requirements.txt` | config | — | none in repo | no analog |
| `src/components/edit/new/import/IngestProgressStatus.tsx` (minimal, optional) | component | event-driven | git `importUiStage.ts` + `NewStudySetPdfImportProgressChrome.tsx` | partial |
| Legacy cleanup (`generate-from-file`, `/api/uploads/pdf/*`) | route | — | delete only — no new pattern | n/a |

## Pattern Assignments

### `src/app/api/study-sets/[id]/ingest/route.ts` (route, request-response + file-I/O)

**Analog:** `src/app/api/study-sets/[id]/ingest/route.ts` (stub) + `src/app/api/study-sets/route.ts`

**Imports + auth pattern** (ingest stub lines 1–43):

```typescript
import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await ctx.params;
  const verified = await verifyStudySet(auth.supabase, auth.user.id, id);
  if ("error" in verified) {
    return verified.error;
  }
  // ...
}
```

**Keep `verifyStudySet` helper** (ingest stub lines 5–28) — reuse unchanged for ownership check before any side effects.

**JSON body parse + 400 pattern** from `src/app/api/study-sets/route.ts` (lines 35–40):

```typescript
let body: { title?: string; subtitle?: string };
try {
  body = (await req.json()) as { title?: string; subtitle?: string };
} catch {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
```

**Dual Content-Type branch** (RESEARCH Pattern 1 — implement in route, delegate to `runIngest`):

```typescript
const contentType = request.headers.get("content-type") ?? "";
if (contentType.includes("multipart/form-data")) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  return runIngest({ kind: "file", file, studySetId: id, userId: auth.user.id, supabase: auth.supabase });
}
const body = ingestJsonSchema.parse(await request.json());
return runIngest({ ...body, studySetId: id, userId: auth.user.id, supabase: auth.supabase });
```

**Route segment config** (add at file bottom — RESEARCH):

```typescript
export const maxDuration = 120;
export const runtime = "nodejs";
```

**Error status mapping:** validation → `400`; ownership/not found → `404` (existing); conversion failure → `422`; subprocess/DB → `500`.

---

### `src/lib/pipeline/validation.ts` (utility, transform)

**Analog:** current `src/lib/pipeline/validation.ts` + git `src/lib/pdf/validatePdfFile.ts`

**Existing constants** (validation.ts lines 6–68) — extend, do not replace:

```typescript
export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  // ...
] as const;

export function isSupportedMimeType(mime: string): mime is SupportedMimeType {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}
```

**Enforcement return shape** — copy discriminated result from git `validatePdfFile.ts`:

```typescript
export function validatePdfFile(
  file: File,
): { ok: true } | { ok: false; error: PdfValidationError } {
  const looksPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) {
    return { ok: false, error: "type" };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "size" };
  }
  return { ok: true };
}
```

**Phase 2 additions:** `validateFileUpload(mime, sizeBytes): string | null`, `validatePasteInput(text): string | null`, `validateYoutubeUrl(url): string | null`, `validateStoragePath(path, userId, studySetId): string | null`. Return human-readable string on failure (route maps to `{ error: message }`).

**Add `FileRefInput` type** for JSON ingest-by-reference:

```typescript
export type FileRefInput = {
  kind: "file_ref";
  storagePath: string;
  mimeType: SupportedMimeType;
  filename: string;
  sizeBytes: number;
};
```

---

### `src/lib/pipeline/validation.test.ts` (test, transform)

**Analog:** `src/lib/pipeline/validation.test.ts`

**Test structure** (lines 1–49):

```typescript
import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES_BY_MIME,
  SUPPORTED_MIME_TYPES,
} from "@/lib/pipeline/validation";

describe("SUPPORTED_MIME_TYPES", () => {
  it("includes application/pdf and at least 10 distinct MIME strings", () => {
    expect(SUPPORTED_MIME_TYPES).toContain("application/pdf");
    expect(new Set(SUPPORTED_MIME_TYPES).size).toBeGreaterThanOrEqual(10);
  });
});
```

**Extend with:** oversize rejection per MIME, empty paste, non-YouTube URL, path traversal in `validateStoragePath`, happy-path accepts for all `SUPPORTED_MIME_TYPES`.

---

### `src/lib/pipeline/markitdown.ts` (service, transform + file-I/O)

**Analog:** none in codebase — follow RESEARCH Pattern 2; closest I/O pattern is git `studySetDb.ts` temp download/upload.

**Subprocess core** (RESEARCH — implement as exported `convertWithMarkItDown`):

```typescript
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function convertWithMarkItDown(inputPath: string): Promise<string> {
  const outPath = join(tmpdir(), `md-out-${crypto.randomUUID()}.md`);
  const python = process.env.MARKITDOWN_PYTHON ?? "python";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(python, ["-m", "markitdown", inputPath, "-o", outPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `markitdown exited ${code}`));
    });
  });
  try {
    return await readFile(outPath, "utf8");
  } finally {
    await unlink(outPath).catch(() => {});
  }
}
```

**Paste path:** write temp `.txt`, convert, `finally` unlink input temp. **YouTube:** pass validated URL as CLI positional arg (no app-side download).

---

### `src/lib/pipeline/markitdown.test.ts` (test, transform)

**Analog:** `src/lib/pipeline/validation.test.ts` (Vitest node env)

**Mock pattern** (no existing `vi.mock` in repo — establish here):

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

describe("convertWithMarkItDown", () => {
  it("invokes python -m markitdown with -o output path", async () => {
    // assert spawn args: [python, "-m", "markitdown", inputPath, "-o", outPath]
  });
});
```

**Config:** `vitest.config.ts` uses `environment: "node"` and `@` alias — no extra setup needed.

---

### `src/lib/pipeline/ingest.ts` (service, batch + file-I/O)

**Analog:** `src/app/api/study-sets/route.ts` (Supabase writes) + git `src/lib/db/studySetDb.ts` (storage)

**Orchestration signature:**

```typescript
export async function runIngest(ctx: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  input: IngestInput; // paste | youtube | file | file_ref
}): Promise<NextResponse>
```

**Flow order (D-04):** validate → store original → convert → upsert `canonical_documents` → update `study_sets.pipeline_stage = 'raw'`.

**Storage upload (server-side file/multipart)** — git `studySetDb.ts`:

```typescript
const { error } = await supabase.storage.from(params.bucket).upload(params.objectPath, params.bytes, {
  upsert: true,
  contentType: params.contentType,
});
```

**Path convention (D-14):** `doc2quiz` bucket, `{userId}/{studySetId}/{sanitizedFilename}`.

**Storage download for `file_ref`** — git `studySetDb.ts`:

```typescript
const { data, error } = await supabase.storage
  .from(bucket)
  .download(objectPath);
// data.arrayBuffer() → temp file for MarkItDown
```

**canonical_documents upsert** — mirror `study-sets/route.ts` insert + schema from `supabase/migrations/20260725120000_v21_baseline.sql` (lines 55–72):

```typescript
const { error } = await supabase.from("canonical_documents").upsert({
  user_id: userId,
  study_set_id: studySetId,
  original_storage_path: storagePath ?? null,
  original_filename: filename ?? null,
  original_mime_type: mimeType ?? null,
  raw_markdown: markdown,
  metadata: {
    input_type: "file" | "paste" | "youtube",
    source_url: url ?? null,
    conversion_status: "ok",
    markitdown_version: "0.1.6",
  },
}, { onConflict: "study_set_id" });
```

**pipeline_stage update:**

```typescript
await supabase
  .from("study_sets")
  .update({ pipeline_stage: "raw" })
  .eq("id", studySetId)
  .eq("user_id", userId);
```

**Conversion failure (D-06):** upsert `metadata.conversion_status = "failed"`, `conversion_error`, do **not** set `pipeline_stage` to `raw`; return `422`.

---

### `src/lib/pipeline/ingestSchemas.ts` (utility, transform)

**Analog:** `src/lib/validations/question.ts`

**Zod discriminated union for JSON ingest body:**

```typescript
import { z } from "zod";
import { SUPPORTED_MIME_TYPES } from "./validation";

const mimeEnum = z.enum(SUPPORTED_MIME_TYPES as unknown as [string, ...string[]]);

export const ingestJsonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paste"), text: z.string().min(1) }),
  z.object({ kind: z.literal("youtube"), url: z.string().url() }),
  z.object({
    kind: z.literal("file_ref"),
    storagePath: z.string().min(1),
    mimeType: mimeEnum,
    filename: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }),
]);
```

Pair Zod parse with `validation.ts` enforce functions — Zod for shape, validation.ts for business rules (INPUT-VAL-01).

---

### `src/components/edit/new/NewStudySetUnifiedImportFlow.tsx` (component, request-response + file-I/O)

**Analog:** `src/components/edit/new/NewStudySetTextImportFlow.tsx` (current) + git `NewStudySetPdfImportFlow.tsx`

**Step context integration** (TextImportFlow lines 31–32, 43–44):

```typescript
const { setStep } = useStudySetNewImportStep();
// ...
setStep("read");
```

**Create-then-ingest sequence** — replace `createStudySet({ extractedText })` with:

```typescript
const studySetId = await createStudySetEarlyMeta({ title, contentKind });
// upload file to Storage if needed, then:
const res = await fetch(`/api/study-sets/${studySetId}/ingest`, { method: "POST", ... });
```

`createStudySetEarlyMeta` from `src/lib/client/studySetDb.ts` (lines 170–191):

```typescript
export async function createStudySetEarlyMeta(input: {
  title: string;
  subtitle?: string;
  contentKind?: StudyContentKind;
}): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const id = createRandomUuid();
  const { error } = await supabase.from("study_sets").insert({
    id,
    user_id: userId,
    title: input.title,
    pipeline_stage: "input",
    content_kind: input.contentKind ?? null,
  });
  assertNoError(error, "createStudySetEarlyMeta failed");
  return id;
}
```

**Client-direct Storage upload** (RESEARCH Pattern 3) — before JSON `file_ref` ingest:

```typescript
const path = `${userId}/${studySetId}/${sanitizedFilename}`;
const { error } = await supabase.storage.from("doc2quiz").upload(path, file, {
  contentType: file.type,
  upsert: true,
});
```

**Error surfacing** (TextImportFlow lines 54–58):

```typescript
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Could not create study set.";
  toast.error(message);
  setStep("upload");
}
```

**File drop UI** — adapt git `UploadBox.tsx` drag/drop shell (`onDrop`, `tall` min-h-[280px]) but replace `validatePdfFile` with client-side pre-check using `isSupportedMimeType` + `MAX_UPLOAD_BYTES_BY_MIME` from `validation.ts`. Use `Tabs` from `src/components/ui/tabs.tsx` for file / paste / YouTube.

**Progress states (D-12):** `idle | validating | uploading | converting | done | error` — real labels only; no percentage bars. Map to `setStep("upload"|"read"|"generate")` for tab strip compatibility.

**Post-ingest navigation (D-13):** `router.push(getPostIngestHref(studySetId))` — prefer `/sets/{id}/source` placeholder or `editQuiz`/`editFlashcards` with banner.

---

### `src/components/edit/new/import/StudySetNewImportStepContext.tsx` (provider, event-driven)

**Analog:** current file — extend labels only per UI-SPEC

**Existing step machine** (lines 7–41):

```typescript
export type StudySetNewImportStep = "upload" | "read" | "generate";

const PHASE_LABELS: Record<StudySetNewImportStep, string> = {
  upload: "Add text",
  read: "Save document",
  generate: "Open editor",
};
```

**Phase 2 label update** (Impeccable — non-PDF copy): e.g. `"Add source"`, `"Convert"`, `"Continue"`. Keep three-step shape; do not add fake progress percent.

---

### `src/app/(app)/edit/new/quiz/page.tsx` + `flashcards/page.tsx` (component, request-response)

**Analog:** current pages

**Page shell pattern** (quiz/page.tsx lines 11–38):

```typescript
export default function NewStudySetQuizPage() {
  const getPostCreateHref = useCallback((id: string) => editQuiz(id), []);

  return (
    <QuizNewImportWorkbench>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard" ...>Back</Link>
        <div className="mt-4 max-w-xl border-t border-border/40 pt-4">
          <ImportStepTabStrip />
        </div>
      </div>
      <NewStudySetUnifiedImportFlow
        contentKind="quiz"
        pageHeading="Add your source material"
        pageSubcopy="Upload a file, paste text, or paste a YouTube URL."
        getPostIngestHref={getPostCreateHref}
      />
    </QuizNewImportWorkbench>
  );
}
```

Swap `NewStudySetTextImportFlow` → unified component; keep `QuizNewImportWorkbench` / `FlashcardsImportWorkbench` wrappers unchanged.

---

### `src/lib/client/ingestStudySet.ts` (utility, recommended)

**Analog:** `src/lib/client/studySetDb.ts` + git PDF flow `fetch` (lines 185–191)

**Thin client wrapper:**

```typescript
export async function postIngestJson(studySetId: string, body: IngestJsonBody) {
  const res = await fetch(`/api/study-sets/${studySetId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error ?? "Ingest failed");
  }
  return payload;
}
```

Keeps fetch/error parsing out of the UI component.

---

### `requirements.txt` (config)

**Analog:** none

Pin per RESEARCH: `markitdown[all]==0.1.6`. Document Python ≥3.10 in README dev setup section.

---

### `src/components/edit/new/import/IngestProgressStatus.tsx` (component, optional)

**Analog:** git `importUiStage.ts` + `NewStudySetPdfImportProgressChrome.tsx` (simplified)

**Real step labels only** — copy eyebrow/headline pattern without `importUiProgressPercent`:

```typescript
export function importUiHeadline(stage: ImportUiStage): string {
  switch (stage) {
    case "upload":
      return "Uploading file…";
    case "read":
      return "Reading content…";
    case "generate":
      return "Generating study set…";
  }
}
```

**Phase 2 mapping:** `validating` → "Checking file…", `uploading` → "Uploading…", `converting` → "Converting to Markdown…". Use `border-l-[6px]` accent from git progress chrome. **Do not** reuse `UnifiedImportStatusCard` wholesale — it couples to v1 AI parse progress (`useParseProgress`).

---

## Shared Patterns

### Authentication (API)

**Source:** `src/lib/api/requireApiUser.ts`

**Apply to:** `ingest/route.ts` and any new ingest-related routes

```typescript
export async function requireApiUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    } as const;
  }

  return { supabase, user } as const;
}
```

### Study set ownership verification

**Source:** `src/app/api/study-sets/[id]/ingest/route.ts` (lines 5–28)

**Apply to:** ingest route before any Storage/subprocess/DB write

```typescript
const { data, error } = await supabase
  .from("study_sets")
  .select("id")
  .eq("id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

if (!data) {
  return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
}
```

### Supabase client contexts

**Source:** Phase 1 PATTERNS.md

| Context | Import |
|---------|--------|
| Route handlers | `createSupabaseServerClient()` from `@/lib/supabase/server` |
| Client components | `createSupabaseBrowserClient()` from `@/lib/client/supabase` |

### Error handling in API routes

**Source:** `src/app/api/study-sets/route.ts` + ingest stub

- JSON parse failure → `400 { error: "Invalid JSON body" }`
- Supabase error → `500 { error: error.message }`
- Validation (INPUT-VAL-01) → `400 { error: "<actionable message>" }` **before** side effects (D-05)
- Conversion failure → `422 { error: "<actionable message>" }` with failed metadata (D-06)

### Client toast errors

**Source:** `src/components/edit/new/NewStudySetTextImportFlow.tsx` (lines 5, 38, 57)

```typescript
import { toast } from "sonner";
toast.error("Paste or upload text before continuing.");
```

### Validation before side effects

**Source:** `src/lib/pipeline/validation.ts` + D-05

All paths (multipart, JSON paste/youtube/file_ref) must call `validate*` helpers and return 4xx before Storage upload, download, subprocess, or DB write.

### Storage path security

**Source:** RESEARCH Security Domain

Reject `storagePath` not matching `^${userId}/${studySetId}/` before download — prevents cross-user path traversal.

### canonical_documents schema

**Source:** `supabase/migrations/20260725120000_v21_baseline.sql` (lines 55–72)

Columns: `original_storage_path`, `original_filename`, `original_mime_type`, `raw_markdown`, `metadata` jsonb. Upsert on `study_set_id` at first ingest (not at study-set creation).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/pipeline/markitdown.ts` | service | transform, file-I/O | No `child_process` usage anywhere in codebase; implement per RESEARCH Pattern 2 |
| `requirements.txt` | config | — | No Python deps file in repo yet |
| `src/lib/pipeline/ingest.ts` orchestration | service | batch | Closest is deleted v1 `generate-from-file` + `studySetDb` PDF pipeline — different architecture; use RESEARCH flow + Phase 1 Supabase patterns |

## Metadata

**Analog search scope:** `src/app/api/study-sets/`, `src/lib/pipeline/`, `src/lib/api/`, `src/lib/client/`, `src/components/edit/new/`, `src/components/upload/` (git HEAD), `supabase/migrations/`, git HEAD for deleted v1 import/upload files

**Files scanned:** ~35 (working tree + git HEAD recovery)

**Pattern extraction date:** 2026-07-25

**Working tree caveat:** `UploadBox.tsx`, `UnifiedImportStatusCard.tsx`, `importUiStage.ts`, `NewStudySetPdfImportFlow.tsx`, `generate-from-file/route.ts`, and `/api/uploads/pdf/*` are deleted or absent on disk — patterns extracted from git HEAD. Current import UI is paste-only (`NewStudySetTextImportFlow.tsx`). Ingest stub and `validation.ts` exist and are the primary live analogs.
