# Phase 4: Quiz Pipeline - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 20
**Analogs found:** 17 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prompt/quiz_generator_v1.json` | config | transform | `prompt/canonical_builder_v1.json` | exact |
| `src/lib/pipeline/quizSchemas.ts` | utility | transform | `src/lib/pipeline/ingestSchemas.ts` + `03-PATTERNS` `canonicalSchemas` | exact |
| `src/lib/pipeline/quizPrompt.ts` | utility | transform | `03-PATTERNS` `canonicalPrompt.ts` pattern | exact |
| `src/lib/pipeline/quizGenerate.ts` | service | batch, transform | `src/lib/pipeline/ingest.ts` + git `persistStudySetGeneratedDraft.ts` + git `extractCanonicalSourceUnits.ts` | exact |
| `src/app/api/study-sets/[id]/quiz/generate/route.ts` | route | request-response, transform | `src/app/api/study-sets/[id]/ingest/route.ts` + existing stub | exact |
| `src/lib/client/quizGenerateStudySet.ts` | utility | request-response | `src/lib/client/ingestStudySet.ts` + `03-PATTERNS` `canonicalizeStudySet.ts` | exact |
| `src/lib/client/studySetDb.ts` | utility | CRUD | git HEAD `src/lib/db/studySetDb.ts` (`getApprovedBank` / `putApprovedBankForStudySet`) | exact (restore) |
| `src/lib/client/activityTracking.ts` | utility | CRUD | git HEAD `src/lib/sets/activityTracking.ts` | exact (restore) |
| `src/app/(app)/sets/[id]/source/page.tsx` | component | request-response | current `source/page.tsx` + Phase 3 canonical preview contract | role-match |
| `src/app/(app)/edit/quiz/[id]/page.tsx` | component | request-response | current page (thin wrapper) | exact |
| `src/components/review/ReviewSection.tsx` | component | CRUD | current `ReviewSection.tsx` (no API change needed) | exact |
| `src/components/quiz/QuizSession.tsx` | component | request-response | current `PlaySession` in `QuizSession.tsx` | exact |
| `src/app/(app)/quiz/[id]/done/page.tsx` | component | request-response | current `done/page.tsx` + git `activityTracking` | role-match |
| `src/components/dashboard/DashboardLibraryClient.tsx` | component | request-response | current `DashboardLibraryClient.tsx` + `useDashboardHome` | exact |
| `src/lib/pipeline/quizGenerate.test.ts` | test | transform | `src/lib/pipeline/ingest.test.ts` | role-match |
| `src/app/api/study-sets/[id]/quiz/generate/route.test.ts` | test | request-response | `src/app/api/study-sets/[id]/ingest/route.test.ts` | exact |
| `src/lib/pipeline/canonicalize.ts` (upstream) | service | batch | `src/lib/pipeline/ingest.ts` | upstream |
| `src/lib/server/persistStudySetGeneratedDraft.ts` | service | CRUD | git HEAD (server bulk insert) | partial (deleted) |
| `src/lib/server/openAiChatCompletion.ts` | utility | request-response | git HEAD | partial (deleted) |
| `src/lib/server/ai-processing-config.ts` | config | request-response | git HEAD `getAiProcessingConfig` | partial (deleted) |

## Pattern Assignments

### 1. Pipeline runner (`canonicalize` → `quiz generate`)

**Analog chain:** `ingest.ts` (`runIngest`) → Phase 3 `canonicalize.ts` (03-PATTERNS) → new `quizGenerate.ts`

**Service error classes** (mirror `ingest.ts` lines 24–30):

```typescript
export class QuizGenerateValidationError extends Error {
  readonly name = "QuizGenerateValidationError";
}

export class QuizGenerateError extends Error {
  readonly name = "QuizGenerateError";
}
```

**Pre-flight reads** — canonical knowledge only (D-03); never `raw_markdown`:

```typescript
const { data: studySet, error: ssErr } = await supabase
  .from("study_sets")
  .select("id,pipeline_stage,content_kind")
  .eq("id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

if (!studySet || !isStageAtLeast(studySet.pipeline_stage, "canonical")) {
  throw new QuizGenerateValidationError(
    "Canonical knowledge is required before quiz generation.",
  );
}

const { data: doc } = await supabase
  .from("canonical_documents")
  .select("id,canonical_markdown,metadata")
  .eq("study_set_id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

if (!doc?.canonical_markdown?.trim()) {
  throw new QuizGenerateValidationError("Canonical markdown is missing.");
}

const { data: sections } = await supabase
  .from("canonical_sections")
  .select("section_key,heading,body_markdown,section_type,ordinal")
  .eq("canonical_document_id", doc.id)
  .eq("user_id", userId)
  .order("ordinal", { ascending: true });
```

**Stage transitions** (D-02, D-12):

```typescript
// Before LLM (mode selection)
await supabase.from("study_sets").update({
  content_kind: "quiz",
  pipeline_stage: "mode_selected",
}).eq("id", studySetId).eq("user_id", userId);

// After successful insert (D-08)
await supabase.from("study_sets").update({
  pipeline_stage: "quiz",
}).eq("id", studySetId).eq("user_id", userId);
```

**LLM + Zod + repair** (git `extractCanonicalSourceUnits.ts` lines 13–127):

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

let parsed = quizGeneratorOutputSchema.safeParse(
  JSON.parse(stripJsonFence(first.text)),
);
if (!parsed.success) {
  // one repair pass — same pattern as canonicalize
}
```

**Post-processing** (D-07): dedupe by `concept_id`, cap when thin content, compute `recommendedCount` vs `generatedCount`.

**Persistence before response** (D-08) — server-side bulk insert, copy git `persistStudySetGeneratedDraft.ts`:

```typescript
export async function persistQuizDraft(
  supabase: SupabaseClient,
  userId: string,
  studySetId: string,
  questions: Question[],
): Promise<void> {
  const now = new Date().toISOString();
  const upserts = questions.map((q) => ({
    id: q.id,
    user_id: userId,
    study_set_id: studySetId,
    prompt: q.question,
    choices: q.options as unknown as string[],
    correct_index: q.correctIndex,
    explanation: q.explanation ?? null,
    tags: [],
    source: {
      concept_id: q.sourceChunkId,
      section_key: /* from LLM */,
      source_excerpt: /* from LLM */,
    },
    updated_at: now,
  }));

  await supabase.from("approved_questions").upsert(upserts, { onConflict: "id" });
}
```

**Return shape** (D-12):

```typescript
export type QuizGenerateResult = {
  studySetId: string;
  recommendedCount: number;
  generatedCount: number;
  questionIds: string[];
  pipelineStage: "quiz";
};
```

---

### 2. Prompt JSON loader + Zod validation

#### `prompt/quiz_generator_v1.json` (config)

**Analog:** `prompt/canonical_builder_v1.json`

Mirror structure: `name`, `version`, `system`, `input` template vars, `tasks`, `output_schema`, `constraints`. Input vars per D-03:

| Template var | Source |
|--------------|--------|
| `study_set_id` | route param |
| `canonical_markdown` | `canonical_documents.canonical_markdown` |
| `sections` | `canonical_sections` rows |
| `extracted_questions` | `canonical_documents.metadata.extracted_questions` |
| `question_count_override` | optional POST body |

#### `src/lib/pipeline/quizPrompt.ts` (utility)

**Analog:** 03-PATTERNS `canonicalPrompt.ts`

```typescript
import promptSpec from "../../../prompt/quiz_generator_v1.json";

export function buildQuizGeneratorMessages(input: {
  study_set_id: string;
  canonical_markdown: string;
  sections: Array<{ id: string; title: string; content: string; content_type: string }>;
  extracted_questions: unknown[];
  question_count_override?: number;
}): { system: string; user: string } {
  const tasks = promptSpec.tasks.join("\n- ");
  const constraints = promptSpec.constraints.join("\n- ");
  const system = [promptSpec.system, "Tasks:", `- ${tasks}`, "Constraints:", `- ${constraints}`].join("\n");
  return {
    system,
    user: JSON.stringify({
      study_set_id: input.study_set_id,
      canonical_markdown: input.canonical_markdown,
      sections: input.sections,
      extracted_questions: input.extracted_questions,
      ...(input.question_count_override != null
        ? { question_count_override: input.question_count_override }
        : {}),
    }),
  };
}

export const QUIZ_PROMPT_VERSION = promptSpec.version;
```

`tsconfig.json` has `resolveJsonModule: true` — direct JSON import, no runtime fs.

#### `src/lib/pipeline/quizSchemas.ts` (utility)

**Analog:** `ingestSchemas.ts` (route body) + `lib/validations/question.ts` (MCQ shape)

**Route request body** (D-10):

```typescript
import { z } from "zod";

export const quizGenerateBodySchema = z.object({
  questionCount: z.number().int().min(1).max(50).optional(),
});
export type QuizGenerateBody = z.infer<typeof quizGenerateBodySchema>;
```

**LLM output** (D-06) — per-question + concepts array:

```typescript
export const quizMcqSchema = z.object({
  prompt: z.string().min(1),
  choices: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correct_index: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().optional(),
  concept_id: z.string().optional(),
  section_key: z.string().optional(),
  source_excerpt: z.string().optional(),
});

export const quizGeneratorOutputSchema = z.object({
  recommended_count: z.number().int().min(0),
  concepts: z.array(z.object({
    id: z.string(),
    label: z.string(),
    section_key: z.string().optional(),
  })),
  questions: z.array(quizMcqSchema).min(1),
});

export type QuizGeneratorOutput = z.infer<typeof quizGeneratorOutputSchema>;
```

**Map LLM row → `Question` type** (`src/types/question.ts`):

```typescript
import { createRandomUuid } from "@/lib/ids/createRandomUuid";

function llmMcqToQuestion(mcq: z.infer<typeof quizMcqSchema>): Question {
  return {
    id: createRandomUuid(),
    question: mcq.prompt,
    options: mcq.choices,
    correctIndex: mcq.correct_index,
    explanation: mcq.explanation,
    sourceChunkId: mcq.concept_id,
  };
}
```

Reuse `isMcqComplete` / `allMcqsComplete` from `src/lib/review/validateMcq.ts` for post-insert sanity (not a gate — D-08 saves immediately).

---

### 3. API route structure (`POST /quiz/generate`)

**Analog:** `src/app/api/study-sets/[id]/ingest/route.ts` + existing stub `quiz/generate/route.ts`

**Imports** (ingest lines 1–11):

```typescript
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  QuizGenerateError,
  QuizGenerateValidationError,
  runQuizGenerate,
} from "@/lib/pipeline/quizGenerate";
import { quizGenerateBodySchema } from "@/lib/pipeline/quizSchemas";
```

**Keep `verifyStudySet`** — copy unchanged from stub (`quiz/generate/route.ts` lines 5–28).

**POST handler** (ingest lines 38–51 + optional JSON body):

```typescript
export async function POST(
  request: Request,
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

  let body: { questionCount?: number } = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = quizGenerateBodySchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request." },
        { status: 400 },
      );
    }
  }

  try {
    const result = await runQuizGenerate({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      questionCountOverride: body.questionCount,
    });
    return NextResponse.json(result);
  } catch (error) {
    // map errors — see table below
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
```

**Error status mapping** (mirror ingest lines 92–117):

| Error | Status | Body shape |
|-------|--------|------------|
| `QuizGenerateValidationError` (stage < canonical, empty canonical) | `400` | `{ error: "validation_error", message }` |
| LLM / schema failure | `422` | `{ error: "quiz_generate_error", message }` |
| `ZodError` on output | `422` | `{ error: "validation_error", message }` |
| DB / unexpected | `500` | `{ error: "internal_error", message }` |

**Stage check helper** — compare against `PipelineStage` order in `src/types/studySet.ts`:

```typescript
const STAGE_ORDER: PipelineStage[] = [
  "input", "raw", "canonical", "mode_selected", "quiz", "flashcards",
];

function isStageAtLeast(current: PipelineStage, minimum: PipelineStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(minimum);
}
```

---

### 4. Client DB layer (`approved_questions` CRUD)

**Analog:** git HEAD `src/lib/db/studySetDb.ts` — **port into** `src/lib/client/studySetDb.ts` (currently stubs at lines 155–164)

**Current stub** (`src/lib/client/studySetDb.ts` lines 155–164) returns empty bank — replace with Supabase implementation.

**Row mappers** (git HEAD):

```typescript
function questionToRow(q: Question): Record<string, unknown> {
  return {
    prompt: q.question,
    choices: q.options as unknown as string[],
    correct_index: q.correctIndex,
    explanation: q.explanation ?? null,
    tags: [],
    source: q as unknown as Record<string, unknown>,
  };
}

function rowToQuestion(row: {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number;
  source: unknown;
}): Question {
  const fromSource =
    row.source && typeof row.source === "object"
      ? (row.source as Partial<Question>)
      : {};
  return {
    ...fromSource,
    id: row.id,
    question: row.prompt,
    options: row.choices as Question["options"],
    correctIndex: row.correct_index as Question["correctIndex"],
  };
}
```

**Read** (git HEAD lines 760–782):

```typescript
export async function getApprovedBank(studySetId: string): Promise<ApprovedBank | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_questions")
    .select("id,prompt,choices,correct_index,explanation,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedBank failed");
  if (!data?.length) return null;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    questions: data.map(rowToQuestion),
  };
}
```

**Write** (git HEAD lines 785–832) — upsert + delete orphans pattern:

```typescript
export async function putApprovedBankForStudySet(
  studySetId: string,
  bank: ApprovedBank,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data: existingRows, error: exErr } = await supabase
    .from("approved_questions")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(exErr, "approved_questions list failed");
  const existingIds = new Set((existingRows ?? []).map((r) => r.id));

  const upserts = bank.questions.map((q) => ({
    id: q.id,
    user_id: userId,
    study_set_id: studySetId,
    ...questionToRow(q),
    updated_at: bank.savedAt,
  }));

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from("approved_questions").upsert(upserts, {
      onConflict: "id",
    });
    assertNoError(upErr, "approved_questions upsert failed");
  } else {
    await supabase.from("approved_questions").delete()
      .eq("user_id", userId).eq("study_set_id", studySetId);
  }

  const keep = new Set(upserts.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    await supabase.from("approved_questions").delete()
      .eq("user_id", userId).eq("study_set_id", studySetId).in("id", toDelete);
  }
}
```

**Baseline schema** (`supabase/migrations/20260725120000_v21_baseline.sql` lines 109–126):

| DB column | App field |
|-----------|-----------|
| `prompt` | `Question.question` |
| `choices` | `Question.options` (length 4) |
| `correct_index` | `Question.correctIndex` |
| `explanation` | `Question.explanation` |
| `source` jsonb | `concept_id`, `section_key`, `source_excerpt` |

RLS: user owns rows via `user_id` — no new API routes needed (D-11).

---

### 5. Review UI data flow

**Analog:** `src/components/review/ReviewSection.tsx` (already correct architecture)

**Load on mount** (ReviewSection lines 49–68):

```typescript
const reload = useCallback(async () => {
  setLoading(true);
  try {
    await ensureStudySetDb();
    const approved = await getApprovedBank(studySetId);
    const list = approved?.questions ?? [];
    setQuestions(list);
  } finally {
    setLoading(false);
  }
}, [studySetId]);
```

**Auto-save on edit/delete** (ReviewSection lines 179–232) — calls `putApprovedBankForStudySet` + `touchStudySetMeta`; no change needed once `studySetDb` is wired.

**Done → dashboard** (ReviewSection lines 234–263):

```typescript
await putApprovedBankForStudySet(studySetId, payload);
await touchStudySetMeta(studySetId, { pipelineStage: "quiz" });
router.push("/dashboard");
```

**Page wrapper** (`src/app/(app)/edit/quiz/[id]/page.tsx` lines 54–61) — pass meta into `ReviewSection`; no structural change.

**Editor validation** — `QuestionEditor` uses `questionEditorSchema` from `src/lib/validations/question.ts`; keep as-is.

**Post-generation navigation:** after `POST /quiz/generate` succeeds, route to `/edit/quiz/[id]` (D-13). Generation may live on source page or dedicated step (Claude discretion D-16).

---

### 6. Quiz practice session flow

**Analog:** `src/components/quiz/QuizSession.tsx` (`PlaySession`)

**Load bank** (QuizSession lines 220–246):

```typescript
await ensureStudySetDb();
const bank = await getApprovedBank(studySetId);
let list = (bank?.questions ?? []).filter(isMcqComplete);
```

**Keyboard 1–4** (CORE-PRAC-01, QuizSession lines 388–411):

```typescript
if (e.key >= "1" && e.key <= "4") {
  e.preventDefault();
  const choice = (Number.parseInt(e.key, 10) - 1) as 0 | 1 | 2 | 3;
  handlePick(choice);
}
```

**Session completion** (D-15, QuizSession lines 354–365) — wire stub `recordQuizCompletion`:

```typescript
void recordQuizCompletion({
  studySetId,
  totalQuestions: playable.length,
  correctCount,
  wrongQuestionIds: [...wrongIdsRef.current],
});
```

Restore git `src/lib/sets/activityTracking.ts` logic into `src/lib/client/activityTracking.ts`:

```typescript
const { error: sessErr } = await supabase.from("quiz_sessions").insert({
  id: session.id,
  user_id: user.id,
  study_set_id: session.studySetId,
  completed_at: session.completedAt,
  total_questions: session.totalQuestions,
  correct_count: session.correctCount,
});
```

**Done page redirect** (stitch theme, QuizSession lines 367–373):

```typescript
router.push(`/quiz/${studySetId}/done`);
```

**Done page score** (`src/app/(app)/quiz/[id]/done/page.tsx`) — query latest `quiz_sessions` row for `studySetId` instead of `setLatestScore(null)` (line 47).

**Play page shell** (`src/app/(app)/quiz/[id]/page.tsx` lines 75–88) — `PlaySession` + `QuizPlayNavigator`; no change.

---

### 7. Dashboard list item actions

**Analog:** `DashboardLibraryClient.tsx` + `DashboardStudySetCard.tsx` + `useDashboardHome.ts`

**Counts load** (`useDashboardHome.ts` lines 84–99):

```typescript
const bank = await getApprovedBank(s.id);
next[s.id] = {
  editorStaging: 0,
  approved: bank?.questions.length ?? 0,
};
```

**Variant classification** (`DashboardLibraryClient.tsx` lines 252–263):

```typescript
function cardVariantFor(set: StudySetMeta, approved: number): DashboardStudySetCardVariant {
  if (approved <= 0) return "needs_edit";
  if (set.pipelineStage === "quiz" || set.pipelineStage === "flashcards") return "ready";
  return "in_progress";
}
```

**Primary CTA** (`DashboardStudySetCard.tsx` lines 104–109, 182–192):

```typescript
const play = playHref(meta);       // quiz → /quiz/[id]
const review = openEditorHref(meta); // quiz → /edit/quiz/[id]
const primaryHref = variant === "needs_edit" ? review : play;
const primaryLabel = dashboardCardPrimaryCtaLabel(variant, meta.contentKind);
```

**Link helpers** (`src/lib/dashboard/studySetDashboardLinks.ts`):

```typescript
export function playHref(meta: StudySetMeta): string {
  if (meta.contentKind === "flashcards") return flashcardsPlay(meta.id);
  return quizPlay(meta.id);
}

export function openEditorHref(meta: StudySetMeta): string {
  if (meta.contentKind === "flashcards") return editFlashcards(meta.id);
  return editQuiz(meta.id);
}
```

**Mistakes drill** — `reviewMistakesHref` + `hasMistakesForStudySet`; restore from git `activityTracking.ts` (Phase 5 drills deferred but link exists).

**Mode selection on source page** (`src/app/(app)/sets/[id]/source/page.tsx`) — add Quiz / Flashcards CTAs when `pipeline_stage >= canonical` (D-01). Quiz CTA flow:

1. `PUT` study set meta: `content_kind: 'quiz'`, `pipeline_stage: 'mode_selected'` via `putStudySetMeta`
2. `POST /api/study-sets/[id]/quiz/generate` via new client helper
3. `router.push(editQuiz(id))`

Flashcards CTA → Phase 5 stub message (D-01).

---

### `src/lib/client/quizGenerateStudySet.ts` (utility, request-response)

**Analog:** `ingestStudySet.ts` `postIngestJson` (lines 94–114)

```typescript
export async function postQuizGenerate(
  studySetId: string,
  body?: { questionCount?: number },
): Promise<{
  recommendedCount: number;
  generatedCount: number;
  questionIds: string[];
}> {
  const res = await fetch(`/api/study-sets/${studySetId}/quiz/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    recommendedCount?: number;
    generatedCount?: number;
    questionIds?: string[];
  };
  if (!res.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        "We couldn't generate quiz questions from this source.",
    );
  }
  return {
    recommendedCount: payload.recommendedCount ?? 0,
    generatedCount: payload.generatedCount ?? 0,
    questionIds: payload.questionIds ?? [],
  };
}
```

**Network errors** (ingest lines 207–210): `TypeError` → `Connection lost. Check your network and try again.`

---

### Tests

**Route test analog:** `src/app/api/study-sets/[id]/ingest/route.test.ts`

```typescript
vi.mock("@/lib/pipeline/quizGenerate", () => ({
  runQuizGenerate: (...args: unknown[]) => runQuizGenerateMock(...args),
}));
vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));
```

Cases: 401, 404, 400 (stage < canonical), 422 (LLM failure), 200 success with `{ recommendedCount, generatedCount, questionIds }`.

**Service test analog:** `src/lib/pipeline/ingest.test.ts` — mock Supabase chains; test dedupe, count cap, stage transitions.

---

## Shared Patterns

### API authentication
**Source:** `src/lib/api/requireApiUser.ts` (lines 5–18)
**Apply to:** `quiz/generate` route

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
**Source:** `quiz/generate/route.ts` lines 5–28
**Apply to:** all study-set mutation routes

### Server AI config (D-09)
**Source:** git HEAD `src/lib/server/ai-processing-config.ts` + `openAiChatCompletion.ts`
**Apply to:** `quizGenerate.ts` service only — never browser keys

```typescript
import { getAiProcessingConfig } from "@/lib/server/ai-processing-config";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";

const cfg = getAiProcessingConfig(resolveUserAiTier(user));
const result = await postChatCompletionAssistantText({
  configUrl: cfg.url,
  apiKey: cfg.apiKey,
  model: cfg.model,
  messages,
  responseFormatJsonObject: true,
  temperature: 0,
});
```

### Pipeline stage type
**Source:** `src/types/studySet.ts` lines 1–7

```typescript
export type PipelineStage =
  | "input" | "raw" | "canonical" | "mode_selected" | "quiz" | "flashcards";
```

### MCQ completeness
**Source:** `src/lib/review/validateMcq.ts`
**Apply to:** practice filter, review Done gate

```typescript
export function isMcqComplete(q: Question): boolean {
  return (
    q.question.trim().length >= 10 &&
    q.options.every((o) => o.trim().length > 0) &&
    q.correctIndex >= 0 && q.correctIndex <= 3
  );
}
```

### Toast errors on source page
**Source:** `ingestStudySet.ts` network handling
**Apply to:** quiz generation UI on canonical preview

```typescript
import { toast } from "sonner";
toast.error("Connection lost. Check your network and try again.");
```

### Baseline schema reference
**Source:** `supabase/migrations/20260725120000_v21_baseline.sql`

| Table | Phase 4 columns |
|-------|-----------------|
| `study_sets` | `pipeline_stage`, `content_kind` |
| `canonical_documents` | `canonical_markdown`, `metadata.extracted_questions` |
| `canonical_sections` | `ordinal`, `heading`, `body_markdown`, `section_type`, `section_key` |
| `approved_questions` | `prompt`, `choices`, `correct_index`, `explanation`, `tags`, `source` |
| `quiz_sessions` | `total_questions`, `correct_count`, `completed_at` |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `prompt/quiz_generator_v1.json` | config | transform | New file — mirror `canonical_builder_v1.json` structure only |
| Concept dedupe post-processor | utility | transform | No existing dedupe utility; implement inline in `quizGenerate.ts` per D-07 |
| Generation progress UI | component | event-driven | No quiz-specific progress card; optional — borrow `IngestProgressCard` / `CanonicalizeProgressCard` pattern from Phase 3 if dedicated generate step |

---

## Metadata

**Analog search scope:** `src/app/api/study-sets/**`, `src/lib/pipeline/**`, `src/lib/client/**`, `src/components/review/**`, `src/components/quiz/**`, `src/components/dashboard/**`, `src/hooks/useDashboardHome.ts`, `prompt/**`, `supabase/migrations/**`, git HEAD for deleted `src/lib/db/studySetDb.ts`, `src/lib/sets/activityTracking.ts`, `src/lib/server/persistStudySetGeneratedDraft.ts`, `src/lib/server/openAiChatCompletion.ts`
**Files scanned:** ~55
**Pattern extraction date:** 2026-07-25

**Working-tree note:** `src/lib/client/studySetDb.ts` and `src/lib/client/activityTracking.ts` are stubs; full Supabase implementations exist at git HEAD in `src/lib/db/studySetDb.ts` and `src/lib/sets/activityTracking.ts`. Phase 4 should port (not duplicate) those patterns into the client modules the UI already imports.
