/**
 * OpenAI-compatible text embeddings (same-origin `/api/ai/embed`).
 */

import {
  forwardEmbeddingPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import { resolveEmbeddingsTargetUrl } from "@/lib/ai/openAiEndpoint";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";

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
  apiKey: string;
  forwardBaseUrl: string;
  text: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<{ vector: number[]; dimensions: number; model: string }> {
  const model =
    (params.model ?? DEFAULT_EMBEDDING_MODEL).trim() || DEFAULT_EMBEDDING_MODEL;
  const targetUrl = resolveEmbeddingsTargetUrl(params.forwardBaseUrl);
  const res = await forwardEmbeddingPost({
    apiKey: params.apiKey,
    targetUrl,
    body: { model, input: params.text },
    signal: params.signal,
  });
  const text = await res.text();
  if (res.status === 401) {
    throw new Error("Invalid API key. Please check and try again.");
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
  return { vector, dimensions: vector.length, model };
}
