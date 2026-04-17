/**
 * AI calls go through `POST /api/ai/forward` (same-origin) so the real HTTPS
 * request runs on the server and avoids vendor CORS blocking browser fetch.
 *
 * Chunk + single-MCQ parse use **OpenAI-compatible** chat completions only
 * (Phase 19). `provider` on `ParseChunkOnceParams` is legacy; routing uses URL/model.
 */

import { FatalParseError } from "@/lib/ai/errors";
import { withRetries } from "@/lib/ai/pipelineStageRetry";
import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { normalizeOpenAiChatCompletionsUrl } from "@/lib/ai/openAiEndpoint";
import {
  formatPromptKeyComponent,
  hashPromptIdentity,
  MCQ_EXTRACTION_SYSTEM_PROMPT,
  MCQ_SINGLE_CHUNK_SYSTEM_PROMPT,
  PROMPTS_BUNDLE_VERSION,
} from "@/lib/ai/prompts/mcqExtractionPrompts";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import {
  canonicalParseCacheKey,
  parseCacheGetTextChunk,
  parseCacheSetTextChunk,
  sha256Utf8Hex,
} from "@/lib/db/parseCacheDb";
import type { AiProvider, Question } from "@/types/question";

export { MCQ_EXTRACTION_SYSTEM_PROMPT, MCQ_SINGLE_CHUNK_SYSTEM_PROMPT };

export const OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_OPENAI_CHAT_URL =
  "https://api.openai.com/v1/chat/completions";

export const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";
export const DEFAULT_ANTHROPIC_MESSAGES_URL =
  "https://api.anthropic.com/v1/messages";

export function questionsFromAssistantContent(content: string): Question[] {
  const parsed = parseJsonFromModelText(content);
  return validateQuestionsFromJson(parsed);
}

/** Accept flat `{ question, options, correctIndex }` or legacy `{ questions: [...] }` for single-chunk prompts. */
function normalizeSingleChunkModelJson(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") {
    return { questions: [] };
  }
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.questions)) {
    return raw;
  }
  if (typeof o.question === "string" && Array.isArray(o.options)) {
    return { questions: [raw] };
  }
  return { questions: [] };
}

function singleMcqQuestionsFromAssistantContent(content: string): Question[] {
  const parsed = parseJsonFromModelText(content);
  return validateQuestionsFromJson(normalizeSingleChunkModelJson(parsed));
}

export type ParseChunkOnceParams = {
  provider: AiProvider;
  apiKey: string;
  /** Full endpoint URL; empty uses vendor default except Custom (required). */
  apiUrl?: string;
  /** Model id; empty uses built-in default for OpenAI/Anthropic; required for Custom. */
  model?: string;
  chunkText: string;
  signal: AbortSignal;
  /** Session / debug only — never persisted to IDB. */
  onRawAssistantText?: (text: string) => void;
  /** Optional; recorded in parse-cache metadata only (not part of the key). */
  studySetId?: string;
};

function cloneQuestions(qs: Question[]): Question[] {
  return JSON.parse(JSON.stringify(qs)) as Question[];
}

export type ParseChunkOnceResult = {
  questions: Question[];
  cacheHit: boolean;
};

export function resolveChatApiUrl(
  provider: AiProvider,
  apiUrl: string | undefined,
): string {
  const t = (apiUrl ?? "").trim();
  if (t) {
    if (provider === "openai" || provider === "custom") {
      return normalizeOpenAiChatCompletionsUrl(t);
    }
    return t;
  }
  if (provider === "custom") {
    throw new FatalParseError(
      "Enter your API base URL (e.g. https://host/v1) or full …/chat/completions URL.",
    );
  }
  return provider === "openai"
    ? DEFAULT_OPENAI_CHAT_URL
    : DEFAULT_ANTHROPIC_MESSAGES_URL;
}

export function resolveModelId(
  provider: AiProvider,
  modelInput: string | undefined,
): string {
  const t = (modelInput ?? "").trim();
  if (provider === "custom") {
    if (!t) {
      throw new FatalParseError("Enter a model name for Custom API.");
    }
    return t;
  }
  if (t) {
    return t;
  }
  return provider === "openai" ? OPENAI_MODEL : ANTHROPIC_MODEL;
}

/** Exported for vision batch parsers (`parseVisionQuizResponse`, etc.). */
export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(fenceStripped);
  } catch {
    const start = fenceStripped.indexOf("{");
    if (start === -1) {
      throw new Error("No JSON object in model output");
    }
    let depth = 0;
    for (let i = start; i < fenceStripped.length; i++) {
      const c = fenceStripped[i];
      if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(fenceStripped.slice(start, i + 1));
        }
      }
    }
    throw new Error("Unbalanced JSON object in model output");
  }
}

async function parseOpenAI(
  apiKey: string,
  endpoint: string,
  model: string,
  chunkText: string,
  signal: AbortSignal,
  forwardProvider: "openai" | "custom",
  systemPrompt: string,
  extractQuestions: (content: string) => Question[] = questionsFromAssistantContent,
  onRawAssistantText?: (text: string) => void,
): Promise<Question[]> {
  const res = await forwardAiPost({
    provider: forwardProvider,
    targetUrl: endpoint,
    apiKey,
    signal,
    body: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chunkText },
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
  return extractQuestions(content);
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

export async function parseChunkOnce(
  params: ParseChunkOnceParams,
): Promise<ParseChunkOnceResult> {
  const { apiKey, apiUrl, model, chunkText, signal, onRawAssistantText, studySetId } =
    params;
  const { endpoint, modelId, forwardProvider } =
    resolveOpenAiCompatEndpointAndModel(apiUrl, model);

  if (onRawAssistantText) {
    const questions = await withRetries("llm_chunk", signal, async () =>
      parseOpenAI(
        apiKey,
        endpoint,
        modelId,
        chunkText,
        signal,
        forwardProvider,
        MCQ_EXTRACTION_SYSTEM_PROMPT,
        undefined,
        onRawAssistantText,
      ),
    );
    return { questions, cacheHit: false };
  }

  const contentFingerprint = await sha256Utf8Hex(chunkText);
  const promptIdentity = formatPromptKeyComponent(
    PROMPTS_BUNDLE_VERSION,
    await hashPromptIdentity(MCQ_EXTRACTION_SYSTEM_PROMPT),
  );
  const cacheKey = await canonicalParseCacheKey({
    lane: "text_multi_mcq",
    contentFingerprint,
    promptIdentity,
    model: modelId,
    forwardProvider,
  });

  const cached = await parseCacheGetTextChunk(cacheKey);
  if (cached) {
    return { questions: cloneQuestions(cached), cacheHit: true };
  }

  const questions = await withRetries("llm_chunk", signal, async () =>
    parseOpenAI(
      apiKey,
      endpoint,
      modelId,
      chunkText,
      signal,
      forwardProvider,
      MCQ_EXTRACTION_SYSTEM_PROMPT,
    ),
  );
  await parseCacheSetTextChunk(cacheKey, questions, studySetId);
  return { questions, cacheHit: false };
}

/**
 * Text-only: at most one MCQ from a small OCR chunk (OpenAI / Anthropic / custom).
 *
 * D-27: Per-chunk AI wall time is measured only in `runLayoutChunkParse` around each
 * injected `parse` call; do not add inner wall-clock timing here (avoids double-counting).
 */
export async function parseChunkSingleMcqOnce(
  params: ParseChunkOnceParams,
): Promise<Question | null> {
  const {
    apiKey,
    apiUrl,
    model,
    chunkText,
    signal,
    onRawAssistantText,
    studySetId,
  } = params;
  const { endpoint, modelId, forwardProvider } =
    resolveOpenAiCompatEndpointAndModel(apiUrl, model);

  const runForward = () =>
    withRetries("llm_chunk", signal, async () => {
      const qs = await parseOpenAI(
        apiKey,
        endpoint,
        modelId,
        chunkText,
        signal,
        forwardProvider,
        MCQ_SINGLE_CHUNK_SYSTEM_PROMPT,
        singleMcqQuestionsFromAssistantContent,
        onRawAssistantText,
      );
      if (qs.length === 0) {
        return null;
      }
      return qs[0] ?? null;
    });

  if (onRawAssistantText) {
    return runForward();
  }

  const contentFingerprint = await sha256Utf8Hex(chunkText);
  const promptIdentity = formatPromptKeyComponent(
    PROMPTS_BUNDLE_VERSION,
    await hashPromptIdentity(MCQ_SINGLE_CHUNK_SYSTEM_PROMPT),
  );
  const cacheKey = await canonicalParseCacheKey({
    lane: "text_single_mcq",
    contentFingerprint,
    promptIdentity,
    model: modelId,
    forwardProvider,
  });

  const cached = await parseCacheGetTextChunk(cacheKey);
  if (cached !== null && cached.length > 0) {
    return cloneQuestions(cached)[0] ?? null;
  }

  const q = await runForward();
  if (q) {
    await parseCacheSetTextChunk(cacheKey, [q], studySetId);
  }
  return q;
}
