# Phase 3: Canonical Knowledge - Research

**Researched:** 2026-07-25
**Domain:** LLM structured-output integration, prompt loading, Supabase canonical persistence, preview UI
**Confidence:** HIGH (codebase patterns) / MEDIUM (chunking at scale, AI infra restore scope)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carrying forward
- **D-P1-04–06:** `canonical_documents` + `canonical_sections` tables; 1:1 with `study_sets`.
- **D-P1-17:** Canonicalize route is `POST /api/study-sets/[id]/canonicalize` — Phase 3 replaces 501 stub.
- **D-P2-04:** Input ends with `pipeline_stage = raw` and `canonical_documents.raw_markdown` populated.

#### Canonical Knowledge Builder (AI)
- **D-01:** Builder is **LLM-powered** using user-supplied API keys via same-origin **`/api/ai/forward`** pattern (PROJECT.md). No embedded vendor keys in server env for generation.
- **D-02:** **Single structured output** per canonicalize run: `{ canonicalMarkdown, sections[], metadata }` validated with **Zod** before any DB write.
- **D-03:** **CANON-08 guardrails:** System prompt + output schema enforce *never invent* — title/filename derived only from source headings/filenames; sections must map to source headings/blocks; reject/sanitize outputs that add facts not in `raw_markdown`.
- **D-04:** Builder responsibilities (CANON-01–07): clean noise, preserve structure, detect language/type, extract Q&A, split sections, generate title/filename.
- **D-05:** On success: upsert `canonical_markdown`, replace `canonical_sections` rows (delete+insert in transaction), merge metadata, set `pipeline_stage = canonical`, update `study_sets.title` from metadata.title if present.
- **D-06:** On failure: return 422 with error; set `metadata.canonicalization_status = failed`; do not overwrite good canonical data with partial output.

#### API behavior
- **D-07:** `POST /canonicalize` requires `pipeline_stage` at least `raw` and non-empty `raw_markdown`; idempotent re-run allowed.
- **D-08:** `GET /api/study-sets/[id]/canonical` (or extend existing GET) returns canonical markdown + sections + metadata for preview UI — read-only.

#### Canonical preview UI
- **D-09:** Replace legacy `/sets/[id]/source` redirect with **canonical preview page**.
- **D-10:** After ingest (Phase 2), post-canonicalize navigation lands on preview page. No Quiz/Flashcards generation buttons yet.
- **D-11:** Identity preservation — reuse existing typography/tokens; read-only markdown viewer (prose styles).

#### Legacy cleanup
- **D-12:** Remove/stop using v1 canonical extraction (`generateFromFile/canonical*`, `canonical_document_extractions` patterns).

#### Locked prompt contract (`prompt/canonical_builder_v1.json`)
- **D-13:** **Authoritative prompt spec** — load `prompt/canonical_builder_v1.json` at runtime; do not duplicate system/tasks/constraints in code. Version field `1.0` logged in `metadata.prompt_version`.
- **D-14:** **Input template variables** filled from `canonical_documents` + `study_sets`: `source_id`, `source_type`, `original_filename`, `raw_markdown`.
- **D-15:** **LLM must return JSON only** matching `output_schema` in the prompt file — validate with Zod derived from that schema before DB write.
- **D-16:** **Schema → Supabase mapping** (title, filename, language, document_type, topics, canonical_markdown, sections[], extracted_questions, warnings).
- **D-17:** **Stable section IDs** — preserve LLM `sec_001` style IDs in `canonical_sections` (add `section_key` column or store in jsonb on section row) for flashcard coverage picker in Phase 5.
- **D-18:** Prompt constraints are binding: no invented facts, no quiz/flashcard generation in builder, no external knowledge, do not discard meaningful content.

### Claude's Discretion
- Model selection via user settings (which provider/model for canonicalize)
- Chunking strategy for very long raw markdown (if raw exceeds context window)
- Whether `section_key` is a new DB column vs nested in section metadata jsonb

### Deferred Ideas (OUT OF SCOPE)
- MODE-01 Quiz vs Flashcards selection UI — Phase 4
- MCQ/flashcard generation — Phases 4–5
- Separate quality-validation stage — OOS-03
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANON-01 | Builder cleans extraction noise and removes duplicates | Prompt tasks + `canonical_markdown` output; Zod validates non-empty cleaned body |
| CANON-02 | Builder preserves headings, tables, formulas, examples | Prompt tasks; section `body_markdown` + full `canonical_markdown` stored |
| CANON-03 | Builder detects document language | `language` → `metadata.language` |
| CANON-04 | Builder detects content type: theory, exam, or mixed | `document_type` enum → `metadata.content_type` |
| CANON-05 | Builder extracts existing questions and answer keys when present | `extracted_questions[]` → `metadata.extracted_questions[]` |
| CANON-06 | Builder splits content into stable sections | `sections[]` → `canonical_sections` rows with `section_key` (`sec_001`) |
| CANON-07 | Builder generates title and clean filename (no invention) | `title`, `filename` → metadata + `study_sets.title` |
| CANON-08 | Builder never invents information not present in source | Prompt constraints + optional post-validate substring checks on title/filename |
</phase_requirements>

## Summary

Phase 3 wires the **locked** `prompt/canonical_builder_v1.json` into a server-side Canonical Knowledge Builder that transforms `canonical_documents.raw_markdown` into cleaned markdown, structured sections, and rich metadata, then persists to Supabase and advances `pipeline_stage` to `canonical`. The canonicalize route stub at `src/app/api/study-sets/[id]/canonicalize/route.ts` already has auth + study-set verification; implementation fills in LLM orchestration and DB writes.

**Critical codebase state:** The working tree has **deleted** the entire `src/lib/server/` directory and `/api/ai/forward` (among other v1 AI routes). Phase 2 pipeline code (`src/lib/pipeline/ingest.ts`) remains. Phase 3 must **restore a minimal server AI stack** (`openAiChatCompletion`, `ai-processing-config`, `resolveUserAiTier`) before the builder can call an LLM. The v1 pattern in `extractCanonicalSourceUnits.ts` (git HEAD) is the reference implementation — not the deleted `generateFromFile/canonical*` pipeline (D-12).

**AI call path for canonicalize:** `POST /canonicalize` is a **server route**. It must **not** use browser-only `forwardAiPost` from `sameOriginForward.ts`. Use server-direct `postChatCompletionAssistantText` with `getAiProcessingConfig(tier)` — same upstream fetch the forward route performed, without a browser round-trip. CONTEXT D-01's "same-origin forward pattern" means AI calls go through Next.js server routes (never browser→vendor direct), not that canonicalize must literally HTTP-loop through `/api/ai/forward`. [VERIFIED: codebase grep + git HEAD `openAiChatCompletion.ts`, `forward/route.ts`]

**Prompt integration:** Load JSON at runtime, substitute `{{…}}` template variables into the `input` block, assemble system message from `system` + `tasks` + `constraints` + serialized `output_schema`, send `raw_markdown` in user content, parse JSON response, validate with hand-written Zod mirroring `output_schema`, map to Supabase columns.

**Primary recommendation:** Implement `src/lib/canonical/` module (prompt loader → builder → persister) called from canonicalize route; add `section_key` column migration; restore minimal `src/lib/server/` AI helpers; single-pass LLM up to ~120k chars with truncation warning, defer map-reduce chunking unless testing proves necessary.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Load prompt JSON + template substitution | API / Backend | — | Server-only; prompt file is build artifact, not client-exposed |
| LLM chat completion (structured JSON) | API / Backend | — | Secrets + upstream URL stay server-side via `getAiProcessingConfig` |
| Zod validation of LLM output | API / Backend | — | Gate before any DB write (D-02, D-15) |
| Persist canonical markdown/sections/metadata | Database / Storage | API / Backend | Supabase tables + RLS; orchestration in route/service |
| `pipeline_stage` advancement | Database / Storage | API / Backend | `study_sets.pipeline_stage` update after successful persist |
| Canonical preview rendering | Browser / Client | Frontend Server (SSR) | Client page at `/sets/[id]/source`; fetches via API or Supabase client |
| Auto-trigger canonicalize on `raw` stage | Browser / Client | API / Backend | UI calls `POST /canonicalize`; builder runs server-side |
| Section TOC / metadata chips | Browser / Client | — | Read-only display of persisted data |
| Long-document chunking | API / Backend | — | Context-budget logic before LLM call; invisible to client |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^4.4.3 (installed) | Validate LLM JSON output before DB write | Already used in Phase 2 ingest schemas; project standard [VERIFIED: package.json] |
| Next.js App Router | ^16.2.11 | API routes + client preview page | Existing stack [VERIFIED: package.json] |
| `@supabase/supabase-js` | ^2.110.8 | Persist canonical_documents/sections | Phase 1 schema + RLS [VERIFIED: migration SQL] |
| OpenAI-compatible chat API | — | Structured JSON from locked prompt | Existing `postChatCompletionAssistantText` pattern [VERIFIED: git HEAD] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | built-in | Load `prompt/canonical_builder_v1.json` at runtime | Server modules only; avoids bundling prompt into client |
| `MathText` component | existing | Render canonical markdown with math | Preview page prose viewer (tables/code via HTML from markdown) |
| `vitest` | ^3.2.4 | Unit/integration tests | Phase 2 established pattern [VERIFIED: vitest.config.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written Zod from `output_schema` | `zod-to-json-schema` / dynamic JSON Schema → Zod | Prompt `output_schema` is illustrative JSON, not JSON Schema; hand-written Zod is explicit and matches D-15 |
| Server-direct `postChatCompletionAssistantText` | HTTP self-call to `/api/ai/forward` | Self-call adds latency and auth complexity; direct helper is v1 pattern |
| `section_key` DB column | jsonb on section row | Column enables indexed lookup for Phase 5 coverage picker; recommended |
| Map-reduce chunking | Single-pass + truncate | Single-pass matches v1 `EXTRACTION_TEXT_BUDGET_CHARS`; map-reduce is discretion |

**Installation:** No new packages required for core Phase 3.

**Version verification:**
```bash
npm view zod version          # 4.4.3
# package.json: "zod": "^4.4.3"
```

## Package Legitimacy Audit

> Phase 3 adds **no new external packages**. Existing `zod` verified.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| zod | npm | ~8 yrs | very high | github.com/colinhacks/zod | [OK] | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
[Ingest complete: pipeline_stage=raw]
        │
        ▼
[/sets/{id}/source page loads]
        │
        ├── pipeline_stage = raw ──► POST /api/study-sets/{id}/canonicalize
        │                                      │
        │                                      ▼
        │                            [Load prompt/canonical_builder_v1.json]
        │                                      │
        │                                      ▼
        │                            [Substitute {{source_id}}, {{source_type}},
        │                             {{original_filename}}, {{raw_markdown}}]
        │                                      │
        │                                      ▼
        │                            [Optional: truncate/chunk if > budget]
        │                                      │
        │                                      ▼
        │                            [postChatCompletionAssistantText
        │                             response_format: json_object]
        │                                      │
        │                         ┌────────────┴────────────┐
        │                         ▼                         ▼
        │                   [Zod parse OK]            [Zod fail → repair retry]
        │                         │                         │
        │                         └────────────┬────────────┘
        │                                      ▼
        │                            [Map to canonical_documents +
        │                             canonical_sections rows]
        │                                      │
        │                         ┌────────────┴────────────┐
        │                         ▼                         ▼
        │                   [DB txn OK]              [DB fail → 422,
        │                   pipeline_stage=canonical  status=failed]
        │                         │
        ▼                         ▼
[GET /api/study-sets/{id}/canonical] ◄── read canonical_markdown,
        │                                  sections[], metadata
        ▼
[Preview UI: metadata chips + MathText prose viewer + Phase 4 placeholder CTA]
```

### Recommended Project Structure

```text
prompt/
  canonical_builder_v1.json          # LOCKED — do not duplicate text in code

src/lib/canonical/
  loadCanonicalPrompt.ts             # fs read + cache + version
  substitutePromptInput.ts           # {{var}} replacement
  buildCanonicalMessages.ts          # system + user messages from prompt spec
  canonicalBuilderSchema.ts          # Zod mirroring output_schema
  mapCanonicalOutputToDb.ts          # LLM output → Supabase row shapes
  runCanonicalBuilder.ts             # LLM call + retry + parse
  persistCanonicalKnowledge.ts       # delete sections + upsert doc + update study_set
  chunkRawMarkdown.ts                # budget/truncation (discretion)

src/lib/server/                      # RESTORE (deleted in working tree)
  openAiChatCompletion.ts
  ai-processing-config.ts
  resolveUserAiTier.ts

src/app/api/study-sets/[id]/
  canonicalize/route.ts              # POST — replace 501 stub
  canonical/route.ts                 # GET — new read endpoint (D-08)

src/app/(app)/sets/[id]/source/
  page.tsx                           # Preview UI per 03-UI-SPEC.md

supabase/migrations/
  YYYYMMDD_add_section_key.sql       # section_key column (recommended)
```

### Pattern 1: Runtime Prompt Load (locked JSON)

**What:** Read `prompt/canonical_builder_v1.json` once per process (module cache), expose `version` for `metadata.prompt_version`.

**When to use:** Every canonicalize run. Never hardcode system/tasks/constraints (D-13).

**Example:**
```typescript
// Source: prompt/canonical_builder_v1.json structure [VERIFIED: file read]
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CanonicalPromptSpec = {
  name: string;
  version: string;
  system: string;
  input: Record<string, string>;
  tasks: string[];
  output_schema: Record<string, unknown>;
  constraints: string[];
};

let cached: CanonicalPromptSpec | null = null;

export async function loadCanonicalPrompt(): Promise<CanonicalPromptSpec> {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "prompt", "canonical_builder_v1.json");
  const raw = await readFile(filePath, "utf8");
  cached = JSON.parse(raw) as CanonicalPromptSpec;
  return cached;
}
```

### Pattern 2: Template Substitution

**What:** Replace `{{key}}` placeholders in prompt `input` values with runtime data from DB.

**When to use:** Before building the user message (D-14).

**Example:**
```typescript
// Source: prompt/canonical_builder_v1.json input block [VERIFIED]
export function substituteTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// vars: { source_id, source_type, original_filename, raw_markdown }
// source_type ← canonical_documents.metadata.input_type
// original_filename ← canonical_documents.original_filename ?? study_sets.title
```

### Pattern 3: Zod Schema from output_schema

**What:** Hand-written Zod enum/object schema matching the locked `output_schema` shape. Validate **after** `JSON.parse`, **before** DB write.

**When to use:** Every successful LLM response (D-02, D-15).

**Example:**
```typescript
// Source: prompt/canonical_builder_v1.json output_schema [VERIFIED]
import { z } from "zod";

const sectionSchema = z.object({
  id: z.string().regex(/^sec_\d{3}$/),
  title: z.string().min(1),
  content: z.string(),
  content_type: z.enum(["theory", "question", "answer_key", "example", "reference"]),
});

export const canonicalBuilderOutputSchema = z.object({
  title: z.string().min(1),
  filename: z.string().min(1),
  language: z.string().min(1),
  document_type: z.enum(["theory", "exam", "mixed"]),
  topics: z.array(z.string()),
  canonical_markdown: z.string(),
  sections: z.array(sectionSchema).min(1),
  extracted_questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answer: z.string().nullable(),
      section_id: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});
```

### Pattern 4: Server LLM Call (not browser forward)

**What:** Use `postChatCompletionAssistantText` with `response_format: { type: "json_object" }`, temperature 0, optional repair retry on Zod failure — mirror `extractCanonicalSourceUnits.ts`.

**When to use:** Inside `runCanonicalBuilder` from canonicalize route.

**Example:**
```typescript
// Source: git HEAD src/lib/server/openAiChatCompletion.ts, extractCanonicalSourceUnits.ts [VERIFIED]
const first = await postChatCompletionAssistantText({
  configUrl: cfg.url,
  apiKey: cfg.key,
  model: cfg.model,
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPayload },
  ],
  responseFormatJsonObject: true,
  temperature: 0,
});
// parse JSON → canonicalBuilderOutputSchema.safeParse → repair retry if fail
```

### Pattern 5: Schema → Supabase Mapping (D-16, D-17)

**What:** Map validated output to `canonical_documents` + `canonical_sections` + metadata jsonb.

| LLM field | DB target |
|-----------|-----------|
| `title` | `metadata.title` + `study_sets.title` |
| `filename` | `metadata.clean_filename` |
| `language` | `metadata.language` |
| `document_type` | `metadata.content_type` |
| `topics` | `metadata.topics` |
| `canonical_markdown` | `canonical_documents.canonical_markdown` |
| `sections[i].id` | `canonical_sections.section_key` |
| `sections[i]` order | `canonical_sections.ordinal` (1-based) |
| `sections[i].title` | `canonical_sections.heading` |
| `sections[i].content` | `canonical_sections.body_markdown` |
| `sections[i].content_type` | `canonical_sections.section_type` |
| `extracted_questions` | `metadata.extracted_questions` |
| `warnings` | `metadata.warnings` |
| prompt `version` | `metadata.prompt_version` |
| — | `metadata.canonicalization_status = "ok"` on success |

**Persist order (D-05, D-06):**
1. Validate preconditions (`pipeline_stage >= raw`, `raw_markdown` non-empty)
2. Call builder
3. On Zod/LLM failure: set `metadata.canonicalization_status = "failed"` only if no prior canonical data OR merge failure flag; return 422; **do not** delete existing sections
4. On success: `DELETE FROM canonical_sections WHERE canonical_document_id = ?` then `INSERT` new rows; `UPDATE canonical_documents`; `UPDATE study_sets SET pipeline_stage = 'canonical', title = ?`

**Recommended migration for D-17:**
```sql
ALTER TABLE public.canonical_sections
  ADD COLUMN IF NOT EXISTS section_key text;

CREATE UNIQUE INDEX IF NOT EXISTS canonical_sections_document_section_key_unique
  ON public.canonical_sections (canonical_document_id, section_key)
  WHERE section_key IS NOT NULL;
```

### Pattern 6: Chunking Long Documents (Claude's discretion)

**What:** v1 used `EXTRACTION_TEXT_BUDGET_CHARS = 120_000` with truncation note [VERIFIED: git HEAD `canonicalConstants.ts`]. Existing `chunkText.ts` (1000-char chunks) targets MCQ parsing, **not** canonical builder — do not reuse those constants.

**Recommended default (single-pass):**
- If `raw_markdown.length <= 120_000`: send full text
- If longer: truncate to 120_000 chars, add warning `"Document truncated for canonicalization"` to persisted `metadata.warnings` and LLM `warnings`

**Optional map-reduce (if single-pass quality insufficient):**
1. Split on markdown heading boundaries (`/^#{1,6}\s/m`) keeping chunks ≤ 80k chars
2. Run builder per chunk with prompt addendum: `"Emit sections for this chunk only; use sec_XXX IDs unique across chunks"`
3. Merge: concatenate `canonical_markdown`, renumber ordinals, dedupe `section_key` collisions
4. Higher complexity — defer unless user documents exceed budget in testing

### Anti-Patterns to Avoid

- **Duplicating prompt text in TypeScript:** Violates D-13; only reference `prompt/canonical_builder_v1.json`
- **Browser `forwardAiPost` from canonicalize route:** Server route cannot use browser fetch helper
- **Resurrecting v1 `generateFromFile/canonical*`:** D-12 explicitly supersedes; reference only for LLM retry pattern
- **Partial DB writes on failure:** D-06 requires atomic replace or no-op on existing good data
- **Storing `sec_001` only in jsonb without `section_key`:** Phase 5 coverage picker needs stable queryable keys

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON output validation | Ad-hoc `typeof` checks | Zod schema from `output_schema` | Nested arrays, enums, nullable `answer`, repair messaging |
| OpenAI HTTP client | Custom fetch wrapper | `postChatCompletionAssistantText` | Retry, `response_format`, error normalization already exist |
| Prompt versioning | Inline string constants | Load JSON + `metadata.prompt_version` | D-13 locked contract |
| Markdown fence stripping | Regex-only parser | `stripJsonFence` from v1 extraction | Handles ```json fences from models |
| Section ID generation | Server-side re-ID | Preserve LLM `sec_001` in `section_key` | D-17 stable IDs for Phase 5 |
| Auth on API routes | Custom session parsing | `requireApiUser()` | Established in canonicalize stub |

**Key insight:** The locked prompt is the contract; code should load, substitute, validate, and map — not reinterpret responsibilities.

## Common Pitfalls

### Pitfall 1: Deleted Server AI Infrastructure

**What goes wrong:** Canonicalize build fails — imports from `@/lib/server/*` missing.

**Why it happens:** Working tree deleted entire `src/lib/server/` and `/api/ai/*` during v2 purge.

**How to avoid:** Wave 0 task: restore `openAiChatCompletion.ts`, `ai-processing-config.ts`, `resolveUserAiTier.ts` from git HEAD (minimal set). Do not restore full `generateFromFile/*`.

**Warning signs:** `npm run typecheck` errors on missing `@/lib/server/...`

### Pitfall 2: D-01 vs .env Reality

**What goes wrong:** Planner implements browser BYOK when server env is the working pattern.

**Why it happens:** CONTEXT says "user-supplied API keys via forward" but `.env.example` uses `AI_PROVIDER_URL` / `AI_PROVIDER_KEY` and forward route applies server config [VERIFIED: .env.example, git HEAD forward route].

**How to avoid:** Canonicalize uses `getAiProcessingConfig(resolveUserAiTier(user))` server-side. Document that "same-origin forward" = server-mediated upstream, not client localStorage keys (purged in `forwardSettings.ts`).

**Warning signs:** Importing `forwardAiPost` in server route.

### Pitfall 3: JSON Parse Failures from LLM

**What goes wrong:** 422 on every run; model returns markdown fences or prose.

**Why it happens:** Models wrap JSON in code fences despite instructions.

**How to avoid:** `stripJsonFence` + one repair retry with schema error message (v1 pattern in `extractCanonicalSourceUnits.ts`).

**Warning signs:** `JSON.parse` throws on otherwise successful HTTP 200.

### Pitfall 4: Non-Atomic Section Replace

**What goes wrong:** Orphan sections or empty document after mid-write failure.

**Why it happens:** Insert-before-delete or missing transaction.

**How to avoid:** Delete sections → insert new → update document in single logical unit; on any failure, return 422 without advancing `pipeline_stage`.

**Warning signs:** `canonical_sections` count ≠ `sections.length` after failed run.

### Pitfall 5: Overwriting Good Canonical on Re-run Failure

**What goes wrong:** User re-canonicalizes (D-07 idempotent), LLM fails, prior canonical data lost.

**Why it happens:** Delete sections before LLM call succeeds.

**How to avoid:** Call LLM + validate first; only then mutate DB. On failure after prior `canonical` stage, keep existing rows (D-06).

**Warning signs:** `pipeline_stage` still `canonical` but `canonical_markdown` empty after failed re-run.

### Pitfall 6: Preview Page Shows Raw After Canonical

**What goes wrong:** UI still shows raw markdown preview stub.

**Why it happens:** `source/page.tsx` currently reads `raw_markdown` only [VERIFIED: current file].

**How to avoid:** After canonicalize, fetch `canonical_markdown` + metadata; show progress state during POST; auto-trigger when `pipeline_stage === "raw"` per 03-UI-SPEC.

## Code Examples

### stripJsonFence (from v1)

```typescript
// Source: git HEAD extractCanonicalSourceUnits.ts [VERIFIED]
function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}
```

### Build System Prompt from Locked Spec

```typescript
// Source: prompt/canonical_builder_v1.json [VERIFIED]
export function buildSystemPrompt(spec: CanonicalPromptSpec): string {
  return [
    spec.system,
    "",
    "Tasks:",
    ...spec.tasks.map((t, i) => `${i + 1}. ${t}`),
    "",
    "Constraints:",
    ...spec.constraints.map((c) => `- ${c}`),
    "",
    "Return JSON matching this schema exactly:",
    JSON.stringify(spec.output_schema, null, 2),
  ].join("\n");
}
```

### Canonicalize Route Orchestration Sketch

```typescript
// Source: canonicalize/route.ts stub + ingest/route.ts pattern [VERIFIED]
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  // 1. Load study_set + canonical_documents (verify pipeline_stage, raw_markdown)
  // 2. const result = await runCanonicalBuilder({ ... })
  // 3. if (!result.ok) { mark failed metadata; return 422 }
  // 4. await persistCanonicalKnowledge({ ... })
  // 5. return NextResponse.json({ studySetId: id, pipelineStage: "canonical", sectionCount })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 `canonical_document_extractions` + `generateFromFile` | `canonical_documents` + locked JSON prompt | v2.1 Phase 3 | D-12 — do not resurrect v1 tables |
| Browser BYOK localStorage forward | Server env `AI_PROVIDER_*` via forward route | Phase 19 purge | Canonicalize uses server config |
| `chunkText` 1k-char MCQ chunks | Single-pass ~120k budget for canonical | Phase 3 discretion | Different chunking semantics |
| Inline prompt strings in TS | `prompt/canonical_builder_v1.json` | Phase 3 D-13 | Load at runtime |

**Deprecated/outdated:**
- `src/lib/server/generateFromFile/*` — reference for patterns only, not pipeline
- `forwardSettings.ts` localStorage BYOK — purged; server env is source of truth

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Canonicalize should use server-direct `postChatCompletionAssistantText`, not HTTP loop to `/api/ai/forward` | Pattern 4 | Unnecessary complexity if user insists on literal forward route |
| A2 | `AI_PROVIDER_URL` / `AI_PROVIDER_KEY` env vars are the active AI config (not client BYOK) | Pitfall 2 | Builder non-functional if different key mechanism required |
| A3 | Single-pass with 120k char budget is sufficient for MVP | Pattern 6 | Quality degradation on very long documents |
| A4 | `section_key` as dedicated column is preferred over jsonb | Pattern 5 | Phase 5 queries harder if jsonb chosen |
| A5 | `src/lib/server/` must be restored from git HEAD as Wave 0 | Pitfall 1 | Build blocked until restored |

## Open Questions (RESOLVED)

1. **D-01 user API keys vs server env** — **RESOLVED:** Server env (`AI_PROVIDER_URL`/`AI_PROVIDER_KEY` from `.env`) for Phase 3 MVP. BYOK deferred.

2. **Chunking beyond 120k chars** — **RESOLVED:** Single-pass with truncation + `warnings[]` in output; map-reduce deferred.

3. **`section_key` column vs jsonb** — **RESOLVED:** Add `section_key text` column on `canonical_sections` (plan 03-01).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | (host) | — |
| `AI_PROVIDER_URL` + `AI_PROVIDER_KEY` | LLM canonical builder | ✗ (env-dependent) | — | Return 503 "AI processing unavailable" via `isAiProcessingConfigured()` |
| `AI_MODEL_FREE` / `AI_MODEL_PRO` | Model selection | optional | defaults in config | `mineru25` / `gpt-4.1-mini` [VERIFIED: git HEAD ai-processing-config] |
| Supabase | Persistence | ✓ (project) | — | Phase 1 baseline |
| `prompt/canonical_builder_v1.json` | Prompt load | ✓ | 1.0 | — |
| Python/MarkItDown | Ingest only | ✓ (Phase 2) | — | Not needed for canonicalize |

**Missing dependencies with no fallback:**
- `AI_PROVIDER_URL` + `AI_PROVIDER_KEY` — canonicalize cannot run without LLM upstream

**Missing dependencies with fallback:**
- Pro-tier model — falls back to free-tier model via `resolveAiModel`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/canonical --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANON-01 | Output schema accepts cleaned markdown; rejects empty canonical_markdown | unit | `npx vitest run src/lib/canonical/canonicalBuilderSchema.test.ts -x` | ❌ Wave 0 |
| CANON-02 | Sections preserve heading/content in mapping | unit | `npx vitest run src/lib/canonical/mapCanonicalOutputToDb.test.ts -x` | ❌ Wave 0 |
| CANON-03 | `language` field mapped to metadata | unit | `npx vitest run src/lib/canonical/mapCanonicalOutputToDb.test.ts -x` | ❌ Wave 0 |
| CANON-04 | `document_type` enum validation | unit | `npx vitest run src/lib/canonical/canonicalBuilderSchema.test.ts -x` | ❌ Wave 0 |
| CANON-05 | `extracted_questions` array mapped | unit | `npx vitest run src/lib/canonical/mapCanonicalOutputToDb.test.ts -x` | ❌ Wave 0 |
| CANON-06 | `sec_001` → `section_key`, ordinal order | unit | `npx vitest run src/lib/canonical/mapCanonicalOutputToDb.test.ts -x` | ❌ Wave 0 |
| CANON-07 | Title/filename mapped; study_sets.title updated | unit | `npx vitest run src/lib/canonical/mapCanonicalOutputToDb.test.ts -x` | ❌ Wave 0 |
| CANON-08 | Zod rejects malformed/invented-shape output | unit | `npx vitest run src/lib/canonical/canonicalBuilderSchema.test.ts -x` | ❌ Wave 0 |
| CANON-01–08 | Route returns 422 when raw_markdown empty | integration | `npx vitest run src/app/api/study-sets/[id]/canonicalize/route.test.ts -x` | ❌ Wave 0 |
| D-07 | Route rejects `pipeline_stage = input` | integration | `npx vitest run src/app/api/study-sets/[id]/canonicalize/route.test.ts -x` | ❌ Wave 0 |
| D-13 | Prompt loader returns version 1.0 | unit | `npx vitest run src/lib/canonical/loadCanonicalPrompt.test.ts -x` | ❌ Wave 0 |
| D-14 | Template substitution fills all vars | unit | `npx vitest run src/lib/canonical/substitutePromptInput.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/canonical --reporter=dot`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run typecheck && npm test && npm run build` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Restore `src/lib/server/openAiChatCompletion.ts`, `ai-processing-config.ts`, `resolveUserAiTier.ts` (deleted)
- [ ] `src/lib/canonical/loadCanonicalPrompt.test.ts` — D-13
- [ ] `src/lib/canonical/substitutePromptInput.test.ts` — D-14
- [ ] `src/lib/canonical/canonicalBuilderSchema.test.ts` — CANON-01–08 validation
- [ ] `src/lib/canonical/mapCanonicalOutputToDb.test.ts` — D-16 mapping
- [ ] `src/app/api/study-sets/[id]/canonicalize/route.test.ts` — mirror `ingest/route.test.ts` pattern
- [ ] Migration: `canonical_sections.section_key` column — D-17
- [ ] `GET /api/study-sets/[id]/canonical` route — D-08

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireApiUser()` on canonicalize + canonical GET |
| V3 Session Management | yes | Supabase SSR session (existing) |
| V4 Access Control | yes | RLS on `canonical_documents` / `canonical_sections`; `user_id` checks in routes |
| V5 Input Validation | yes | Zod on LLM output; precondition checks on `raw_markdown` / `pipeline_stage` |
| V6 Cryptography | no (this phase) | API keys in server env only, never returned to client |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via `raw_markdown` | Tampering | Locked system constraints (D-18); no tool execution; output schema validation |
| LLM hallucinated content persisted | Tampering | CANON-08 prompt constraints; optional substring guard on title vs headings |
| Cross-user document access | Elevation | RLS + `eq("user_id", user.id)` in all queries |
| API key exfiltration | Information disclosure | Server-only `getAiProcessingConfig`; never log keys |
| Oversized payload DoS | Denial of service | Char budget truncation; `max_tokens` cap in chat completion [VERIFIED: git HEAD] |

## Project Constraints (from .cursor/rules/)

- `.cursor/rules/` directory **not present** in working tree (deleted per git status). No additional enforced directives beyond phase CONTEXT and PROJECT.md.
- Orchestrator skill files also deleted — Phase 3 planning follows GSD research/plan workflow directly.

## Sources

### Primary (HIGH confidence)
- `prompt/canonical_builder_v1.json` — locked prompt contract (read in session)
- `supabase/migrations/20260725120000_v21_baseline.sql` — schema for canonical tables
- `src/app/api/study-sets/[id]/canonicalize/route.ts` — stub route
- `src/lib/pipeline/ingest.ts` — ingest → `raw` stage pattern
- `docs/pipeline.md` — Canonical Knowledge Builder requirements
- `.planning/phases/03-canonical-knowledge/03-CONTEXT.md` — locked decisions
- git HEAD: `src/lib/server/openAiChatCompletion.ts`, `extractCanonicalSourceUnits.ts`, `ai-processing-config.ts`, `forward/route.ts`

### Secondary (MEDIUM confidence)
- `.planning/phases/03-canonical-knowledge/03-UI-SPEC.md` — preview UI contract
- `.env.example` — AI env var names
- `src/app/api/study-sets/[id]/ingest/route.test.ts` — test pattern reference
- `package.json` — zod, vitest versions

### Tertiary (LOW confidence)
- Map-reduce chunking quality at scale — not tested in this session; flagged A3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zod/Next/Supabase already in project; v1 LLM pattern verified in git HEAD
- Architecture: HIGH — clear server-route → LLM → validate → persist flow; schema mapping explicit in D-16
- Pitfalls: MEDIUM — deleted server infra and D-01/env tension need planner Wave 0 attention

**Research date:** 2026-07-25
**Valid until:** 2026-08-25 (30 days — stable stack; chunking strategy may need earlier revisit after user testing)
