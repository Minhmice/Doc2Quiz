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

/**
 * Browser-only: POST through Next.js `/api/ai/forward`. Upstream URL, key, and model
 * are applied server-side from environment variables.
 */
export async function forwardAiPost(params: {
  body: unknown;
  signal?: AbortSignal;
  method?: "GET" | "POST";
}): Promise<Response> {
  const { body, signal, method } = params;
  return fetch("/api/ai/forward", {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body,
      method: method ?? "POST",
    }),
  });
}

/** Same-origin proxy GET (e.g. OpenAI-compatible `/v1/models`) — server resolves URL. */
export async function forwardAiGet(params: {
  signal?: AbortSignal;
}): Promise<Response> {
  const { signal } = params;
  return fetch("/api/ai/forward", {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "GET",
    }),
  });
}

/** OpenAI-compatible embeddings via `POST /api/ai/embed`. */
export async function forwardEmbeddingPost(params: {
  body: { input: string | string[] | number[][] };
  signal?: AbortSignal;
}): Promise<Response> {
  const { body, signal } = params;
  return fetch("/api/ai/embed", {
    method: "POST",
    ...(signal ? { signal } : {}),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body,
    }),
  });
}
