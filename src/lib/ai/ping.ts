/** Client-safe shape returned by GET /api/ai/ping */
export type AiAgentPingResponse = {
  ok: boolean;
  configured: boolean;
  latencyMs?: number;
  model?: string;
  text?: string;
  error?: string;
  status?: number;
};

/**
 * Calls the app API to verify the server can reach the configured AI provider.
 * Requires an authenticated session (cookies).
 */
export async function pingAiAgent(): Promise<AiAgentPingResponse> {
  try {
    const res = await fetch("/api/ai/ping", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const body = (await res.json().catch(() => ({}))) as Partial<AiAgentPingResponse>;

    return {
      ok: res.ok && body.ok === true,
      configured: body.configured === true,
      latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      text: typeof body.text === "string" ? body.text : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
      status: typeof body.status === "number" ? body.status : undefined,
    };
  } catch {
    return {
      ok: false,
      configured: false,
      error: "network_error",
    };
  }
}

/** Convenience check for UI gates and dev tooling. */
export function isAiAgentHealthy(result: AiAgentPingResponse): boolean {
  return result.ok && result.configured;
}

export function formatAiAgentPingMessage(result: AiAgentPingResponse): string {
  if (result.ok) {
    const latency =
      typeof result.latencyMs === "number" ? ` (${result.latencyMs}ms)` : "";
    const model = result.model ? ` · ${result.model}` : "";
    return `AI agent OK${latency}${model}`;
  }

  if (result.error === "network_error") {
    return "Could not reach the app API. Check your connection.";
  }

  if (!result.configured) {
    return "AI is not configured on the server (missing URL or API key).";
  }

  return result.error ?? "AI agent ping failed.";
}
