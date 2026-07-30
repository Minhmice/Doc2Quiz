import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  allowedSemanticIntentsForFact,
  atomicFactSchema,
  type AtomicFact,
} from "@/lib/pipeline/canonicalSchemas";
import { mapQuizOutputToRows } from "@/lib/pipeline/mapQuizOutputToRows";
import {
  buildQuizGeneratorMessages,
  loadQuizPrompt,
  QUIZ_PROMPT_VERSION,
} from "@/lib/pipeline/quizPrompt";
import {
  quizModelOutputSchema,
  type GeneratedQuestion,
  type QuizGeneratorOutput,
  type QuizModelOutput,
  type QuizModelQuestion,
} from "@/lib/pipeline/quizSchemas";
import { stripJsonFence } from "@/lib/pipeline/canonicalize";
import { GENERATOR_LLM_CANONICAL_MARKDOWN_MAX_CHARS } from "@/lib/pipeline/rawMarkdownLimit";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import {
  resolveSourceQuestions,
  type ResolvedSourceQuestion,
  type SourceQuestionInput,
} from "@/lib/pipeline/sourceQuestionResolver";
import { checkQuiz } from "@/lib/pipeline/faithfulness";
import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
} from "@/lib/server/ai-processing-config";
import {
  formatUpstreamAiError,
} from "@/lib/server/formatUpstreamAiError";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";

const CANONICAL_MARKDOWN_MAX_CHARS = GENERATOR_LLM_CANONICAL_MARKDOWN_MAX_CHARS;
const QUIZ_AI_TOTAL_BUDGET_MS = 180_000;
const QUIZ_AI_REQUEST_TIMEOUT_MS = 90_000;
const SUPABASE_WRITE_MAX_ATTEMPTS = 3;

const PIPELINE_STAGES = [
  "input",
  "raw",
  "canonical",
  "mode_selected",
  "quiz",
  "flashcards",
] as const;

export class QuizGenerateValidationError extends Error {
  readonly name = "QuizGenerateValidationError";
}

export class QuizGenerateError extends Error {
  readonly name = "QuizGenerateError";
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, number | string>;

  constructor(
    message: string,
    statusCode = 422,
    code = "QUIZ_GENERATION_FAILED",
    details?: Record<string, number | string>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export type QuizGenerateSuccess = {
  ok: true;
  requestedCount: number;
  recommendedCount: number;
  generatedCount: number;
  questionIds: string[];
  generationMode: "source" | "source_ai" | "ai" | "deterministic" | "hybrid";
  factReuseCount: number;
  warnings: string[];
  rejectionSummary: Record<string, number>;
};

type CanonicalMetadata = Record<string, unknown> & {
  atomic_facts?: AtomicFact[];
  extracted_questions?: unknown[];
  canonicalization_mode?: "ai" | "heuristic";
  language?: string;
  max_supported_count?: number;
  source_readiness?: {
    pass: boolean;
    reasons: string[];
  };
};

function isAtLeastPipelineStage(
  stage: string,
  minimum: (typeof PIPELINE_STAGES)[number],
): boolean {
  const stageIndex = PIPELINE_STAGES.indexOf(
    stage as (typeof PIPELINE_STAGES)[number],
  );
  const minimumIndex = PIPELINE_STAGES.indexOf(minimum);
  if (stageIndex < 0) {
    return false;
  }
  return stageIndex >= minimumIndex;
}

export function truncateCanonicalMarkdown(canonicalMarkdown: string): {
  markdown: string;
  warnings: string[];
} {
  if (canonicalMarkdown.length <= CANONICAL_MARKDOWN_MAX_CHARS) {
    return { markdown: canonicalMarkdown, warnings: [] };
  }
  return {
    markdown: canonicalMarkdown.slice(0, CANONICAL_MARKDOWN_MAX_CHARS),
    warnings: [
      `canonical_markdown truncated from ${canonicalMarkdown.length} to ${CANONICAL_MARKDOWN_MAX_CHARS} characters`,
    ],
  };
}

function quizAiRequestSignal(startedAt: number): AbortSignal | null {
  const remaining = QUIZ_AI_TOTAL_BUDGET_MS - (Date.now() - startedAt);
  if (remaining <= 0) {
    return null;
  }
  return AbortSignal.timeout(
    Math.max(1, Math.min(QUIZ_AI_REQUEST_TIMEOUT_MS, remaining)),
  );
}

export async function callQuizGenerator(params: {
  studySetId: string;
  title: string;
  language: string;
  canonicalMarkdown: string;
  sectionsJson: string;
  extractedQuestionsJson: string;
  atomicFactsJson: string;
  maxSupportedCount: string;
  requestedCount: string;
  user: User;
  startedAt: number;
}): Promise<QuizModelOutput> {
  const spec = await loadQuizPrompt();
  const messages = buildQuizGeneratorMessages(spec, {
    study_set_id: params.studySetId,
    title: params.title,
    language: params.language,
    canonical_markdown: params.canonicalMarkdown,
    sections_json: params.sectionsJson,
    extracted_questions_json: params.extractedQuestionsJson,
    atomic_facts_json: params.atomicFactsJson,
    max_supported_count: params.maxSupportedCount,
    requested_count: params.requestedCount,
  });

  const tier = resolveUserAiTier(params.user);
  const aiConfig = getAiProcessingConfig(tier);

  const baseMessages = [
    { role: "system" as const, content: messages.system },
    {
      role: "user" as const,
      content: messages.user,
    },
  ];

  const requestSignal = quizAiRequestSignal(params.startedAt);
  if (!requestSignal) {
    throw new QuizGenerateError("Quiz AI time budget exhausted.", 503);
  }

  const first = await postChatCompletionAssistantText({
    configUrl: aiConfig.url,
    apiKey: aiConfig.key,
    model: aiConfig.model,
    messages: baseMessages,
    responseFormatJsonObject: true,
    temperature: 0,
    signal: requestSignal,
  });

  if (!first.ok) {
    throw new QuizGenerateError(
      formatUpstreamAiError(first.status, first.body),
    );
  }

  let parsed;
  try {
    parsed = quizModelOutputSchema.safeParse(
      JSON.parse(stripJsonFence(first.text)),
    );
  } catch {
    parsed = quizModelOutputSchema.safeParse(null);
  }

  if (!parsed.success) {
    const repairSignal = quizAiRequestSignal(params.startedAt);
    if (!repairSignal) {
      throw new QuizGenerateError("Quiz AI time budget exhausted.", 503);
    }
    const repair = await postChatCompletionAssistantText({
      configUrl: aiConfig.url,
      apiKey: aiConfig.key,
      model: aiConfig.model,
      messages: [
        ...baseMessages,
        { role: "assistant" as const, content: first.text },
        {
          role: "user" as const,
          content: `Invalid schema: ${summarizeZodError(parsed.error)}. Return ONLY valid JSON matching the schema.`,
        },
      ],
      responseFormatJsonObject: true,
      temperature: 0,
      signal: repairSignal,
    });

    if (!repair.ok) {
      throw new QuizGenerateError(
        formatUpstreamAiError(repair.status, repair.body),
      );
    }

    try {
      parsed = quizModelOutputSchema.safeParse(
        JSON.parse(stripJsonFence(repair.text)),
      );
    } catch {
      parsed = quizModelOutputSchema.safeParse(null);
    }
  }

  if (!parsed.success) {
    throw new QuizGenerateError(
      `Quiz generator output failed validation: ${summarizeZodError(parsed.error)}`,
    );
  }

  return parsed.data;
}

function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function compactText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function cleanQuestionText(value: string, preserveFormatting = false): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace(/^(?:Câu|Question)\s+\d+\s*[.:)]\s*/iu, "");
  return preserveFormatting
    ? normalized.replace(/[ \t]+/g, " ")
    : compactText(normalized);
}

function factQualityIssue(fact: AtomicFact): string | null {
  const excerpt = compactText(fact.source_excerpt);
  const statement = compactText(fact.statement);
  const answer = compactText(fact.answer_text);
  const administrativeMarkers = [
    /sở giáo dục/iu,
    /đề chính thức/iu,
    /thời gian làm bài/iu,
    /số báo danh/iu,
    /thí sinh trả lời/iu,
    /\btrang\s+\d+/iu,
  ].filter((pattern) => pattern.test(excerpt)).length;
  const questionMarkers = excerpt.match(/\bCâu\s+\d+[.:)]/giu)?.length ?? 0;
  const optionMarkers = excerpt.match(/(?:^|\s)[A-D][.)]\s+/gu)?.length ?? 0;

  if (
    administrativeMarkers >= 2 ||
    questionMarkers >= 2 ||
    optionMarkers >= 8
  ) {
    return "fact_contains_document_dump";
  }
  if (!answer || !statement || !excerpt) {
    return "fact_missing_required_content";
  }
  if (
    fact.entities.some((entity) =>
      /^(?:đây|đó|nó|this|that|it)(?:\s|$)/iu.test(compactText(entity))
    )
  ) {
    return "fact_has_ambiguous_entity";
  }
  return null;
}

function promptQualityIssue(
  prompt: string,
  answer: string,
  options: {
    allowEmbeddedEvidence?: boolean;
    allowSourceFormatting?: boolean;
  } = {},
): string | null {
  const compact = compactText(prompt);
  if (options.allowSourceFormatting) {
    if (
      !compact ||
      /(?:Đáp án\s*:|Giải thích\s*:|Phân tích từng phương án|Câu hỏi nào sau đây xuất hiện tại vị trí)/iu.test(
        compact,
      )
    ) {
      return "source_prompt_invalid";
    }
    return null;
  }
  const questionMarkers = compact.match(/\bCâu\s+\d+[.:)]/giu)?.length ?? 0;
  const optionMarkers = compact.match(/(?:^|\s)[A-D][.)]\s+/gu)?.length ?? 0;
  if (
    (!options.allowSourceFormatting && /_{3,}/u.test(compact)) ||
    questionMarkers >= 2 ||
    optionMarkers >= 4 ||
    [
      /đề chính thức/iu,
      /thời gian làm bài/iu,
      /số báo danh/iu,
      /thí sinh trả lời/iu,
    ].filter((pattern) => pattern.test(compact)).length >= 2
  ) {
    return "prompt_not_standalone";
  }
  if (!options.allowSourceFormatting && !compact.endsWith("?")) {
    return "prompt_not_interrogative";
  }
  const normalizedAnswer = normalizeAnswer(answer);
  if (
    !options.allowEmbeddedEvidence &&
    normalizedAnswer.length >= 4 &&
    normalizeAnswer(compact).includes(normalizedAnswer)
  ) {
    return "prompt_leaks_answer";
  }
  return null;
}

type ExtractedQuestion = {
  question: string;
  options: string[];
  answer: string | null;
  section_id: string;
};

type CandidateBuild = {
  questions: GeneratedQuestion[];
  modes: Set<"source" | "source_ai" | "ai" | "deterministic">;
  warnings: string[];
  rejectionSummary: Record<string, number>;
};

function addRejection(summary: Record<string, number>, code: string): void {
  summary[code] = (summary[code] ?? 0) + 1;
}

function promptIntroducesUnsupportedToken(prompt: string, excerpt: string): boolean {
  const normalizedExcerpt = normalizeAnswer(excerpt);
  const numbers = prompt.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.some((number) => !excerpt.normalize("NFKC").includes(number))) {
    return true;
  }
  const ignored = new Set([
    "what", "which", "who", "when", "where", "according",
    "theo", "chọn", "điền", "nội", "phương", "câu", "biến",
  ]);
  const capitalized = prompt.match(/\p{Lu}[\p{L}\p{M}-]*/gu) ?? [];
  return capitalized.some((token) => {
    const normalized = normalizeAnswer(token);
    return (
      normalized.length > 2 &&
      !ignored.has(normalized) &&
      !normalizedExcerpt.includes(normalized)
    );
  });
}

function numericDistractors(answer: string): string[] {
  const match = answer.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return [];
  const raw = match[0];
  const number = Number(raw.replace(",", "."));
  if (!Number.isFinite(number)) return [];
  const decimals = raw.includes(".") || raw.includes(",")
    ? raw.split(/[.,]/)[1].length
    : 0;
  const step = decimals > 0 ? 1 / 10 ** decimals : 1;
  return [-1, 1, 2].map((offset) => {
    const replacement = (number + offset * step).toFixed(decimals);
    return answer.replace(raw, raw.includes(",") ? replacement.replace(".", ",") : replacement);
  });
}

function semanticDistractors(answer: string): string[] {
  const substitutions: Array<[RegExp, string]> = [
    [/phát triển/giu, "thu hẹp"],
    [/nâng cao/giu, "hạ thấp"],
    [/\btăng\b/giu, "giảm"],
    [/mở rộng/giu, "thu hẹp"],
    [/độc lập/giu, "phụ thuộc"],
    [/hòa bình/giu, "xung đột"],
    [/ghi nhận/giu, "phủ nhận"],
    [/quốc tế/giu, "trong nước"],
    [/\bdevelop(?:ment)?\b/giu, "reduction"],
    [/\bincrease\b/giu, "decrease"],
    [/\binclude(?:s|d)?\b/giu, "exclude"],
  ];
  const variants: string[] = [];
  for (const [pattern, replacement] of substitutions) {
    for (const match of answer.matchAll(pattern)) {
      if (match.index === undefined) continue;
      variants.push(
        `${answer.slice(0, match.index)}${replacement}${answer.slice(
          match.index + match[0].length,
        )}`,
      );
    }
  }
  return variants;
}

function semanticTokens(value: string): Set<string> {
  const stopwords = new Set([
    "của", "và", "là", "được", "một", "những", "các", "cho", "trong",
    "the", "and", "is", "are", "was", "were", "of", "for", "with",
  ]);
  return new Set(
    normalizeAnswer(value)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3 && !stopwords.has(token)),
  );
}

function isRelatedPeer(fact: AtomicFact, candidate: AtomicFact): boolean {
  const factTokens = semanticTokens(fact.entities.join(" "));
  const candidateTokens = semanticTokens(candidate.entities.join(" "));
  return [...factTokens].some((token) => candidateTokens.has(token));
}

function buildChoices(
  answer: string,
  preferred: string[],
  peerAnswers: string[],
  seed: number,
): [string, string, string, string] | null {
  const normalizedAnswer = normalizeAnswer(answer);
  const distractors: string[] = [];
  const add = (value: string) => {
    const cleaned = value
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .trim()
      .replace(/^[A-D][.)]\s*/u, "");
    const normalized = normalizeAnswer(cleaned);
    if (
      normalized &&
      normalized !== normalizedAnswer &&
      !normalized.includes(normalizedAnswer) &&
      !normalizedAnswer.includes(normalized) &&
      !distractors.some((item) => normalizeAnswer(item) === normalized)
    ) {
      distractors.push(cleaned);
    }
  };
  preferred.forEach(add);
  peerAnswers.forEach(add);
  numericDistractors(answer).forEach(add);
  semanticDistractors(answer).forEach(add);
  if (distractors.length < 3) return null;
  const correctIndex = seed % 4;
  const choices = distractors.slice(0, 3);
  choices.splice(correctIndex, 0, answer);
  return choices as [string, string, string, string];
}

function deterministicPrompt(fact: AtomicFact, variant: number): string {
  const entity = compactText(fact.entities[0] ?? "");
  if (!entity || normalizeAnswer(entity) === normalizeAnswer(fact.answer_text)) {
    return "";
  }
  const templates = [
    `Theo tài liệu, nội dung nào mô tả đúng ${entity}?`,
    `Tài liệu nêu điều gì về ${entity}?`,
    `Phương án nào phản ánh đúng thông tin về ${entity}?`,
    `Nội dung nào được gắn với ${entity} trong tài liệu?`,
    `Dựa vào tài liệu, nhận định nào đúng về ${entity}?`,
    `Thông tin chính xác về ${entity} là gì?`,
    `Đâu là mô tả phù hợp với ${entity} theo nguồn?`,
    `Nguồn tài liệu xác nhận nội dung nào về ${entity}?`,
    `Khi nói về ${entity}, tài liệu đưa ra thông tin nào?`,
    `Phương án nào trình bày chính xác ${entity}?`,
    `Ý nào sau đây phù hợp với mô tả về ${entity}?`,
    `Theo nội dung đã học, điều nào đúng về ${entity}?`,
  ];
  return templates[variant % templates.length];
}

function conceptIdForFact(fact: AtomicFact, facts: AtomicFact[]): string {
  const index = facts.findIndex((candidate) => candidate.fact_id === fact.fact_id);
  return `concept_${String(index + 1).padStart(3, "0")}`;
}

function enrichQuestion(params: {
  modelQuestion: QuizModelQuestion;
  fact: AtomicFact;
  facts: AtomicFact[];
  index: number;
  preferredChoices?: string[];
  preservePromptFormatting?: boolean;
}): GeneratedQuestion | null {
  const { modelQuestion, fact, facts, index } = params;
  const correctIndex = modelQuestion.correct_index;
  const preferred =
    params.preferredChoices ??
    modelQuestion.choices.filter((_, choiceIndex) => choiceIndex !== correctIndex);
  const choices = buildChoices(
    fact.answer_text,
    preferred,
    facts
      .filter(
        (item) =>
          item.fact_id !== fact.fact_id &&
          item.fact_type === fact.fact_type &&
          isRelatedPeer(fact, item),
      )
      .map((item) => item.answer_text),
    index,
  );
  if (!choices) return null;
  const stem = cleanQuestionText(
    modelQuestion.prompt,
    params.preservePromptFormatting,
  );
  const prompt =
    modelQuestion.context_mode === "source_excerpt"
      ? `Tư liệu:\n\n${fact.source_excerpt.trim()}\n\n${stem}`
      : stem;
  return {
    concept_id: conceptIdForFact(fact, facts),
    prompt,
    choices,
    correct_index: (index % 4) as 0 | 1 | 2 | 3,
    explanation: fact.source_excerpt,
    section_key: fact.section_key,
    source_excerpt: fact.source_excerpt,
    fact_ids: [fact.fact_id],
    semantic_intent:
      modelQuestion.semantic_intent &&
      fact.question_opportunities.includes(modelQuestion.semantic_intent)
        ? modelQuestion.semantic_intent
        : fact.question_opportunities[0],
    answer_text: fact.answer_text,
  };
}

export function buildQuestionCandidates(params: {
  facts: AtomicFact[];
  extractedQuestions: unknown[];
  resolvedSourceQuestions?: ResolvedSourceQuestion[];
  modelOutput: QuizModelOutput | null;
  targetCount: number;
  fillDeterministically?: boolean;
}): CandidateBuild {
  const { facts, targetCount } = params;
  const result: CandidateBuild = {
    questions: [],
    modes: new Set(),
    warnings: [...(params.modelOutput?.warnings ?? [])],
    rejectionSummary: {},
  };
  const normalizedPrompts = new Set<string>();
  const preferredChoicesByFact = new Map<string, string[]>();
  const rememberChoices = (
    factId: string,
    choices: string[],
    correctIndex: number,
  ) => {
    const current = preferredChoicesByFact.get(factId) ?? [];
    current.push(
      ...choices.filter((_, choiceIndex) => choiceIndex !== correctIndex),
    );
    preferredChoicesByFact.set(factId, current);
  };
  const append = (
    question: GeneratedQuestion | null,
    mode: "source" | "source_ai" | "ai" | "deterministic",
  ) => {
    if (!question) {
      addRejection(result.rejectionSummary, "insufficient_quality_distractors");
      return;
    }
    const normalizedPrompt = normalizeAnswer(question.prompt);
    if (normalizedPrompts.has(normalizedPrompt)) {
      addRejection(result.rejectionSummary, "duplicate_prompt");
      return;
    }
    normalizedPrompts.add(normalizedPrompt);
    result.questions.push(question);
    result.modes.add(mode);
  };

  for (const [sourceQuestionIndex, raw] of params.extractedQuestions.entries()) {
    if (result.questions.length >= targetCount) break;
    const source = raw as Partial<ExtractedQuestion>;
    if (
      !source.question ||
      !source.answer ||
      !source.section_id ||
      !Array.isArray(source.options) ||
      source.options.length !== 4
    ) {
      addRejection(result.rejectionSummary, "source_question_incomplete");
      continue;
    }
    const correctIndex = source.options.findIndex(
      (option) => normalizeAnswer(option) === normalizeAnswer(source.answer!),
    );
    if (correctIndex < 0 || correctIndex > 3) {
      addRejection(result.rejectionSummary, "source_answer_not_in_choices");
      continue;
    }
    const choices = source.options.map(compactText) as [string, string, string, string];
    if (new Set(choices.map(normalizeAnswer)).size !== 4) {
      addRejection(result.rejectionSummary, "source_choices_not_distinct");
      continue;
    }
    const prompt = cleanQuestionText(source.question, true);
    const promptIssue = promptQualityIssue(
      prompt,
      source.answer,
      { allowEmbeddedEvidence: true, allowSourceFormatting: true },
    );
    if (promptIssue) {
      addRejection(result.rejectionSummary, promptIssue);
      continue;
    }
    append({
      concept_id: `concept_${String(
        facts.length + sourceQuestionIndex + 1,
      ).padStart(3, "0")}`,
      prompt,
      choices,
      correct_index: correctIndex as 0 | 1 | 2 | 3,
      explanation: source.answer,
      section_key: source.section_id,
      source_excerpt: source.question,
      fact_ids: [
        `sourceq_${String(sourceQuestionIndex + 1).padStart(3, "0")}`,
      ],
      semantic_intent: "source_question",
      answer_text: source.answer,
      resolution: {
        basis: "source_answer",
        confidence: "high",
        citations: [],
      },
    }, "source");
  }

  for (const resolved of params.resolvedSourceQuestions ?? []) {
    if (result.questions.length >= targetCount) break;
    const prompt = cleanQuestionText(resolved.question, true);
    const promptIssue = promptQualityIssue(prompt, resolved.answerText, {
      allowEmbeddedEvidence: true,
    });
    if (promptIssue) {
      addRejection(result.rejectionSummary, promptIssue);
      continue;
    }
    append({
      concept_id: `concept_${String(
        facts.length + resolved.sourceQuestionIndex + 1,
      ).padStart(3, "0")}`,
      prompt,
      choices: resolved.choices,
      correct_index: resolved.correctIndex,
      explanation: resolved.rationale,
      section_key: resolved.section_id,
      source_excerpt: resolved.evidence[0]?.snippet ?? resolved.question,
      fact_ids: [
        `sourceq_${String(resolved.sourceQuestionIndex + 1).padStart(3, "0")}`,
      ],
      semantic_intent: "source_question",
      answer_text: resolved.answerText,
      resolution: {
        basis: resolved.basis,
        confidence: resolved.confidence,
        citations: resolved.evidence.map(({ title, url, snippet }) => ({
          title,
          url,
          snippet,
        })),
      },
    }, "source_ai");
  }

  for (const modelQuestion of params.modelOutput?.questions ?? []) {
    if (result.questions.length >= targetCount) break;
    const factId = modelQuestion.fact_id ?? modelQuestion.fact_ids?.[0];
    const fact = facts.find((item) => item.fact_id === factId);
    if (!fact) {
      addRejection(result.rejectionSummary, "unknown_fact");
      continue;
    }
    const cleanedModelQuestion: QuizModelQuestion = {
      ...modelQuestion,
      prompt: cleanQuestionText(modelQuestion.prompt),
    };
    const promptIssue = promptQualityIssue(
      modelQuestion.prompt,
      fact.answer_text,
    );
    if (promptIssue) {
      addRejection(result.rejectionSummary, promptIssue);
      continue;
    }
    if (
      promptIntroducesUnsupportedToken(
        cleanedModelQuestion.prompt,
        fact.source_excerpt,
      )
    ) {
      addRejection(result.rejectionSummary, "unsupported_prompt_token");
      continue;
    }
    rememberChoices(
      fact.fact_id,
      cleanedModelQuestion.choices,
      cleanedModelQuestion.correct_index,
    );
    append(
      enrichQuestion({
        modelQuestion: cleanedModelQuestion,
        fact,
        facts,
        index: result.questions.length,
        preferredChoices: preferredChoicesByFact.get(fact.fact_id) ?? [],
      }),
      "ai",
    );
  }

  let variant = 0;
  while (
    params.fillDeterministically !== false &&
    facts.length > 0 &&
    result.questions.length < targetCount
  ) {
    const fact = facts[variant % facts.length];
    const prompt = deterministicPrompt(fact, variant);
    const promptIssue = promptQualityIssue(prompt, fact.answer_text);
    if (promptIssue) {
      addRejection(result.rejectionSummary, promptIssue);
      variant += 1;
      if (variant > targetCount * 12) break;
      continue;
    }
    const modelQuestion: QuizModelQuestion = {
      fact_id: fact.fact_id,
      prompt,
      choices: ["A", "B", "C", "D"],
      correct_index: 0,
      context_mode: "none",
      semantic_intent: fact.question_opportunities[0],
    };
    append(
      enrichQuestion({
        modelQuestion,
        fact,
        facts,
        index: result.questions.length,
        preferredChoices: preferredChoicesByFact.get(fact.fact_id) ?? [],
      }),
      "deterministic",
    );
    variant += 1;
    if (variant > targetCount * 12) {
      break;
    }
  }

  return result;
}

export function resolveGenerationMode(
  modes: Set<"source" | "source_ai" | "ai" | "deterministic">,
): QuizGenerateSuccess["generationMode"] {
  if (modes.size > 1) return "hybrid";
  return modes.values().next().value ?? "deterministic";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function replaceQuizWithRetry(
  supabase: SupabaseClient,
  params: {
    studySetId: string;
    expectedCount: number;
    rows: ReturnType<typeof mapQuizOutputToRows>;
  },
): Promise<number> {
  for (let attempt = 1; attempt <= SUPABASE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc("replace_quiz_questions", {
      p_study_set_id: params.studySetId,
      p_expected_count: params.expectedCount,
      p_questions: params.rows,
    });
    if (!error) return typeof data === "number" ? data : -1;
    if (
      !isSupabaseNetworkError(error.message) ||
      attempt === SUPABASE_WRITE_MAX_ATTEMPTS
    ) {
      throw new QuizGenerateError(
        formatSupabaseNetworkError(error.message),
        isSupabaseNetworkError(error.message) ? 503 : 500,
        "QUIZ_PERSISTENCE_FAILED",
      );
    }
    await sleep(750 * attempt);
  }
  return -1;
}

export function validateAtomicFactArtifact(params: {
  rawFacts: unknown;
  canonicalMarkdown: string;
  sections: Array<{ section_key: string; body_markdown: string }>;
}): { facts: AtomicFact[]; capacity: number; reasons: string[] } {
  const parsed = atomicFactSchema.array().safeParse(params.rawFacts);
  if (!parsed.success) {
    return {
      facts: [],
      capacity: 0,
      reasons: [`Atomic fact schema invalid: ${parsed.error.message}`],
    };
  }

  const sectionBodies = new Map(
    params.sections.map((section) => [
      section.section_key,
      section.body_markdown,
    ]),
  );
  const factIds = new Set<string>();
  const opportunities = new Set<string>();
  const reasons: string[] = [];

  for (const fact of parsed.data) {
    const sectionBody = sectionBodies.get(fact.section_key);
    if (factIds.has(fact.fact_id)) {
      reasons.push(`Duplicate fact_id ${fact.fact_id}.`);
    }
    factIds.add(fact.fact_id);
    if (!sectionBody) {
      reasons.push(`Fact ${fact.fact_id} has unknown section_key.`);
    } else if (!sectionBody.includes(fact.source_excerpt)) {
      reasons.push(`Fact ${fact.fact_id} excerpt is outside its section.`);
    }
    if (!params.canonicalMarkdown.includes(fact.source_excerpt)) {
      reasons.push(`Fact ${fact.fact_id} excerpt is not canonical.`);
    }
    if (!fact.source_excerpt.includes(fact.answer_text)) {
      reasons.push(`Fact ${fact.fact_id} answer_text is not in its excerpt.`);
    }
    const qualityIssue = factQualityIssue(fact);
    if (qualityIssue) {
      reasons.push(`Fact ${fact.fact_id} failed quality check: ${qualityIssue}.`);
    }
    if (fact.answerable) {
      for (const intent of fact.question_opportunities) {
        if (!allowedSemanticIntentsForFact(fact).has(intent)) {
          reasons.push(
            `Fact ${fact.fact_id} uses unsupported intent ${intent}.`,
          );
        }
        opportunities.add(`${fact.fact_id}:${intent}`);
      }
    }
  }

  return {
    facts: reasons.length === 0 ? parsed.data : [],
    capacity: reasons.length === 0 && opportunities.size > 0 ? 40 : 0,
    reasons,
  };
}

export async function runQuizGenerate(params: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  user: User;
  questionCountOverride?: number;
}): Promise<QuizGenerateSuccess> {
  const { supabase, userId, studySetId, user, questionCountOverride } = params;

  const { data: studySet, error: studySetError } = await supabase
    .from("study_sets")
    .select("id, pipeline_stage, title")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) {
    throw new Error(studySetError.message);
  }
  if (!studySet) {
    throw new QuizGenerateValidationError("Study set not found.");
  }
  if (!isAtLeastPipelineStage(studySet.pipeline_stage, "canonical")) {
    throw new QuizGenerateValidationError(
      "Quiz generation requires pipeline_stage at least canonical.",
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("canonical_documents")
    .select("id, canonical_markdown, metadata")
    .eq("study_set_id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }
  if (!document) {
    throw new QuizGenerateValidationError("Canonical document not found.");
  }

  const canonicalMarkdown = document.canonical_markdown?.trim() ?? "";
  if (!canonicalMarkdown) {
    throw new QuizGenerateValidationError("canonical_markdown is empty.");
  }

  const metadata = (document.metadata ?? {}) as CanonicalMetadata;

  const { data: sections, error: sectionsError } = await supabase
    .from("canonical_sections")
    .select("ordinal, heading, body_markdown, section_key")
    .eq("canonical_document_id", document.id)
    .eq("user_id", userId)
    .order("ordinal", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const readiness = metadata.source_readiness;
  const factArtifact = validateAtomicFactArtifact({
    rawFacts: metadata.atomic_facts ?? [],
    canonicalMarkdown,
    sections: sections ?? [],
  });
  const atomicFacts = factArtifact.facts;
  const extractedQuestions = (metadata.extracted_questions ?? []).filter(
    (question): question is SourceQuestionInput => {
      const candidate = question as Partial<SourceQuestionInput>;
      return Boolean(
        candidate.question &&
        candidate.section_id &&
        Array.isArray(candidate.options),
      );
    },
  );
  const hasSourceQuestions = extractedQuestions.length > 0;
  const maxSupportedCount =
    atomicFacts.length > 0 || hasSourceQuestions ? 40 : factArtifact.capacity;

  if (
    (!readiness?.pass && !hasSourceQuestions) ||
    (atomicFacts.length === 0 && !hasSourceQuestions) ||
    maxSupportedCount < 1 ||
    (factArtifact.reasons.length > 0 && !hasSourceQuestions)
  ) {
    const reasons = [
      ...(readiness?.reasons ?? ["Atomic facts are missing."]),
      ...factArtifact.reasons,
    ].join("; ");
    throw new QuizGenerateError(
      `Source is not ready for grounded quiz generation: ${reasons} Re-run canonicalization to build or repair atomic facts.`,
      422,
      "SOURCE_NOT_READY",
      { reason: reasons, maxSupportedCount },
    );
  }
  if (
    questionCountOverride !== undefined &&
    questionCountOverride > maxSupportedCount
  ) {
    throw new QuizGenerateError(
      `Source supports at most ${maxSupportedCount} distinct grounded questions; requested ${questionCountOverride}.`,
      422,
      "SOURCE_CAPACITY_INSUFFICIENT",
      {
        requestedCount: questionCountOverride,
        maxSupportedCount,
        reason: "requested_count_exceeds_validated_fact_opportunities",
      },
    );
  }

  const { markdown: truncatedMarkdown } =
    truncateCanonicalMarkdown(canonicalMarkdown);

  const quizSectionKeys = (sections ?? []).map((s) => s.section_key);
  const targetCount =
    questionCountOverride ??
    Math.min(
      Math.max(
        extractedQuestions.length,
        metadata.max_supported_count ?? atomicFacts.length,
        1,
      ),
      40,
    );
  const startedAt = Date.now();
  const generationWarnings: string[] = [];
  let resolvedSourceQuestions: ResolvedSourceQuestion[] = [];
  const answeredSourceOnly = buildQuestionCandidates({
    facts: atomicFacts,
    extractedQuestions,
    modelOutput: null,
    targetCount,
    fillDeterministically: false,
  });
  if (
    answeredSourceOnly.questions.length < targetCount &&
    extractedQuestions.length > 0 &&
    isAiProcessingConfigured()
  ) {
    try {
      const resolved = await resolveSourceQuestions({
        questions: extractedQuestions.slice(0, targetCount),
        user,
        deadlineAt: startedAt + QUIZ_AI_TOTAL_BUDGET_MS,
        language: metadata.language ?? "en",
      });
      resolvedSourceQuestions = resolved.questions;
      generationWarnings.push(...resolved.warnings);
    } catch (error) {
      generationWarnings.push(
        `Source-question resolution failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
  const sourceOnly = buildQuestionCandidates({
    facts: atomicFacts,
    extractedQuestions,
    resolvedSourceQuestions,
    modelOutput: null,
    targetCount,
    fillDeterministically: false,
  });

  let modelOutput: QuizModelOutput | null = null;
  if (
    sourceOnly.questions.length < targetCount &&
    isAiProcessingConfigured()
  ) {
    try {
      modelOutput = await callQuizGenerator({
        studySetId,
        title: studySet.title ?? "Study set",
        language: metadata.language ?? "en",
        canonicalMarkdown: truncatedMarkdown,
        sectionsJson: JSON.stringify(sections ?? []),
        extractedQuestionsJson: JSON.stringify(extractedQuestions),
        atomicFactsJson: JSON.stringify(atomicFacts),
        maxSupportedCount: String(maxSupportedCount),
        requestedCount: String(targetCount),
        user,
        startedAt,
      });
    } catch (error) {
      generationWarnings.push(
        error instanceof Error
          ? `AI quiz generation failed; deterministic fill used: ${error.message}`
          : "AI quiz generation failed; deterministic fill used.",
      );
    }
  } else if (sourceOnly.questions.length < targetCount) {
    generationWarnings.push(
      "AI is not configured; deterministic quiz builder used.",
    );
  }

  const candidates = buildQuestionCandidates({
    facts: atomicFacts,
    extractedQuestions,
    resolvedSourceQuestions,
    modelOutput,
    targetCount,
  });
  const questions = candidates.questions.slice(0, targetCount);
  const generatedCount = questions.length;
  const recommendedCount = targetCount;
  if (generatedCount !== targetCount) {
    throw new QuizGenerateError(
      `Could not build ${targetCount} grounded questions from the accepted facts.`,
      422,
      "INSUFFICIENT_VALID_QUESTIONS",
      {
        requestedCount: targetCount,
        acceptedCount: generatedCount,
        missingCount: targetCount - generatedCount,
        reason: "deterministic_fill_exhausted",
        rejectionSummary: JSON.stringify(candidates.rejectionSummary),
        warnings: generationWarnings.join(" | "),
      },
    );
  }

  const concepts = [...new Map(questions.map((question) => [
    question.concept_id,
    {
      concept_id: question.concept_id,
      label: question.answer_text,
      section_key: question.section_key,
      importance: "medium" as const,
    },
  ])).values()];
  const acceptedOutput: QuizGeneratorOutput = {
    recommended_count: recommendedCount,
    concepts,
    questions,
    warnings: [
      ...new Set([
        ...generationWarnings,
        ...candidates.warnings,
      ]),
    ],
  };

  // Post-LLM faithfulness checks run only on the accepted batch.
  const quizInput = {
    canonical_markdown: truncatedMarkdown,
    concepts: acceptedOutput.concepts,
    questions,
    validSectionKeys: quizSectionKeys,
  };
  const quizResult = checkQuiz(quizInput);
  if (quizResult.warnings.length > 0) {
    for (const warning of quizResult.warnings) {
      console.warn(`[quiz faithfulness] ${warning}`);
    }
  }

  const promptVersion = QUIZ_PROMPT_VERSION || "1.0";
  const rows = mapQuizOutputToRows(questions, {
    userId,
    studySetId,
    promptVersion,
  });

  const persistedCount = await replaceQuizWithRetry(supabase, {
    studySetId,
    expectedCount: targetCount,
    rows,
  });
  if (persistedCount !== targetCount) {
    throw new QuizGenerateError(
      `Expected to persist ${targetCount} questions; persisted ${String(persistedCount)}.`,
      500,
      "PERSISTED_COUNT_MISMATCH",
      {
        requestedCount: targetCount,
        persistedCount:
          typeof persistedCount === "number" ? persistedCount : -1,
      },
    );
  }

  console.info("[quiz generation telemetry]", {
    requested_count: targetCount,
    raw_count: modelOutput?.questions.length ?? 0,
    evidence_valid_count: questions.length,
    rejection_summary: candidates.rejectionSummary,
    generation_mode: resolveGenerationMode(candidates.modes),
    fact_reuse_count:
      questions.length - new Set(questions.flatMap((question) => question.fact_ids)).size,
    selected_count: rows.length,
    persisted_count: persistedCount,
    max_supported_count: maxSupportedCount,
    answer_evidence_coverage:
      generatedCount === 0 ? 0 : questions.length / generatedCount,
    unsupported_answer_count: 0,
    concept_count: new Set(questions.map((question) => question.concept_id)).size,
  });

  return {
    ok: true,
    requestedCount: targetCount,
    recommendedCount,
    generatedCount,
    questionIds: rows.map((row) => row.id),
    generationMode: resolveGenerationMode(candidates.modes),
    factReuseCount:
      questions.length - new Set(questions.flatMap((question) => question.fact_ids)).size,
    warnings: acceptedOutput.warnings,
    rejectionSummary: candidates.rejectionSummary,
  };
}
