import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import {
  resolveChatApiUrl,
  resolveModelId,
} from "@/lib/ai/parseChunk";
import {
  getKeyForProvider,
  getModelForProvider,
  getProvider,
  getUrlForProvider,
} from "@/lib/ai/storage";
import type { AiProvider } from "@/types/question";

export type StudySetTitleResult = {
  title: string;
  subtitle?: string;
};

const SYSTEM_PROMPT = `You help name study materials. Reply with a single JSON object only (no markdown) with:
- "title": short human-readable name for the study set (max 70 characters). Prefer subject, topic, exam period if visible.
- "subtitle": optional extra line (max 100 characters), e.g. school name, province, or "HK1 2025–2026". Use empty string or omit if unknown.

Example: {"title":"Đề kiểm tra Toán 10 (HK1 2025–2026)","subtitle":"Trường THPT Phú Lộc - Huế"}`;

function parseTitleJson(text: string): StudySetTitleResult | null {
  const trimmed = text.trim();
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const o = JSON.parse(fenceStripped) as Record<string, unknown>;
    const title =
      typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
    if (!title) {
      return null;
    }
    const subtitleRaw = o.subtitle;
    const subtitle =
      typeof subtitleRaw === "string" && subtitleRaw.trim().length > 0
        ? subtitleRaw.trim().slice(0, 120)
        : undefined;
    return { title, subtitle };
  } catch {
    return null;
  }
}

async function openAiStyleTitle(
  provider: Extract<AiProvider, "openai" | "custom">,
  apiKey: string,
  endpoint: string,
  model: string,
  userContent: string,
  signal: AbortSignal | undefined,
): Promise<StudySetTitleResult | null> {
  const res = await forwardAiPost({
    provider: provider === "custom" ? "custom" : "openai",
    targetUrl: endpoint,
    apiKey,
    signal,
    body: {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 220,
      stream: false,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    const proxyMsg = res.status === 502 ? parseProxyForwardErrorBody(text) : null;
    if (proxyMsg) {
      throw new Error(proxyMsg);
    }
    throw new Error(describeBadAiResponse(res.status, text));
  }
  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error("API returned HTML instead of JSON");
    }
    throw new Error("Invalid JSON from chat API");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }
  return parseTitleJson(content);
}

/**
 * Uses configured AI provider to suggest title + optional subtitle from PDF text.
 * Falls back to filename-based title when no key, short text, or errors.
 */
export async function generateStudySetTitle(
  extractedText: string,
  fileName: string,
  signal?: AbortSignal,
): Promise<StudySetTitleResult> {
  const fallbackTitle =
    fileName.replace(/\.pdf$/i, "").trim() || "Untitled study set";

  const excerpt = extractedText.trim().slice(0, 2500);
  if (excerpt.length < 40) {
    return { title: fallbackTitle };
  }

  const provider = getProvider();
  const apiKey = getKeyForProvider(provider).trim();
  if (!apiKey) {
    return { title: fallbackTitle };
  }

  const userContent = `Document excerpt:\n\n---\n${excerpt}\n---`;

  try {
    const endpoint = resolveChatApiUrl(provider, getUrlForProvider(provider));
    const model = resolveModelId(provider, getModelForProvider(provider));

    const parsed = await openAiStyleTitle(
      provider === "custom" ? "custom" : "openai",
      apiKey,
      endpoint,
      model,
      userContent,
      signal,
    );

    if (parsed?.title) {
      return parsed;
    }
  } catch {
    /* use fallback */
  }

  return { title: fallbackTitle };
}
