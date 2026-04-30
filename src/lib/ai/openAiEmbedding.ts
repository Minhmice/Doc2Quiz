/**
 * OpenAI-compatible text embeddings (same-origin `/api/ai/embed`).
 */

import {
  forwardEmbeddingPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";

/** Opaque key stored in local index rows — not the upstream vendor model id. */
export const EMBEDDING_INDEX_MODEL_KEY = "doc2quiz-embed-v1";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export function parseOpenAiEmbeddingResponse(text: string): number[] {
  let data: { data?: Array<{ embedding?: number[] }> };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error("API returned HTML instead of JSON");
    }
    throw new Error("Invalid JSON from embeddings API");
  }
  const emb = data.data?.[0]?.embedding;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error("Empty embedding in API response");
  }
  return emb.map((x) => (typeof x === "number" ? x : 0));
}

export async function embedText(params: {
  text: string;
  signal?: AbortSignal;
}): Promise<{ vector: number[]; dimensions: number; model: string }> {
  const res = await forwardEmbeddingPost({
    body: { input: params.text },
    signal: params.signal,
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 503) {
    throw new Error(AI_PROCESSING_UNAVAILABLE_MESSAGE);
  }
  if (res.status === 429) {
    throw new Error("Too many requests. Please wait and try again.");
  }
  if (!res.ok) {
    const proxyMsg =
      res.status === 502 ? parseProxyForwardErrorBody(text) : null;
    if (proxyMsg) {
      throw new Error(proxyMsg);
    }
    throw new Error(describeBadAiResponse(res.status, text));
  }
  const vector = parseOpenAiEmbeddingResponse(text);
  return {
    vector,
    dimensions: vector.length,
    model: EMBEDDING_INDEX_MODEL_KEY,
  };
}
