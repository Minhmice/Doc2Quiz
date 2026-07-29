# Phase 4: Quiz Pipeline - Research

**Researched:** 2026-07-25
**Domain:** LLM MCQ generation from canonical knowledge, Supabase `approved_questions`, quiz practice wiring
**Confidence:** HIGH (schema + UI contracts) / MEDIUM (LLM single-call quality, Phase 3 upstream readiness)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carrying forward
- **D-P3:** Canonical preview at `/sets/[id]/source`; `pipeline_stage = canonical` before quiz path.
- **D-P1-17:** Quiz route is `POST /api/study-sets/[id]/quiz/generate` — replace 501 stub.
- **D-P1-08:** `approved_questions` table: prompt, choices[4], correct_index 0–3, explanation, tags, source jsonb.

#### Mode selection (MODE-01)
- **D-01:** On canonical preview page, enable **Quiz** and **Flashcards** CTAs. Quiz → quiz generation flow; Flashcards → placeholder/disabled or route to Phase 5 message.
- **D-02:** Selecting Quiz sets `study_sets.content_kind = 'quiz'` and `pipeline_stage = 'mode_selected'` before generation.

#### Quiz generation (AI)
- **D-03:** **Canonical knowledge only** — generator reads `canonical_markdown` + `canonical_sections` (+ `metadata.extracted_questions` as hints); never raw_markdown or original file.
- **D-04:** **Prompt contract** — create `prompt/quiz_generator_v1.json` (mirror `canonical_builder_v1.json` pattern): system, tasks, constraints, output_schema for concepts + MCQs.
- **D-05:** **Two-step or single-step LLM:** (1) detect testable concepts + recommend count (QUIZ-01/02), (2) generate MCQs — planner may combine in one structured JSON response if simpler.
- **D-06:** **Output schema per question:** `{ prompt, choices: [4 strings], correct_index: 0-3, explanation?, concept_id?, section_key?, source_excerpt? }` — Zod validate before insert.
- **D-07:** **QUIZ-04:** Deduplicate concepts in post-processing; cap count when content thin; return `recommendedCount` + `generatedCount` in API response.
- **D-08:** **QUIZ-05:** Insert all questions to `approved_questions` **before** returning to client (immediate save, no draft).
- **D-09:** Server env AI (`AI_PROVIDER_URL/KEY`) — same as Phase 3 canonicalize.

#### API
- **D-10:** `POST /quiz/generate` — optional body `{ questionCount?: number }` (user override of recommendation); requires `pipeline_stage` ≥ `canonical`.
- **D-11:** CRUD for questions via existing client `studySetDb` or new API routes — prefer extending `studySetDb` + Supabase RLS (matches Phase 1 pattern).
- **D-12:** On success: `pipeline_stage = 'quiz'`, return `{ recommendedCount, generatedCount, questionIds[] }`.

#### Review & practice (wire existing UI)
- **D-13:** **`/edit/quiz/[id]`** — `ReviewSection` loads `approved_questions` from Supabase; edit/delete persists via `studySetDb`.
- **D-14:** **`/quiz/[id]`** — `QuizSession` loads approved bank; keyboard 1/2/3/4 (CORE-PRAC-01).
- **D-15:** **`/quiz/[id]/done`** — score summary from session (CORE-PRAC-02); persist `quiz_sessions` row.
- **D-16:** **Dashboard** — `DashboardLibraryClient` shows study set with quiz CTA when `content_kind=quiz` and questions exist (CORE-DASH-01/02).

### Claude's Discretion
- Exact quiz_generator_v1.json wording
- Single vs two LLM calls for concepts + MCQs
- Whether generation UI is modal on source page vs dedicated `/edit/quiz/[id]/generate` step

### Deferred Ideas (OUT OF SCOPE)
- FLASH path (Phase 5), CORE-MIST-01 mistakes drill (Phase 5)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODE-01 | After canonical knowledge is saved, user chooses Quiz or Flashcards | Mode CTAs on `/sets/[id]/source`; Quiz path sets `content_kind` + `mode_selected` then calls generate |
| QUIZ-01 | System detects testable concepts from canonical knowledge only | `quiz_generator_v1.json` `concepts[]` + prompt input from canonical tables only (D-03) |
| QUIZ-02 | System recommends question count based on content | LLM `recommended_count` + server cap/dedup post-processing (D-07) |
| QUIZ-03 | System generates MCQs with four options and exactly one correct answer | Zod schema enforces `choices.length === 4`, `correct_index` 0–3; DB check constraints |
| QUIZ-04 | System avoids duplicate concepts; generates fewer when content insufficient | Server `dedupeConcepts()` + `capQuestionCount()` after Zod parse |
| QUIZ-05 | Generated questions save to Supabase immediately (before review) | `runQuizGenerate` bulk insert in route before JSON response (D-08) |
| QUIZ-06 | User can review, edit, and delete generated questions | Wire `studySetDb.getApprovedBank` / `putApprovedBankForStudySet` to `approved_questions` |
| QUIZ-07 | User can start quiz practice from saved questions | `QuizSession` already loads bank; dashboard `playHref` when `approved > 0` |
| CORE-DASH-01 | User can view a dashboard listing their study sets | `useDashboardHome` + `listStudySetMetas` already implemented |
| CORE-DASH-02 | User can open a study set to practice or continue generation | Card variant `ready` when `pipeline_stage=quiz` and `approved > 0` |
| CORE-PRAC-01 | User can answer quiz questions with keyboard 1/2/3/4 | `QuizSession` key handler at lines 388–411 [VERIFIED: src/components/quiz/QuizSession.tsx] |
| CORE-PRAC-02 | User sees end-of-session score summary | `recordQuizCompletion` + done page loads latest `quiz_sessions` row |
</phase_requirements>

## Summary

Phase 4 replaces the `501` stub at `POST /api/study-sets/[id]/quiz/generate` with a server-side **`runQuizGenerate()`** pipeline that mirrors the planned Phase 3 **`runCanonicalize()`** shape: load locked prompt JSON → substitute canonical inputs → single OpenAI-compatible chat call with `response_format: json_object` → Zod validate → map to `approved_questions` rows → advance `pipeline_stage` to `quiz`. The review and practice UI shells (`ReviewSection`, `QuizSession`, dashboard cards) already exist and call `studySetDb` / `activityTracking`, but **both client modules are stubbed** in the working tree — they return empty banks and no-op writes. Phase 4 must implement Supabase-backed `getApprovedBank`, `putApprovedBankForStudySet`, and `recordQuizCompletion` (reference implementations exist in git HEAD at `src/lib/db/studySetDb.ts` and `src/lib/sets/activityTracking.ts`).

**Critical dependency:** Phase 3 canonical builder must populate `canonical_markdown`, `canonical_sections`, and `metadata.extracted_questions` before quiz generation. The canonicalize route is also a `501` stub today; Phase 4 assumes upstream `pipeline_stage = canonical` data exists. Server AI helpers (`postChatCompletionAssistantText`, `getAiProcessingConfig`) are **deleted on disk** but present in git HEAD — restore in Wave 0 (shared with Phase 3).

**Primary recommendation:** Use a **single LLM call** returning `{ recommended_count, concepts[], questions[], warnings[] }`; dedupe concepts and cap counts in TypeScript post-processing; persist via bulk insert (not client round-trip); wire stubs by porting git HEAD Supabase mappings into `src/lib/client/studySetDb.ts` and `src/lib/client/activityTracking.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mode selection (Quiz vs Flashcards) | Browser / Client | API / Backend | UI on `/sets/[id]/source`; PATCH `study_sets` via Supabase client or existing PATCH route |
| Load `quiz_generator_v1.json` + template vars | API / Backend | — | Server-only; prompt file not exposed to browser |
| LLM concept detection + MCQ generation | API / Backend | — | `AI_PROVIDER_URL/KEY` server env (D-09); never browser→vendor |
| Zod validation + dedup/cap post-processing | API / Backend | — | Gate before DB insert; QUIZ-04 logic is deterministic |
| Bulk insert `approved_questions` | Database / Storage | API / Backend | Immediate save (D-08); RLS `user_id = auth.uid()` |
| Review edit/delete CRUD | Browser / Client | Database / Storage | `studySetDb` Supabase client + RLS (D-11) |
| Quiz practice + keyboard input | Browser / Client | — | `QuizSession` already client-side |
| `quiz_sessions` + wrong history persist | Browser / Client | Database / Storage | `recordQuizCompletion` on session end; RLS insert |
| Done page score display | Browser / Client | Database / Storage | Query latest `quiz_sessions` for study set |
| Dashboard CTA classification | Browser / Client | — | `useDashboardHome` counts from `getApprovedBank` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^4.4.3 (installed) | Validate LLM JSON + API body | Project standard; mirrors Phase 3 canonical schemas [VERIFIED: package.json] |
| Next.js App Router | ^16.2.11 | `POST /quiz/generate` route | Existing API stub pattern [VERIFIED: route.ts] |
| `@supabase/supabase-js` | ^2.110.8 | `approved_questions`, `quiz_sessions` | v2.1 baseline migration + RLS [VERIFIED: migration SQL] |
| OpenAI-compatible chat API | — | Structured JSON MCQ generation | `postChatCompletionAssistantText` pattern from git HEAD [VERIFIED: git HEAD] |
| `node:fs/promises` | built-in | Load `prompt/quiz_generator_v1.json` | Same as Phase 3 prompt loader pattern [CITED: 03-RESEARCH.md Pattern 1] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^3.2.4 | Unit tests for schemas, dedup, mapping | `npm test` — Phase 2 ingest established pattern |
| `createRandomUuid` | existing | Server-generated question IDs | Insert rows before client sees bank |
| `isMcqComplete` / `allMcqsComplete` | existing | Review gating | Already used by `ReviewSection` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single LLM call (concepts + MCQs) | Two calls: concepts then MCQs | Two calls: better isolation for huge docs, but 2× latency/cost; single call recommended for MVP (D-05 discretion) |
| Extend `src/lib/client/studySetDb.ts` | New REST CRUD routes per question | Client+RLS matches Phase 1 pattern (D-11); fewer routes |
| Done page query `quiz_sessions` | Pass score via URL/sessionStorage | DB query is durable and matches CORE-PRAC-02 persistence model |
| Replace-all on re-generate | Append-only generation | Replace-all avoids duplicate banks; document in API (clear existing `approved_questions` for study set before insert) |

**Installation:** No new packages required.

**Version verification:**
```bash
npm view zod version   # 4.4.3 (2026-07-25)
```

## Package Legitimacy Audit

> Phase 4 adds **no new external packages**.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| zod | npm | ~8 yrs | very high | github.com/colinhacks/zod | not run (`--json` unsupported) | Approved (already installed) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck CLI available but `--json` flag not supported in installed version; no new installs to audit.*

## Architecture Patterns

### System Architecture Diagram

```text
[Canonical saved: pipeline_stage=canonical]
        │
        ▼
[/sets/{id}/source — Quiz CTA]
        │
        ├── PATCH study_sets: content_kind=quiz, pipeline_stage=mode_selected
        │
        ▼
[POST /api/study-sets/{id}/quiz/generate  { questionCount? }]
        │
        ├── Preconditions: pipeline_stage ≥ canonical, canonical_markdown non-empty
        │
        ▼
[Load prompt/quiz_generator_v1.json]
        │
        ▼
[Fetch canonical_documents + canonical_sections + metadata.extracted_questions]
        │  (NEVER raw_markdown / original file — D-03)
        ▼
[Substitute {{study_set_id}}, {{title}}, {{canonical_markdown}},
 {{sections_json}}, {{extracted_questions_json}}, {{requested_count}}]
        │
        ▼
[postChatCompletionAssistantText  response_format: json_object  temperature: 0]
        │
        ├─ Zod fail ──► repair retry (1×) ──► 422
        │
        ▼
[dedupeConcepts + capQuestionCount + filter to requested_count override]
        │
        ▼
[DELETE existing approved_questions for study_set (re-generate)]
        │
        ▼
[BULK INSERT approved_questions rows]
        │
        ▼
[UPDATE study_sets SET pipeline_stage='quiz', content_kind='quiz']
        │
        ▼
[200 { recommendedCount, generatedCount, questionIds[] }]
        │
        ├──────────────────────────────┐
        ▼                              ▼
[/edit/quiz/{id}  ReviewSection]   [/quiz/{id}  QuizSession]
        │                              │
        │ studySetDb CRUD              │ getApprovedBank
        ▼                              ▼
[approved_questions]              [keyboard 1–4 practice]
                                       │
                                       ▼
                              [recordQuizCompletion]
                                       │
                                       ▼
                              [quiz_sessions + study_wrong_history]
                                       │
                                       ▼
                              [/quiz/{id}/done — latest session score]
```

### Recommended Project Structure

```text
prompt/
  quiz_generator_v1.json              # NEW — locked prompt contract (D-04)

src/lib/quiz/
  loadQuizPrompt.ts                   # fs read + cache + version (mirror canonicalPrompt)
  substituteQuizInput.ts            # {{var}} replacement
  buildQuizMessages.ts              # system + tasks + constraints + output_schema
  quizGeneratorSchemas.ts           # Zod mirror of output_schema (D-06)
  dedupeAndCapQuestions.ts          # QUIZ-04 post-processing
  mapQuizOutputToRows.ts            # LLM question → approved_questions row + Question id
  runQuizGenerate.ts                # LLM call + retry + parse + persist orchestration
  persistGeneratedQuestions.ts      # server Supabase bulk insert (adapt git HEAD persistQuizDraft)

src/lib/server/                     # RESTORE if missing (shared Phase 3/4)
  openAiChatCompletion.ts
  ai-processing-config.ts
  resolveUserAiTier.ts

src/lib/client/
  studySetDb.ts                     # IMPLEMENT getApprovedBank / putApprovedBank (not stubs)
  activityTracking.ts               # IMPLEMENT recordQuizCompletion / getMistakeQuestionIds

src/app/api/study-sets/[id]/quiz/generate/route.ts   # Replace 501 stub

src/app/(app)/sets/[id]/source/page.tsx              # Quiz + Flashcards CTAs (MODE-01)
```

### Pattern 1: `runQuizGenerate()` — Mirror Phase 3 `runCanonicalize()`

**What:** Server orchestrator called from the generate route. Same phases as Phase 3 builder: load prompt → build messages → LLM → Zod → map → persist → update `pipeline_stage`.

**When to use:** Every `POST /quiz/generate` request.

**Example:**
```typescript
// Source: Phase 3 RESEARCH Pattern 1+4 [CITED: 03-RESEARCH.md]; git HEAD openAiChatCompletion.ts
export async function runQuizGenerate(ctx: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  questionCountOverride?: number;
}): Promise<
  | { ok: true; recommendedCount: number; generatedCount: number; questionIds: string[] }
  | { ok: false; status: number; error: string }
> {
  const spec = await loadQuizPrompt();
  const canonical = await loadCanonicalForQuiz(ctx.supabase, ctx.userId, ctx.studySetId);
  if (!canonical.ok) return { ok: false, status: 422, error: canonical.error };

  const messages = buildQuizMessages(spec, substituteQuizInput(spec.input, {
    study_set_id: ctx.studySetId,
    title: canonical.title,
    language: canonical.language,
    canonical_markdown: canonical.canonicalMarkdown,
    sections_json: JSON.stringify(canonical.sections),
    extracted_questions_json: JSON.stringify(canonical.extractedQuestions),
    requested_count: String(ctx.questionCountOverride ?? "auto"),
  }));

  const cfg = getAiProcessingConfig(resolveUserAiTier(/* user */ "free"));
  const llm = await postChatCompletionAssistantText({
    configUrl: cfg.url,
    apiKey: cfg.key,
    model: cfg.model,
    messages,
    responseFormatJsonObject: true,
    temperature: 0,
  });
  // parse → quizGeneratorOutputSchema → dedupeAndCap → persistGeneratedQuestions
}
```

### Pattern 2: Single vs Two LLM Calls (Recommendation)

| Approach | Pros | Cons | MVP verdict |
|----------|------|------|-------------|
| **Single call** — `{ recommended_count, concepts[], questions[] }` | One round-trip; atomic validation; simpler route; matches D-05 "combine if simpler" | Large JSON for big concept sets; may hit output token limits | **Recommended** |
| **Two calls** — (1) concepts + count, (2) MCQs per concept batch | Smaller outputs; can parallelize batch 2 | 2× cost/latency; partial-failure handling; more orchestration | Defer unless single-call fails eval |

**Single-call guardrails:**
- Cap LLM `questions[]` at `min(recommended_count, 40)` in prompt constraints
- Truncate `canonical_markdown` input at **80_000 chars** (MCQ task needs room for output tokens; canonical builder uses 120k for extraction-only) [ASSUMED]
- If output token limit hit → 422 with `metadata.quiz_generation_status = failed`

### Pattern 3: LLM Output → `approved_questions` Mapping

**What:** Map validated LLM questions to DB rows and client `Question` type.

| LLM field | `approved_questions` column | Client `Question` field |
|-----------|----------------------------|-------------------------|
| `prompt` | `prompt` | `question` |
| `choices[4]` | `choices` | `options` |
| `correct_index` | `correct_index` | `correctIndex` |
| `explanation` | `explanation` | `explanation` |
| `concept_id` | `tags` (e.g. `["concept_001"]`) | — |
| `section_key`, `source_excerpt`, `concept_id` | `source` jsonb | `sourceChunkId` ← `concept_id` |
| — | `id` (uuid, server-generated) | `id` |
| prompt `version` | `source.prompt_version` | — |

**Row builder (server insert):**
```typescript
// Source: git HEAD persistStudySetGeneratedDraft.ts questionToRow [VERIFIED: git HEAD]
function mapGeneratedQuestionToRow(q: GeneratedQuestion, meta: {
  id: string; userId: string; studySetId: string; promptVersion: string;
}): Record<string, unknown> {
  return {
    id: meta.id,
    user_id: meta.userId,
    study_set_id: meta.studySetId,
    prompt: q.prompt,
    choices: q.choices,
    correct_index: q.correct_index,
    explanation: q.explanation ?? null,
    tags: q.concept_id ? [q.concept_id] : [],
    source: {
      concept_id: q.concept_id,
      section_key: q.section_key,
      source_excerpt: q.source_excerpt,
      prompt_version: meta.promptVersion,
      generated_at: new Date().toISOString(),
    },
  };
}
```

**Client read (port to `studySetDb.ts`):**
```typescript
// Source: git HEAD src/lib/db/studySetDb.ts rowToQuestion [VERIFIED: git HEAD]
function rowToQuestion(row: {
  id: string; prompt: string; choices: string[]; correct_index: number; source: unknown;
}): Question {
  const fromSource = row.source && typeof row.source === "object"
    ? (row.source as Partial<Question> & { concept_id?: string })
    : {};
  return {
    id: row.id,
    question: row.prompt,
    options: row.choices as Question["options"],
    correctIndex: row.correct_index as Question["correctIndex"],
    explanation: typeof fromSource.explanation === "string" ? fromSource.explanation : undefined,
    sourceChunkId: fromSource.concept_id ?? fromSource.sourceChunkId,
  };
}
```

### Pattern 4: QUIZ-04 Post-Processing (`dedupeAndCapQuestions`)

**What:** Deterministic server logic after Zod, before insert.

```typescript
// Pseudocode — planner implements in src/lib/quiz/dedupeAndCapQuestions.ts
export function dedupeAndCapQuestions(
  output: QuizGeneratorOutput,
  overrideCount?: number,
): { questions: GeneratedQuestion[]; recommendedCount: number; generatedCount: number } {
  const seen = new Set<string>();
  const uniqueConcepts = output.concepts.filter((c) => {
    const key = c.concept_id.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const recommended = overrideCount ?? output.recommended_count;
  const maxAllowed = Math.min(recommended, uniqueConcepts.length, output.questions.length);
  const byConcept = new Map<string, GeneratedQuestion>();
  for (const q of output.questions) {
    if (!byConcept.has(q.concept_id)) byConcept.set(q.concept_id, q);
  }
  const questions = uniqueConcepts
    .slice(0, maxAllowed)
    .map((c) => byConcept.get(c.concept_id))
    .filter((q): q is GeneratedQuestion => q != null);

  return { questions, recommendedCount: recommended, generatedCount: questions.length };
}
```

**Thin content:** If `uniqueConcepts.length < 3`, cap `recommended_count` to `uniqueConcepts.length` and add warning `"Limited testable content"` to API response / `metadata`.

### Pattern 5: Wire Existing UI to Supabase

| Component | Current state | Required change |
|-----------|---------------|-----------------|
| `ReviewSection` | Calls stub `getApprovedBank` / `putApprovedBankForStudySet` | Implement Supabase in `src/lib/client/studySetDb.ts` (port git HEAD) |
| `QuizSession` | Same stub | Same — loads `approved_questions` via `getApprovedBank` |
| `quiz/[id]/done` | `latestScore` always `null`; stub bank | Implement `getLatestQuizSession(studySetId)`; wire `recordQuizCompletion` |
| `useDashboardHome` | Calls stub bank + activity | Works once stubs implemented |
| `DashboardLibraryClient` | `cardVariantFor`: `ready` when `pipeline_stage ∈ {quiz, flashcards}` && `approved > 0` | No logic change; needs real counts + `pipeline_stage=quiz` after generate |

**ReviewSection "Done" button:** Already calls `touchStudySetMeta(..., { pipelineStage: "quiz" })` — redundant if generate sets `quiz`, but harmless confirmation step.

### Pattern 6: Mode Selection UI (`/sets/[id]/source`)

**What:** Replace placeholder copy with Quiz / Flashcards CTAs when `pipeline_stage === 'canonical'`.

**Quiz flow:**
1. `PATCH` study set: `{ content_kind: 'quiz', pipeline_stage: 'mode_selected' }` (use existing `src/app/api/study-sets/[id]/route.ts` PATCH or Supabase client)
2. Show generation progress UI (spinner) while `POST /quiz/generate`
3. On success → `router.push(editQuiz(id))` for review

**Flashcards:** Disabled button or toast "Coming in Phase 5" (D-01).

**Generation UI (discretion):** Inline modal on source page is simplest — avoids new route; matches "express path" in `docs/pipeline.md`.

### Pattern 7: `quiz_sessions` on Done Page

**What:** `QuizSession` already calls `recordQuizCompletion` on finish then redirects to `/quiz/{id}/done` (stitch theme). Done page should load score from DB.

```typescript
// Add to activityTracking.ts (port + extend git HEAD)
export async function getLatestQuizSession(studySetId: string): Promise<QuizSessionRecord | null> {
  const { data } = await supabase
    .from("quiz_sessions")
    .select("id,study_set_id,completed_at,total_questions,correct_count")
    .eq("study_set_id", studySetId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // map to QuizSessionRecord
}
```

### Proposed `prompt/quiz_generator_v1.json`

```json
{
  "name": "quiz_generator",
  "version": "1.0",
  "system": "Generate multiple-choice questions from canonical knowledge only. Use only facts present in the supplied canonical markdown and sections. Never use raw extraction text or external knowledge. Return valid JSON only.",
  "input": {
    "study_set_id": "{{study_set_id}}",
    "title": "{{title}}",
    "language": "{{language}}",
    "canonical_markdown": "{{canonical_markdown}}",
    "sections_json": "{{sections_json}}",
    "extracted_questions_json": "{{extracted_questions_json}}",
    "requested_count": "{{requested_count}}"
  },
  "tasks": [
    "Identify distinct testable concepts from the canonical knowledge. Assign stable concept_id values: concept_001, concept_002, ...",
    "Recommend an appropriate question count based on content depth. When requested_count is a number, treat it as the target unless content is insufficient.",
    "For each concept, write one MCQ with exactly four plausible choices and exactly one correct answer grounded in the canonical text.",
    "Prefer concepts from theory and example sections; reuse extracted_questions as hints when they match canonical content (do not copy verbatim if ambiguous).",
    "Include a brief explanation citing the canonical source for each question.",
    "When content is thin, recommend and generate fewer questions rather than inventing topics."
  ],
  "output_schema": {
    "recommended_count": "number",
    "concepts": [
      {
        "concept_id": "concept_001",
        "label": "string",
        "section_key": "sec_001",
        "importance": "high | medium | low"
      }
    ],
    "questions": [
      {
        "concept_id": "concept_001",
        "prompt": "string",
        "choices": ["string", "string", "string", "string"],
        "correct_index": 0,
        "explanation": "string",
        "section_key": "sec_001",
        "source_excerpt": "string"
      }
    ],
    "warnings": ["string"]
  },
  "constraints": [
    "Canonical knowledge only — no raw_markdown, no original file, no external facts.",
    "Exactly four choices per question; correct_index 0–3; exactly one correct answer.",
    "No duplicate concept_id across concepts array.",
    "Do not invent information not supported by canonical_markdown or sections.",
    "Return JSON matching the schema exactly."
  ]
}
```

**Zod mirror (`quizGeneratorOutputSchema`):**
```typescript
const conceptSchema = z.object({
  concept_id: z.string().regex(/^concept_\d{3}$/),
  label: z.string().min(1),
  section_key: z.string().regex(/^sec_\d{3}$/).optional(),
  importance: z.enum(["high", "medium", "low"]).optional(),
});

const generatedQuestionSchema = z.object({
  concept_id: z.string().regex(/^concept_\d{3}$/),
  prompt: z.string().min(10),
  choices: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  correct_index: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().optional(),
  section_key: z.string().optional(),
  source_excerpt: z.string().optional(),
});

export const quizGeneratorOutputSchema = z.object({
  recommended_count: z.number().int().min(1).max(40),
  concepts: z.array(conceptSchema).min(1),
  questions: z.array(generatedQuestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
});
```

### Anti-Patterns to Avoid

- **Hand-rolling MCQ validation in the route:** Use shared Zod schema + existing `isMcqComplete` for client-side.
- **Returning questions to client before DB insert:** Violates QUIZ-05 / D-08 — insert first, then return IDs.
- **Reading `raw_markdown` in quiz generator:** Violates D-03 and pipeline.md Quiz Rules.
- **Duplicating prompt text in TypeScript:** Load from JSON only (D-04, mirror D-13 from Phase 3).
- **IndexedDB for approved bank in v2.1:** `studySetDb` client stubs must use Supabase, not empty returns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI HTTP client | Custom fetch wrapper | `postChatCompletionAssistantText` | Handles `response_format`, errors, empty content |
| JSON schema validation | Manual `if` checks | Zod `quizGeneratorOutputSchema` | DB constraints will reject bad rows anyway |
| Question CRUD API | 4 new REST routes | `studySetDb` upsert/delete pattern | RLS already on `approved_questions` |
| MCQ completeness rules | New validator | `isMcqComplete` / `questionEditorSchema` | Single source of truth for review UI |
| Session score storage | localStorage | `quiz_sessions` table | CORE-PRAC-02 + dashboard stats |

**Key insight:** The UI layer is complete; Phase 4 is a **data + generation pipeline** problem, not a new UI build.

## Common Pitfalls

### Pitfall 1: Stub `studySetDb` Masks Integration Gaps
**What goes wrong:** Generation succeeds but review shows "No questions yet."
**Why it happens:** `getApprovedBank` returns `{ questions: [] }` stub.
**How to avoid:** Implement Supabase select/upsert as first Wave 0 task; smoke test `getApprovedBank` before LLM work.
**Warning signs:** Dashboard always shows `approved: 0` after generate.

### Pitfall 2: Phase 3 Upstream Not Ready
**What goes wrong:** Generate route 422s — empty `canonical_markdown`.
**Why it happens:** Canonicalize stub not replaced; `pipeline_stage` stuck at `raw`.
**How to avoid:** Gate route on `canonical_markdown.length > 0` AND `pipeline_stage >= canonical`; coordinate Phase 3 completion or seed test fixtures.
**Warning signs:** Source page still shows raw markdown preview only.

### Pitfall 3: Server AI Stack Missing on Disk
**What goes wrong:** `import "@/lib/server/openAiChatCompletion"` fails at build.
**Why it happens:** v2.1 purge deleted `src/lib/server/*` from working tree.
**How to avoid:** Restore trio from git HEAD in Wave 0 (shared with Phase 3 plan 03-01).
**Warning signs:** `Test-Path src/lib/server/openAiChatCompletion.ts` → False.

### Pitfall 4: `pipeline_stage` Not Set → Dashboard Shows "In progress"
**What goes wrong:** Questions exist but primary CTA is "Resume practice" not "Open practice."
**Why it happens:** `cardVariantFor` requires `pipeline_stage === 'quiz'` for `ready`.
**How to avoid:** Generate route must set `pipeline_stage = 'quiz'` on success (D-12).
**Warning signs:** `approved > 0` but variant is `in_progress`.

### Pitfall 5: Re-generate Leaves Orphan Questions
**What goes wrong:** Duplicate or stale MCQs after second generate.
**How to avoid:** `DELETE FROM approved_questions WHERE study_set_id = ?` before bulk insert on generate (replace-all semantics).
**Warning signs:** Question count jumps unexpectedly on re-run.

### Pitfall 6: Done Page Missing Score
**What goes wrong:** User lands on `/quiz/{id}/done` without score summary.
**Why it happens:** `latestScore` state never populated; `recordQuizCompletion` is stub.
**How to avoid:** Implement `recordQuizCompletion` + `getLatestQuizSession` on done page load.
**Warning signs:** `recordQuizCompletion` is empty function body.

## Code Examples

### Generate Route Handler
```typescript
// Source: stub at src/app/api/study-sets/[id]/quiz/generate/route.ts [VERIFIED]
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const questionCount =
    typeof body.questionCount === "number" ? body.questionCount : undefined;

  const result = await runQuizGenerate({
    supabase: auth.supabase,
    userId: auth.user.id,
    studySetId: id,
    questionCountOverride: questionCount,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    recommendedCount: result.recommendedCount,
    generatedCount: result.generatedCount,
    questionIds: result.questionIds,
  });
}
```

### LLM Repair Retry (from v1 pattern)
```typescript
// Source: git HEAD extractCanonicalSourceUnits.ts [VERIFIED: git HEAD]
let parsed = quizGeneratorOutputSchema.safeParse(parsedJson);
if (!parsed.success) {
  const repairMessages = [
    ...messages,
    { role: "assistant", content: first.text },
    {
      role: "user",
      content: `Invalid schema (${parsed.error.message}). Return ONLY JSON matching the quiz_generator contract.`,
    },
  ];
  const second = await postChatCompletionAssistantText({ /* same config */, messages: repairMessages });
  // re-parse and safeParse
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 `generateFromFile` + IndexedDB banks | Canonical → quiz pipeline + Supabase `approved_questions` | v2.1 milestone | Generator reads canonical only |
| Browser BYOK forward | Server `AI_PROVIDER_URL/KEY` | Phase 4 D-09 | Quiz generate is server route only |
| Parse-time MCQ extraction | Post-canonical MCQ generation | pipeline.md v2.1 | QUIZ-* requirements |

**Deprecated/outdated:**
- `src/lib/db/studySetDb.ts` (IndexedDB-era, deleted on disk) — port patterns to `src/lib/client/studySetDb.ts`, do not re-import old module.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 3 will populate `canonical_markdown` before Phase 4 executes | Summary | Generate route blocked until canonicalize ships |
| A2 | Single LLM call quality is sufficient for MVP | Pattern 2 | May need two-call fallback |
| A3 | 80_000 char input budget is enough for MCQ generation | Pattern 2 | Truncation may drop concepts in huge docs |
| A4 | `section_key` column exists on `canonical_sections` (Phase 3 migration) | Mapping | `section_key` in source jsonb only if migration deferred |
| A5 | Re-generate replaces all existing questions (replace-all) | Pitfall 5 | User may expect append — needs product confirm |
| A6 | `resolveUserAiTier` returns `"free"` for all users until pro IDs configured | runQuizGenerate | Wrong model if tier logic differs |

## Open Questions (RESOLVED)

1. **Re-generate semantics** — **RESOLVED:** Replace-all. DELETE existing `approved_questions` for study_set before bulk INSERT on each generate run (04-02 Task 2).

2. **Generation UI placement** — **RESOLVED:** Inline on `/sets/[id]/source` after Quiz CTA with `QuizGenerateProgressCard` (04-04 Task 2). No dedicated generate route.

3. **Phase 3 / Phase 4 sequencing** — **RESOLVED:** 04-01 `depends_on: ["03-01"]` (AI lib); 04-02 `depends_on: ["03-02"]` (canonical data). Phase 4 does not duplicate Phase 3 canonicalize.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | v25.2.1 | — |
| npm | Package scripts | ✓ | 11.6.2 | — |
| `AI_PROVIDER_URL` + `AI_PROVIDER_KEY` | `runQuizGenerate` | ✗ (env-dependent) | — | Route returns 503 `ai_not_configured` via `isAiProcessingConfigured()` |
| Supabase (`NEXT_PUBLIC_SUPABASE_*`) | All persistence | ✗ (env-dependent) | — | Blocks all flows — required |
| `src/lib/server/openAiChatCompletion.ts` | LLM call | ✗ (deleted on disk) | — | Restore from git HEAD |
| vitest | Unit tests | ✓ | ^3.2.4 | `npm test` |
| slopcheck | Package audit | partial | CLI ok, no `--json` | Manual review; no new packages |

**Missing dependencies with no fallback:**
- Supabase credentials (required for any Phase 4 verification)
- Server AI files on disk (must restore before implementation)

**Missing dependencies with fallback:**
- AI env vars → 503 with clear error in UI

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/quiz/quizGeneratorSchemas.test.ts -x` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUIZ-01 | Concepts detected in schema | unit | `npx vitest run src/lib/quiz/quizGeneratorSchemas.test.ts -x` | ❌ Wave 0 |
| QUIZ-02 | recommended_count validated | unit | same | ❌ Wave 0 |
| QUIZ-03 | 4 choices + correct_index 0–3 | unit | same | ❌ Wave 0 |
| QUIZ-04 | dedupe + cap logic | unit | `npx vitest run src/lib/quiz/dedupeAndCapQuestions.test.ts -x` | ❌ Wave 0 |
| QUIZ-05 | persist before response | integration | `npx vitest run src/lib/quiz/runQuizGenerate.test.ts -x` | ❌ Wave 0 |
| QUIZ-06 | rowToQuestion round-trip | unit | `npx vitest run src/lib/client/studySetDb.test.ts -x` | ❌ Wave 0 |
| CORE-PRAC-01 | keyboard 1–4 | manual | QuizSession keyboard handler | ✅ existing |
| CORE-PRAC-02 | session persist | unit | `npx vitest run src/lib/client/activityTracking.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/quiz/<changed>.test.ts -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/quiz/quizGeneratorSchemas.ts` + test — covers QUIZ-01–03
- [ ] `src/lib/quiz/dedupeAndCapQuestions.ts` + test — covers QUIZ-04
- [ ] Restore `src/lib/server/openAiChatCompletion.ts` (+ config, tier) — shared with Phase 3
- [ ] Implement `src/lib/client/studySetDb.ts` approved bank functions — covers QUIZ-06
- [ ] Implement `src/lib/client/activityTracking.ts` — covers CORE-PRAC-02
- [ ] `prompt/quiz_generator_v1.json` — locked contract

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `requireApiUser()` on generate route [VERIFIED: route stub] |
| V3 Session Management | yes | Supabase auth session for client CRUD |
| V4 Access Control | yes | RLS `user_id = auth.uid()` on `approved_questions`, `quiz_sessions` |
| V5 Input Validation | yes | Zod on LLM output + `questionCount` body bounds (1–40) |
| V6 Cryptography | no | No custom crypto in this phase |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via canonical markdown | Tampering | System prompt constraints; no tool execution; validate output shape only |
| IDOR on study sets | Spoofing | `verifyStudySet` + RLS on all tables |
| LLM output oversized JSON | DoS | Max questions 40; truncate input; `max_tokens` on chat call |
| API key exfiltration | Information disclosure | Server-only `AI_PROVIDER_KEY`; never import ai config in client components |

## Project Constraints (from .cursor/rules/)

- Workspace rule references orchestrator at `.cursor/agents/orchestrator/SKILL.md` — **files deleted in working tree** [VERIFIED: git status]. Phase 4 execution should follow GSD planner/executor workflow when orchestrator assets are absent.
- User rule: minimize scope; match existing conventions; no drive-by refactors.
- No new packages without legitimacy audit (none needed).

## Sources

### Primary (HIGH confidence)
- `prompt/canonical_builder_v1.json` — prompt JSON pattern for `quiz_generator_v1.json`
- `supabase/migrations/20260725120000_v21_baseline.sql` — `approved_questions`, `quiz_sessions` schema
- `src/app/api/study-sets/[id]/quiz/generate/route.ts` — stub to replace
- `src/lib/client/studySetDb.ts` — stub gap identification
- git HEAD `src/lib/server/openAiChatCompletion.ts`, `persistStudySetGeneratedDraft.ts`, `src/lib/db/studySetDb.ts`, `src/lib/sets/activityTracking.ts` — reference implementations

### Secondary (MEDIUM confidence)
- `.planning/phases/03-canonical-knowledge/03-RESEARCH.md` — `runCanonicalize` mirror patterns
- `.planning/phases/04-quiz-pipeline/04-CONTEXT.md` — locked decisions
- `docs/pipeline.md` — Quiz Rules

### Tertiary (LOW confidence)
- 80_000 char MCQ input budget — engineering estimate, not load-tested [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; patterns copied from Phase 3 research + git HEAD
- Architecture: HIGH — UI exists; gaps are stubbed data layer + 501 route
- Pitfalls: MEDIUM — Phase 3 upstream timing and single-call LLM quality unverified in production

**Research date:** 2026-07-25
**Valid until:** 2026-08-25 (30 days — stable stack; prompt tuning may iterate sooner)
