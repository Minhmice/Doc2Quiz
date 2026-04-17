/**
 * Phase 32 — draft MCQ extraction → deterministic repair → optional LLM validator.
 * Validator cache keys use distinct lanes (`text_*_validator`) vs draft (`text_*_mcq`).
 */

import { FatalParseError } from "@/lib/ai/errors";
import { parseJsonFromModelText } from "@/lib/ai/jsonFromModelText";
import {
  formatPromptKeyComponent,
  hashPromptIdentity,
  MCQ_VALIDATOR_SYSTEM_PROMPT,
  PROMPTS_BUNDLE_VERSION,
} from "@/lib/ai/prompts/mcqExtractionPrompts";
import { withRetries } from "@/lib/ai/pipelineStageRetry";
import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import { normalizeOpenAiChatCompletionsUrl } from "@/lib/ai/openAiEndpoint";
import { sha256Utf8Hex } from "@/lib/db/parseCacheDb";
import type { Question } from "@/types/question";

const OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_CHAT_URL =
  "https://api.openai.com/v1/chat/completions";

/** Stable codes for pipeline logs / toast gating (Phase 32). */
export type ValidatorReasonCode =
  | "schema_repaired"
  | "deterministic_ok"
  | "needs_llm"
  | "llm_ok"
  | "llm_failed_fallback";

/**
 * Policy: re-run `validateQuestionsFromJson` with `preserveIds` so malformed draft
 * rows are dropped (never coerced into fake options). Empty stem/options → dropped.
 */
export function deterministicRepairDraftQuestions(questions: Question[]): {
  questions: Question[];
  reasons: ValidatorReasonCode[];
} {
  const reasons: ValidatorReasonCode[] = [];
  const before = questions.length;
  const validated = validateQuestionsFromJson(
    { questions },
    { preserveIds: true },
  );
  if (validated.length < before) {
    reasons.push("schema_repaired");
  }
  if (validated.length > 0) {
    reasons.push("deterministic_ok");
  }
  return { questions: validated, reasons };
}

/** When true, run the validator LLM on the repaired draft (Phase 32 — user accepts token cost). */
export function needsValidatorLlm(repaired: Question[]): boolean {
  return repaired.length > 0;
}

/**
 * Fingerprint for validator cache: chunk text + normalized question bodies so draft and
 * validator keys never alias (DRAFT-32-06).
 */
export async function buildValidatorContentFingerprint(
  chunkText: string,
  questions: Question[],
): Promise<string> {
  const chunkFp = await sha256Utf8Hex(chunkText);
  const normalized = JSON.stringify(
    questions.map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
    })),
  );
  const qFp = await sha256Utf8Hex(normalized);
  return sha256Utf8Hex(`${chunkFp}|${qFp}`);
}

function resolveOpenAiCompatEndpointAndModel(
  apiUrl: string | undefined,
  model: string | undefined,
): { endpoint: string; modelId: string; forwardProvider: "openai" | "custom" } {
  const t = (apiUrl ?? "").trim();
  const forwardProvider = t ? "custom" : "openai";
  const endpoint =
    forwardProvider === "openai"
      ? DEFAULT_OPENAI_CHAT_URL
      : normalizeOpenAiChatCompletionsUrl(t);
  const modelId =
    forwardProvider === "custom"
      ? (() => {
          const m = (model ?? "").trim();
          if (!m) {
            throw new FatalParseError(
              "Enter a model id for your API base URL.",
            );
          }
          return m;
        })()
      : (model ?? "").trim() || OPENAI_MODEL;
  return { endpoint, modelId, forwardProvider };
}

const CHUNK_CONTEXT_MAX = 12_000;

function buildValidatorUserMessage(
  chunkText: string,
  draftQuestions: Question[],
): string {
  const excerpt =
    chunkText.length > CHUNK_CONTEXT_MAX
      ? `${chunkText.slice(0, CHUNK_CONTEXT_MAX)}\n… [truncated]`
      : chunkText;
  return [
    "Document excerpt (for grounding only; do not invent content beyond the draft):",
    "---",
    excerpt,
    "---",
    "",
    "Draft MCQs as JSON. Validate and fix; respond with JSON only: { \"questions\": [...] }",
    JSON.stringify({ questions: draftQuestions }),
  ].join("\n");
}

/**
 * LLM validator pass — OpenAI-compatible chat completions, same-origin forward.
 */
export async function runValidatorLlmPass(options: {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  chunkText: string;
  draftQuestions: Question[];
  signal: AbortSignal;
  onRawAssistantText?: (text: string) => void;
}): Promise<Question[]> {
  const { apiKey, apiUrl, model, chunkText, draftQuestions, signal, onRawAssistantText } =
    options;
  const { endpoint, modelId, forwardProvider } =
    resolveOpenAiCompatEndpointAndModel(apiUrl, model);

  const userContent = buildValidatorUserMessage(chunkText, draftQuestions);

  const res = await forwardAiPost({
    provider: forwardProvider,
    targetUrl: endpoint,
    apiKey,
    signal,
    body: {
      model: modelId,
      messages: [
        { role: "system", content: MCQ_VALIDATOR_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      stream: false,
    },
  });

  const text = await res.text();

  if (res.status === 401) {
    throw new FatalParseError(
      "Invalid API key. Please check and try again.",
    );
  }
  if (res.status === 429) {
    throw new FatalParseError(
      "Too many requests. Please wait and try again.",
    );
  }
  if (!res.ok) {
    const proxyMsg =
      res.status === 502 ? parseProxyForwardErrorBody(text) : null;
    if (proxyMsg) {
      throw new Error(proxyMsg);
    }
    throw new Error(describeBadAiResponse(res.status, text));
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error(
        "API returned HTML instead of JSON — check the chat-completions URL.",
      );
    }
    throw new Error("Invalid JSON from chat API");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty OpenAI message content");
  }

  onRawAssistantText?.(content);
  const parsed = parseJsonFromModelText(content);
  return validateQuestionsFromJson(parsed, { preserveIds: true });
}

export async function runValidatorLlmPassWithRetries(
  options: Parameters<typeof runValidatorLlmPass>[0],
): Promise<Question[]> {
  return withRetries("llm_validator", options.signal, async () =>
    runValidatorLlmPass(options),
  );
}

export async function validatorPromptIdentity(): Promise<string> {
  return formatPromptKeyComponent(
    PROMPTS_BUNDLE_VERSION,
    await hashPromptIdentity(MCQ_VALIDATOR_SYSTEM_PROMPT),
  );
}
