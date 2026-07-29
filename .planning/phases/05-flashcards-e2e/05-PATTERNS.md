# Phase 5: Flashcards & E2E - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 22
**Analogs found:** 19 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prompt/flashcard_generator_v1.json` | config | transform | `prompt/quiz_generator_v1.json` | exact |
| `src/lib/pipeline/flashcardSchemas.ts` | utility | transform | `src/lib/pipeline/quizSchemas.ts` | exact |
| `src/lib/pipeline/flashcardPrompt.ts` | utility | transform | `src/lib/pipeline/quizPrompt.ts` | exact |
| `src/lib/pipeline/flashcardGenerate.ts` | service | batch, transform | `src/lib/pipeline/quizGenerate.ts` | exact |
| `src/lib/pipeline/mapFlashcardOutputToRows.ts` | utility | transform | `src/lib/pipeline/mapQuizOutputToRows.ts` | exact |
| `src/app/api/study-sets/[id]/flashcards/generate/route.ts` | route | request-response, transform | `src/app/api/study-sets/[id]/quiz/generate/route.ts` | exact |
| `src/lib/client/flashcardGenerateStudySet.ts` | utility | request-response | `src/lib/client/quizGenerateStudySet.ts` | exact |
| `src/lib/client/studySetDb.ts` (flashcard CRUD) | utility | CRUD | `getApprovedBank` / `putApprovedBankForStudySet` + git HEAD `getApprovedFlashcardBank` | exact |
| `src/app/(app)/sets/[id]/source/page.tsx` | component | request-response | current quiz wiring on same page | exact |
| `src/components/canonical/CanonicalModeSelectionFooter.tsx` | component | request-response | current footer + quiz resume strip | role-match |
| `src/components/flashcards/FlashcardSetupWizard.tsx` (new, discretion) | component | request-response | `FlashcardsGenerationControls` UI shell + `QuizGenerateProgressCard` | partial |
| `src/components/quiz/QuizGenerateProgressCard.tsx` (reuse/adapt) | component | event-driven | itself — flashcard generation progress | role-match |
| `src/components/flashcards/FlashcardSession.tsx` | component | request-response | itself (already wired to `getApprovedFlashcardBank`) | exact |
| `src/app/(app)/flashcards/[id]/done/page.tsx` | component | request-response | `src/app/(app)/quiz/[id]/done/page.tsx` | role-match |
| `src/lib/client/activityTracking.ts` | utility | CRUD | already implemented — verify E2E | exact |
| `src/components/quiz/QuizSession.tsx` | component | request-response | mistakes filter already present | exact |
| `src/components/dashboard/DashboardLibraryClient.tsx` | component | request-response | current flashcard-aware variants | exact |
| `src/hooks/useDashboardHome.ts` | hook | CRUD | already branches on `contentKind` | exact |
| `src/lib/pipeline/flashcardGenerate.test.ts` | test | transform | `src/lib/pipeline/quizGenerate.test.ts` | exact |
| `src/app/api/study-sets/[id]/flashcards/generate/route.test.ts` | test | request-response | `quiz/generate/route.test.ts` | exact |
| `.planning/phases/05-flashcards-e2e/05-VERIFICATION.md` | doc | batch | `04-VERIFICATION.md` | exact |
| `src/types/flashcard.ts` | model | transform | extend for `format` in `source` jsonb | partial |

## Pattern Assignments

### 1. Pipeline runner (`quizGenerate` → `flashcardGenerate`)

**Analog:** `src/lib/pipeline/quizGenerate.ts` — mirror structure line-for-line; swap table, schema, prompt, and post-processors.

**Error classes** (quizGenerate lines 33–45):

```typescript
export class FlashcardGenerateValidationError extends Error {
  readonly name = "FlashcardGenerateValidationError";
}

export class FlashcardGenerateError extends Error {
  readonly name = "FlashcardGenerateError";
  readonly statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
  }
}
```

**Stage order helper** — reuse same `PIPELINE_STAGES` array (quizGenerate lines 24–31, 59–71):

```typescript
const PIPELINE_STAGES = [
  "input", "raw", "canonical", "mode_selected", "quiz", "flashcards",
] as const;

function isAtLeastPipelineStage(stage: string, minimum: typeof PIPELINE_STAGES[number]): boolean {
  const stageIndex = PIPELINE_STAGES.indexOf(stage as typeof PIPELINE_STAGES[number]);
  const minimumIndex = PIPELINE_STAGES.indexOf(minimum);
  if (stageIndex < 0) return false;
  return stageIndex >= minimumIndex;
}
```

**Pre-flight reads** — canonical only (D-06); same tables as quiz (quizGenerate lines 182–235):

```typescript
const { data: studySet } = await supabase
  .from("study_sets")
  .select("id, pipeline_stage, title")
  .eq("id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

if (!studySet || !isAtLeastPipelineStage(studySet.pipeline_stage, "canonical")) {
  throw new FlashcardGenerateValidationError(
    "Flashcard generation requires pipeline_stage at least canonical.",
  );
}

const { data: document } = await supabase
  .from("canonical_documents")
  .select("id, canonical_markdown, metadata")
  .eq("study_set_id", studySetId)
  .eq("user_id", userId)
  .maybeSingle();

const { data: sections } = await supabase
  .from("canonical_sections")
  .select("ordinal, heading, body_markdown, section_key")
  .eq("canonical_document_id", document.id)
  .eq("user_id", userId)
  .order("ordinal", { ascending: true });
```

**Filter sections by coverage** (D-03 wizard `selected_sections`) — apply before LLM call:

```typescript
function filterSectionsForCoverage(
  sections: SectionRow[],
  coverage: FlashcardGenerateBody["coverage"],
): SectionRow[] {
  if (coverage === "entire_document") return sections;
  const allow = new Set(coverage.sectionKeys);
  return sections.filter((s) => allow.has(s.section_key));
}
```

**LLM + Zod + repair** (quizGenerate lines 88–171):

```typescript
const first = await postChatCompletionAssistantText({
  configUrl: aiConfig.url,
  apiKey: aiConfig.key,
  model: aiConfig.model,
  messages: baseMessages,
  responseFormatJsonObject: true,
  temperature: 0,
});

let parsed = flashcardGeneratorOutputSchema.safeParse(
  JSON.parse(stripJsonFence(first.text)),
);
if (!parsed.success) {
  // one repair pass — identical to quizGenerate
}
```

**Persistence before response** (D-10) — replace-all like quiz (quizGenerate lines 279–297):

```typescript
await supabase.from("approved_flashcards").delete()
  .eq("study_set_id", studySetId).eq("user_id", userId);

if (rows.length > 0) {
  await supabase.from("approved_flashcards").insert(rows);
}

await supabase.from("study_sets").update({
  pipeline_stage: "flashcards",
  content_kind: "flashcards",
}).eq("id", studySetId).eq("user_id", userId);
```

**Return shape** (D-11):

```typescript
export type FlashcardGenerateSuccess = {
  ok: true;
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: "term_definition" | "question_answer" | "cloze" | "mixed";
  cardIds: string[];
};
```

**Row mapper analog:** `src/lib/pipeline/mapQuizOutputToRows.ts` — new `mapFlashcardOutputToRows.ts`:

```typescript
export function mapGeneratedCardToRow(
  card: GeneratedFlashcard,
  meta: { id: string; userId: string; studySetId: string; promptVersion: string },
): ApprovedFlashcardInsertRow {
  return {
    id: meta.id,
    user_id: meta.userId,
    study_set_id: meta.studySetId,
    front: card.front,
    back: card.back,
    tags: card.concept_id ? [card.concept_id] : [],
    source: {
      format: card.format,
      concept_id: card.concept_id,
      section_key: card.section_key,
      source_excerpt: card.source_excerpt,
      prompt_version: meta.promptVersion,
      generated_at: new Date().toISOString(),
    },
  };
}
```

**Detected format** (D-08): compute dominant `format` across cards after validation; return as `detectedFormat`.

---

### 2. Prompt JSON + Zod validation

#### `prompt/flashcard_generator_v1.json` (config)

**Analog:** `prompt/quiz_generator_v1.json`

Mirror structure: `name`, `version`, `system`, `input` template vars, `tasks`, `output_schema`, `constraints`. Input vars per D-03 / D-07:

| Template var | Source |
|--------------|--------|
| `study_set_id` | route param |
| `title` | `study_sets.title` |
| `language` | `canonical_documents.metadata.language` |
| `canonical_markdown` | truncated canonical markdown |
| `sections_json` | filtered `canonical_sections` |
| `learning_goal` | wizard: `memorize` \| `understand` \| `exam_preparation` |
| `coverage_json` | `entire_document` or `{ section_keys: [...] }` |
| `amount` | `recommended` or numeric string |

**Do not** reference legacy vision vocabulary (`quick_recall`, `focusMode`) from `src/types/flashcardGeneration.ts` (D-05).

#### `src/lib/pipeline/flashcardPrompt.ts` (utility)

**Analog:** `src/lib/pipeline/quizPrompt.ts` (lines 1–67)

```typescript
export async function loadFlashcardPrompt(): Promise<FlashcardPromptSpec> {
  const filePath = path.join(process.cwd(), "prompt", "flashcard_generator_v1.json");
  const raw = await readFile(filePath, "utf8");
  cached = JSON.parse(raw) as FlashcardPromptSpec;
  FLASHCARD_PROMPT_VERSION = cached.version;
  return cached;
}

export function buildFlashcardGeneratorMessages(
  spec: FlashcardPromptSpec,
  vars: Record<string, string>,
): { system: string; user: string } {
  const substitutedInput = Object.fromEntries(
    Object.entries(spec.input).map(([key, template]) => [
      key,
      substituteFlashcardInput(template, vars),
    ]),
  );
  return { system: buildSystemPrompt(spec), user: JSON.stringify(substitutedInput) };
}
```

#### `src/lib/pipeline/flashcardSchemas.ts` (utility)

**Analog:** `src/lib/pipeline/quizSchemas.ts`

**Route request body** (D-12):

```typescript
import { z } from "zod";

const sectionKeySchema = z.string().regex(/^sec_\d{3}$/);

export const flashcardLearningGoalSchema = z.enum([
  "memorize",
  "understand",
  "exam_preparation",
]);

export const flashcardCoverageSchema = z.union([
  z.literal("entire_document"),
  z.object({ sectionKeys: z.array(sectionKeySchema).min(1) }),
]);

export const flashcardAmountSchema = z.union([
  z.literal("recommended"),
  z.object({ count: z.number().int().min(5).max(60) }),
]);

export const flashcardGenerateBodySchema = z.object({
  learningGoal: flashcardLearningGoalSchema,
  coverage: flashcardCoverageSchema,
  amount: flashcardAmountSchema,
});

export type FlashcardGenerateBody = z.infer<typeof flashcardGenerateBodySchema>;
```

**LLM output** (D-09):

```typescript
export const flashcardFormatSchema = z.enum([
  "term_definition",
  "question_answer",
  "cloze",
  "mixed",
]);

export const generatedFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  format: flashcardFormatSchema.optional(),
  concept_id: z.string().regex(/^concept_\d{3}$/).optional(),
  section_key: z.string().optional(),
  source_excerpt: z.string().optional(),
});

export const flashcardGeneratorOutputSchema = z.object({
  recommended_count: z.number().int().min(1).max(60),
  detected_format: flashcardFormatSchema,
  cards: z.array(generatedFlashcardSchema).min(1),
  warnings: z.array(z.string()).default([]),
});
```

**Practice filter** (FlashcardSession lines 63–65) — keep simple front/back trim check; optional `isFlashcardComplete` helper if format validation needed.

---

### 3. API route (`POST /flashcards/generate`)

**Analog:** `src/app/api/study-sets/[id]/quiz/generate/route.ts`

**Current stub** returns 501 — replace with quiz route pattern.

**Imports** (quiz route lines 1–11):

```typescript
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  FlashcardGenerateError,
  FlashcardGenerateValidationError,
  runFlashcardGenerate,
} from "@/lib/pipeline/flashcardGenerate";
import { flashcardGenerateBodySchema } from "@/lib/pipeline/flashcardSchemas";
import { isAiProcessingConfigured } from "@/lib/server/ai-processing-config";
```

**Keep `verifyStudySet`** — copy from existing flashcards stub (`flashcards/generate/route.ts` lines 5–28) or quiz stub (identical).

**POST handler** (quiz route lines 38–131):

```typescript
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error as Response;

  const { id } = await ctx.params;
  const verified = await verifyStudySet(auth.supabase, auth.user.id, id);
  if ("error" in verified) return verified.error as Response;

  if (!isAiProcessingConfigured()) {
    return NextResponse.json(
      { error: "ai_not_configured", message: "AI processing is not configured." },
      { status: 503 },
    );
  }

  let body: FlashcardGenerateBody;
  try {
    const rawBody = await request.json();
    body = flashcardGenerateBodySchema.parse(rawBody);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid flashcard generate body." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await runFlashcardGenerate({
      supabase: auth.supabase,
      userId: auth.user.id,
      studySetId: id,
      user: auth.user,
      ...body,
    });
    return NextResponse.json({
      recommendedCount: result.recommendedCount,
      generatedCount: result.generatedCount,
      detectedFormat: result.detectedFormat,
      cardIds: result.cardIds,
    });
  } catch (error) {
    // map FlashcardGenerateValidationError → 400
    // FlashcardGenerateError → 422 (503 if statusCode 503)
    // unexpected → 500
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
```

**Error status mapping** — identical table to quiz route (`04-PATTERNS` section 3).

---

### 4. Client flashcard bank CRUD (`approved_flashcards`)

**Analog chain:** `src/lib/client/studySetDb.ts` `getApprovedBank` / `putApprovedBankForStudySet` (lines 200–280) + git HEAD `getApprovedFlashcardBank` / `putApprovedFlashcardBankForStudySet`

**Current stubs** (`studySetDb.ts` lines 118–122, 189–198) return empty — replace with Supabase implementation.

**Read** (mirror `getApprovedBank` lines 200–218; git HEAD flashcard read):

```typescript
export async function getApprovedFlashcardBank(
  studySetId: string,
): Promise<ApprovedFlashcardBank | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_flashcards")
    .select("id,front,back,tags,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedFlashcardBank failed");
  if (!data?.length) return null;
  const items: FlashcardVisionItem[] = data.map((row) => ({
    id: row.id,
    front: row.front,
    back: row.back,
  }));
  return { version: 1, savedAt: new Date().toISOString(), items };
}
```

**Write** — upsert + delete orphans (mirror quiz `putApprovedBankForStudySet` lines 221–280; git HEAD):

```typescript
export async function putApprovedFlashcardBankForStudySet(
  studySetId: string,
  bank: ApprovedFlashcardBank,
): Promise<void> {
  const upserts = bank.items.map((it) => ({
    id: it.id ?? createRandomUuid(),
    user_id: userId,
    study_set_id: studySetId,
    front: it.front,
    back: it.back,
    tags: [],
    source: it as unknown as Record<string, unknown>,
    updated_at: bank.savedAt,
  }));
  // upsert onConflict id; delete orphans; optional: delete approved_questions when flashcard lane saves
}
```

**Baseline schema** (`supabase/migrations/20260725120000_v21_baseline.sql` lines 133–146):

| DB column | App field |
|-----------|-----------|
| `front` | `FlashcardVisionItem.front` |
| `back` | `FlashcardVisionItem.back` |
| `tags` | `concept_id` tag or empty |
| `source` jsonb | `format`, `concept_id`, `section_key`, `source_excerpt`, `prompt_version` |

**Client POST helper** — `src/lib/client/flashcardGenerateStudySet.ts` (mirror `quizGenerateStudySet.ts` lines 30–50):

```typescript
export async function postFlashcardGenerate(
  studySetId: string,
  body: FlashcardGenerateBody,
): Promise<{
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: string;
  cardIds: string[];
}> {
  const res = await fetch(`/api/study-sets/${studySetId}/flashcards/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // parseApiError + mapNetworkError — copy from quizGenerateStudySet.ts
}
```

---

### 5. Wizard UI flow (FLASH-01–03)

**Analog chain:** Quiz path on `source/page.tsx` (lines 129–177) + `QuizGenerateProgressCard` + `CanonicalModeSelectionFooter`

**Quiz generation flow on source page** (copy structure for flashcards):

```typescript
// 1. putStudySetMeta: content_kind flashcards, pipeline_stage mode_selected
await putStudySetMeta({ ...meta, contentKind: "flashcards", pipelineStage: "mode_selected" });

// 2. postFlashcardGenerate(id, wizardBody)
const result = await postFlashcardGenerate(id, {
  learningGoal,
  coverage,
  amount,
});

// 3. setGenerateUi success with counts + redirect to practice (D-15)
router.push(flashcardsPlay(id)); // or editFlashcards(id) if review-first
```

**Enable Flashcards CTA** — `CanonicalModeSelectionFooter.tsx` (lines 101–115): replace disabled button with `onSelectFlashcards` callback (mirror `onSelectQuiz` lines 88–96). Add flashcards resume strip when `pipelineStage === "flashcards" && approvedCount > 0` (mirror quiz resume strip lines 22–68).

**Wizard UI shell** — borrow **layout only** from `FlashcardsGenerationControls.tsx` (RadioGroup, Select, Label) but bind to **new** pipeline enums (`memorize` / `understand` / `exam_preparation`, section multi-select from `data.sections`, amount recommended vs 5–60). **Do not** import `FlashcardGenerationConfig` from `src/types/flashcardGeneration.ts`.

**Section multi-select** — source page already has `data.sections` with `sectionKey` from canonical preview (`CanonicalSectionToc` / preview data). Pass section list into wizard when coverage = `selected_sections`.

**Progress card** — reuse or fork `QuizGenerateProgressCard.tsx`:

```typescript
// Adapt labels: "Detecting format" / "Building cards" / "Saving to library"
// Success headline: `Generated ${generatedCount} of ${recommendedCount} recommended cards`
// detectedFormat chip optional
```

**Post-generation navigation** (D-15): redirect to `/flashcards/[id]` (practice), not editor — generation saves immediately (D-10). Optional: skip editor per CONTEXT deferred polish.

**FlashcardSession wiring** — already loads bank (FlashcardSession lines 56–77). Update `onDone` (line 287) to `router.push(flashcardsDone(id))` per D-16 instead of `/dashboard`.

---

### 6. Mistakes drill wiring (CORE-MIST-01)

**Status:** Client implementation largely complete — Phase 5 is **verify E2E**, not rewrite.

**Record mistakes** — `QuizSession.tsx` (lines 354–365):

```typescript
void recordQuizCompletion({
  studySetId,
  totalQuestions: playable.length,
  correctCount,
  wrongQuestionIds: [...wrongIdsRef.current],
});
```

**`recordQuizCompletion`** — `activityTracking.ts` (lines 52–104): inserts `quiz_sessions`; upserts `study_wrong_history` when wrong ids present; deletes row when all correct.

**Load mistakes filter** — `QuizSession.tsx` (lines 229–233):

```typescript
if (reviewMistakesOnly) {
  const mistakeIds = await getMistakeQuestionIds(studySetId);
  const allow = new Set(mistakeIds);
  list = list.filter((q) => allow.has(q.id));
}
```

**Route param** — `quiz/[id]/page.tsx` (lines 21–22, 77–78):

```typescript
const reviewMistakesOnly = searchParams.get("review") === "mistakes";
<PlaySession studySetId={id} reviewMistakesOnly={reviewMistakesOnly} ... />
```

**Dashboard link** — `studySetDashboardLinks.ts` (lines 31–37):

```typescript
export function reviewMistakesHref(meta: StudySetMeta): string | null {
  if (meta.contentKind === "flashcards") return null;
  return `${quizPlay(meta.id)}?review=mistakes`;
}
```

**Dashboard card** — `DashboardStudySetCard.tsx` (lines 203–209): shows "Review mistakes" when `hasMistakes && approvedCount > 0`.

**Mistakes load on dashboard** — `useDashboardHome.ts` (lines 99): `mist[s.id] = await hasMistakesForStudySet(s.id)`.

**Tests** — `activityTracking.test.ts` covers insert, upsert, `getMistakeQuestionIds`, `hasMistakesForStudySet`. Extend with integration smoke if needed.

**Verification checklist:** complete quiz with wrong answers → dashboard shows link → `/quiz/{id}?review=mistakes` loads subset → done page "Drill mistakes" CTA works (QuizSession lines 680–696).

---

### 7. Dashboard CTAs

**Analog:** `DashboardLibraryClient.tsx` + `DashboardStudySetCard.tsx` + `useDashboardHome.ts` + `studySetActionLabels.ts`

**Counts by content kind** (`useDashboardHome.ts` lines 84–98):

```typescript
if (s.contentKind === "flashcards") {
  const fc = await getApprovedFlashcardBank(s.id);
  next[s.id] = { editorStaging: 0, approved: fc?.items.length ?? 0 };
} else {
  const bank = await getApprovedBank(s.id);
  next[s.id] = { editorStaging: 0, approved: bank?.questions.length ?? 0 };
}
```

**Ready variant** (`DashboardLibraryClient.tsx` lines 264–280):

```typescript
if (approved > 0 && set.pipelineStage === "flashcards") return "ready";
```

**Primary CTA labels** (`studySetActionLabels.ts` lines 46–60):

```typescript
if (contentKind === "flashcards") return "Open flip study"; // D-17: Start flashcards when ready
```

**Play href** (`studySetDashboardLinks.ts` lines 24–28):

```typescript
if (meta.contentKind === "flashcards") return flashcardsPlay(meta.id);
```

**Source page approved count** — extend `loadApprovedCount` on source page (currently quiz-only lines 84–91) to load flashcard count when `content_kind === "flashcards"`.

---

### 8. E2E test patterns

**Analog:** `04-VERIFICATION.md` + vitest suites from Phase 4

**Automated gate** (D-20):

```bash
npm run test        # vitest — all suites green
npm run build       # next build — no type errors
```

**Route test** — copy `src/app/api/study-sets/[id]/quiz/generate/route.test.ts`:

```typescript
vi.mock("@/lib/pipeline/flashcardGenerate", () => ({
  runFlashcardGenerate: (...args: unknown[]) => runFlashcardGenerateMock(...args),
}));
```

Cases: 401, 404, 400 (stage < canonical, invalid body), 422 (LLM failure), 503 (AI not configured), 200 with `{ recommendedCount, generatedCount, detectedFormat, cardIds }`.

**Service test** — copy `src/lib/pipeline/quizGenerate.test.ts` mock Supabase chains:

- stage guard throws `FlashcardGenerateValidationError`
- delete → insert → `study_sets` update order
- section filter reduces LLM input
- `detectedFormat` derived from output

**Client DB test** — extend `studySetDb.test.ts` pattern for `getApprovedFlashcardBank` / `putApprovedFlashcardBankForStudySet` (mirror quiz bank tests lines 47–80).

**Client API test** — copy `quizGenerateStudySet.test.ts` for `postFlashcardGenerate`.

**Human E2E checkpoint** (D-21) — write `05-VERIFICATION.md` mirroring `04-VERIFICATION.md` structure:

| Path | Steps | Expected |
|------|-------|----------|
| Quiz express | canonical → Quiz CTA → edit → practice → done | Questions persist; score on done page |
| Flashcard express | canonical → Flashcards wizard → generate → `/flashcards/[id]` | Cards persist; Space flip works |
| Mistakes | Quiz with errors → dashboard link → `?review=mistakes` | Subset only; repopulates `study_wrong_history` |
| Build | `npm run build` | Pass |

**Schema tests** — copy `quizSchemas.test.ts` for `flashcardGenerateBodySchema` edge cases (amount bounds 5–60, section keys regex).

---

## Shared Patterns

### API authentication
**Source:** `src/lib/api/requireApiUser.ts`
**Apply to:** `flashcards/generate` route

### Study-set ownership guard
**Source:** `quiz/generate/route.ts` lines 13–36 (same as flashcards stub)

### Server AI config (D-P4-09)
**Source:** `quizGenerate.ts` lines 109–124
**Apply to:** `flashcardGenerate.ts` only — never browser keys

```typescript
const tier = resolveUserAiTier(params.user);
const aiConfig = getAiProcessingConfig(tier);
await postChatCompletionAssistantText({ configUrl: aiConfig.url, apiKey: aiConfig.key, ... });
```

### JSON fence stripping
**Source:** `stripJsonFence` from `@/lib/pipeline/canonicalize` (used in quizGenerate line 14)

### Pipeline stage + content kind
**Source:** `src/types/studySet.ts`

```typescript
export type PipelineStage =
  | "input" | "raw" | "canonical" | "mode_selected" | "quiz" | "flashcards";
```

### Toast + network errors on source page
**Source:** `source/page.tsx` lines 160–164 + `quizGenerateStudySet.ts` `mapNetworkError`

### Baseline schema reference
**Source:** `supabase/migrations/20260725120000_v21_baseline.sql`

| Table | Phase 5 columns |
|-------|-----------------|
| `study_sets` | `pipeline_stage`, `content_kind` |
| `canonical_documents` | `canonical_markdown`, `metadata` |
| `canonical_sections` | `section_key`, `heading`, `body_markdown`, `ordinal` |
| `approved_flashcards` | `front`, `back`, `tags`, `source` |
| `study_wrong_history` | `question_ids`, `updated_at` |
| `quiz_sessions` | session score for mistakes source |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|------|
| `prompt/flashcard_generator_v1.json` | config | transform | New file — structure only from `quiz_generator_v1.json` |
| `dedupeAndCapFlashcards` | utility | transform | No flashcard dedupe util; implement inline or small helper (quiz has `dedupeAndCapQuestions`) |
| `FlashcardSetupWizard.tsx` | component | request-response | No 3-step pipeline wizard exists; borrow UI primitives only from legacy `FlashcardsGenerationControls` |
| `detected_format` aggregation | utility | transform | New domain logic — pick dominant format from card batch |

---

## Metadata

**Analog search scope:** `src/lib/pipeline/**`, `src/app/api/study-sets/**`, `src/lib/client/**`, `src/components/flashcards/**`, `src/components/canonical/**`, `src/components/quiz/**`, `src/components/dashboard/**`, `src/hooks/useDashboardHome.ts`, `prompt/**`, `supabase/migrations/**`, git HEAD `src/lib/db/studySetDb.ts` (flashcard CRUD)
**Files scanned:** ~60
**Pattern extraction date:** 2026-07-25

**Working-tree notes:**
- `src/lib/client/studySetDb.ts` flashcard functions are stubs; full implementation exists at git HEAD in `src/lib/db/studySetDb.ts` — port simplified shape (`FlashcardVisionItem` without vision `kind`/`confidence`).
- `src/lib/client/activityTracking.ts` is **already wired** for mistakes — Phase 5 verifies drill E2E rather than porting stubs.
- Do **not** reuse `FlashcardGenerationConfig` / vision flashcard types for pipeline generation (D-05).
