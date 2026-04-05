import type { AiProvider } from "@/types/question";

/** JSON body from `/api/ai/forward` when upstream fetch throws (502). */
export function parseProxyForwardErrorBody(text: string): string | null {
  try {
    const j = JSON.parse(text) as { error?: unknown };
    if (typeof j.error === "string" && j.error.length > 0) {
      return j.error;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type ForwardAiPostParams = {
  provider: AiProvider;
  targetUrl: string;
  apiKey: string;
  body: unknown;
  signal?: AbortSignal;
};

/**
 * Browser-only: POST through Next.js `/api/ai/forward` so the real request runs
 * server-side (avoids vendor CORS blocks on direct browser → OpenAI/Anthropic).
 */
export async function forwardAiPost(
  params: ForwardAiPostParams,
): Promise<Response> {
  const { provider, targetUrl, apiKey, body, signal } = params;
  return fetch("/api/ai/forward", {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      targetUrl,
      apiKey,
      body,
    }),
  });
}
