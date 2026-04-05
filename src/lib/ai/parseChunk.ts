/**
 * Browser fetch to vendor APIs (no backend proxy).
 *
 * Models (defaults):
 * - OpenAI: gpt-4o-mini — POST https://api.openai.com/v1/chat/completions
 * - Anthropic: claude-3-5-haiku-20241022 — POST https://api.anthropic.com/v1/messages
 *   Header: anthropic-version: 2023-06-01
 */

import { FatalParseError } from "@/lib/ai/errors";
import { validateQuestionsFromJson } from "@/lib/ai/validateQuestions";
import type { AiProvider, Question } from "@/types/question";

const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const ANTHROPIC_MODEL = "claude-3-5-haiku-20241022";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You extract multiple-choice questions from the user's document excerpt.
Respond with JSON only. The top-level object must have a "questions" array.
Each element: { "question": string, "options": [string, string, string, string], "correctIndex": 0|1|2|3 }.
Use exactly four non-empty options. If there are no suitable MCQs, return { "questions": [] }.`;

export type ParseChunkOnceParams = {
  provider: AiProvider;
  apiKey: string;
  chunkText: string;
  signal: AbortSignal;
};

function parseJsonFromModelText(text: string): unknown {
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
  chunkText: string,
  signal: AbortSignal,
): Promise<Question[]> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: chunkText },
      ],
      response_format: { type: "json_object" },
    }),
  });

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
    throw new Error(`OpenAI request failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty OpenAI message content");
  }

  const parsed = parseJsonFromModelText(content);
  return validateQuestionsFromJson(parsed);
}

async function parseAnthropic(
  apiKey: string,
  chunkText: string,
  signal: AbortSignal,
): Promise<Question[]> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: chunkText }],
    }),
  });

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
    throw new Error(`Anthropic request failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const blocks = data.content;
  const textParts =
    blocks
      ?.filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string) ?? [];
  const joined = textParts.join("\n").trim();
  if (joined.length === 0) {
    throw new Error("Empty Anthropic message content");
  }

  const parsed = parseJsonFromModelText(joined);
  return validateQuestionsFromJson(parsed);
}

export async function parseChunkOnce(
  params: ParseChunkOnceParams,
): Promise<Question[]> {
  const { provider, apiKey, chunkText, signal } = params;
  if (provider === "openai") {
    return parseOpenAI(apiKey, chunkText, signal);
  }
  return parseAnthropic(apiKey, chunkText, signal);
}
