import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { stripJsonFence } from "@/lib/pipeline/canonicalize";
import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { getAiProcessingConfig } from "@/lib/server/ai-processing-config";
import { formatUpstreamAiError } from "@/lib/server/formatUpstreamAiError";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import { resolveUserAiTier } from "@/lib/server/resolveUserAiTier";

const resolvedQuestionSchema = z.object({
  source_question_index: z.number().int().min(0),
  answer_text: z.string().min(1),
  choices: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  correct_index: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1),
});

const resolverOutputSchema = z.object({
  questions: z.array(resolvedQuestionSchema),
  warnings: z.array(z.string()).default([]),
});

export type SourceQuestionInput = {
  question: string;
  options: string[];
  answer: string | null;
  section_id: string;
};

export type ResolutionEvidence = {
  id: string;
  title: string;
  url: string;
  snippet: string;
};

export type ResolvedSourceQuestion = SourceQuestionInput & {
  sourceQuestionIndex: number;
  answerText: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  confidence: "high" | "medium" | "low";
  rationale: string;
  basis: "model_knowledge" | "source_answer";
  evidence: ResolutionEvidence[];
};

function compact(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function normalize(value: string): string {
  return compact(value).toLocaleLowerCase();
}

function parseResolverOutput(text: string) {
  try {
    return resolverOutputSchema.safeParse(JSON.parse(stripJsonFence(text)));
  } catch {
    return resolverOutputSchema.safeParse(null);
  }
}

function resolverContentIssue(
  output: z.infer<typeof resolverOutputSchema>,
  sources: SourceQuestionInput[],
): string | null {
  const seen = new Set<number>();
  const issues: string[] = [];
  for (const item of output.questions) {
    if (!sources[item.source_question_index]) {
      issues.push(`unknown index ${item.source_question_index}`);
      continue;
    }
    if (seen.has(item.source_question_index)) {
      issues.push(`duplicate index ${item.source_question_index}`);
    }
    seen.add(item.source_question_index);
    const answer = compact(sources[item.source_question_index].answer ?? item.answer_text);
    const choices = item.choices.map(compact);
    choices[item.correct_index] = answer;
    const normalizedAnswer = normalize(answer);
    if (
      new Set(choices.map(normalize)).size !== 4 ||
      choices.some((choice, index) =>
        index !== item.correct_index &&
        (normalize(choice).includes(normalizedAnswer) || normalizedAnswer.includes(normalize(choice)))
      )
    ) {
      issues.push(`invalid choices at index ${item.source_question_index}`);
    }
  }
  for (let index = 0; index < sources.length; index += 1) {
    if (!seen.has(index)) issues.push(`missing index ${index}`);
  }
  return issues.length > 0 ? issues.join("; ") : null;
}

function buildMessages(
  questions: SourceQuestionInput[],
  language: string,
  validationError?: string,
) {
  const payload = questions.map((question, index) => ({
    source_question_index: index,
    question: question.question,
    recovered_options: question.options,
    known_answer: question.answer,
  }));
  return [
    {
      role: "system" as const,
      content: [
        "Resolve source multiple-choice questions. Return JSON only.",
        `Source language: ${language}. Keep questions, choices, and rationale in that language. Do not translate.`,
        "Understand the full question context and preserve normal exam-style meaning. Never create meta-questions about position, occurrence, or the source document.",
        "For known_answer, preserve it. Otherwise answer using only this model's internal knowledge.",
        "Return every source_question_index exactly once.",
        "Each item needs answer_text, exactly four plausible topic-related choices, correct_index, confidence, rationale.",
        "If uncertain, set confidence low and use simple low-inference distractors. Never claim web verification or citations.",
        "Distractors must be false, distinct, and must not contain answer_text.",
        "Schema: {questions:[{source_question_index,answer_text,choices:[string,string,string,string],correct_index:0|1|2|3,confidence:'high'|'medium'|'low',rationale}],warnings:string[]}.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: JSON.stringify({ questions: payload, validation_error: validationError }),
    },
  ];
}

export async function resolveSourceQuestions(params: {
  questions: SourceQuestionInput[];
  user: User;
  deadlineAt: number;
  language?: string;
}): Promise<{ questions: ResolvedSourceQuestion[]; warnings: string[] }> {
  if (params.questions.length === 0) return { questions: [], warnings: [] };
  const warnings: string[] = [];

  const aiConfig = getAiProcessingConfig(resolveUserAiTier(params.user));
  const call = async (validationError?: string) => {
    const remaining = params.deadlineAt - Date.now();
    if (remaining <= 0) throw new Error("Source-question resolver budget exhausted.");
    return postChatCompletionAssistantText({
      configUrl: aiConfig.url,
      apiKey: aiConfig.key,
      model: aiConfig.model,
      messages: buildMessages(params.questions, params.language ?? "en", validationError),
      responseFormatJsonObject: true,
      temperature: 0,
      signal: AbortSignal.timeout(Math.max(1, Math.min(90_000, remaining))),
    });
  };

  let response = await call();
  if (!response.ok) throw new Error(formatUpstreamAiError(response.status, response.body));
  let parsed = parseResolverOutput(response.text);
  let validationError = parsed.success
    ? resolverContentIssue(parsed.data, params.questions)
    : summarizeZodError(parsed.error);
  if (validationError) {
    response = await call(validationError);
    if (!response.ok) throw new Error(formatUpstreamAiError(response.status, response.body));
    parsed = parseResolverOutput(response.text);
  }
  if (!parsed.success) {
    throw new Error(`Source-question resolver output invalid: ${summarizeZodError(parsed.error)}`);
  }
  validationError = resolverContentIssue(parsed.data, params.questions);
  if (validationError) {
    throw new Error(`Source-question resolver remained incomplete after repair: ${validationError}`);
  }

  const resolved: ResolvedSourceQuestion[] = [];
  const seen = new Set<number>();
  for (const item of parsed.data.questions) {
    const source = params.questions[item.source_question_index];
    if (!source || seen.has(item.source_question_index)) continue;
    const answerText = compact(source.answer ?? item.answer_text);
    const choices = item.choices.map(compact) as [string, string, string, string];
    choices[item.correct_index] = answerText;
    const normalizedAnswer = normalize(answerText);
    if (
      new Set(choices.map(normalize)).size !== 4 ||
      choices.some((choice, index) =>
        index !== item.correct_index &&
        (normalize(choice).includes(normalizedAnswer) || normalizedAnswer.includes(normalize(choice)))
      )
    ) {
      warnings.push(`Rejected invalid distractors for source question ${item.source_question_index + 1}.`);
      continue;
    }
    const basis = source.answer
      ? "source_answer"
      : "model_knowledge";
    resolved.push({
      ...source,
      sourceQuestionIndex: item.source_question_index,
      answerText,
      choices,
      correctIndex: item.correct_index,
      confidence: basis === "model_knowledge" && item.confidence === "high"
        ? "medium"
        : item.confidence,
      rationale: compact(item.rationale),
      basis,
      evidence: [],
    });
    seen.add(item.source_question_index);
  }
  const modelKnowledgeCount = resolved.filter(
    (question) => question.basis === "model_knowledge",
  ).length;
  const lowConfidenceCount = resolved.filter(
    (question) => question.confidence === "low",
  ).length;
  if (modelKnowledgeCount > 0) {
    warnings.push(
      `${modelKnowledgeCount} source answers rely on the configured model's internal knowledge; no web verification was performed.`,
    );
  }
  if (lowConfidenceCount > 0) {
    warnings.push(`${lowConfidenceCount} source answers have low confidence.`);
  }
  return { questions: resolved, warnings: [...warnings, ...parsed.data.warnings] };
}
