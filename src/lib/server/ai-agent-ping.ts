import {
  getAiProcessingConfig,
  isAiProcessingConfigured,
  type UserAiTier,
} from "@/lib/server/ai-processing-config";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";

export type AiAgentPingResult = {
  ok: boolean;
  configured: boolean;
  latencyMs?: number;
  model?: string;
  text?: string;
  error?: string;
  status?: number;
};

export type RunAiAgentPingOptions = {
  tier?: UserAiTier;
};

/**
 * Server-only: sends a minimal chat completion to verify AI provider connectivity.
 */
export async function runAiAgentPing(
  options: RunAiAgentPingOptions = {},
): Promise<AiAgentPingResult> {
  const tier = options.tier ?? "free";

  if (!isAiProcessingConfigured()) {
    return { ok: false, configured: false, error: "ai_not_configured" };
  }

  const start = Date.now();
  let config: ReturnType<typeof getAiProcessingConfig>;
  try {
    config = getAiProcessingConfig(tier);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config_error";
    return { ok: false, configured: false, error: msg };
  }

  const result = await postChatCompletionAssistantText({
    configUrl: config.url,
    apiKey: config.key,
    model: config.model,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    temperature: 0,
    max_tokens: 8,
  });

  const latencyMs = Date.now() - start;

  if (result.ok) {
    return {
      ok: true,
      configured: true,
      latencyMs,
      model: config.model,
      text: result.text,
    };
  }

  return {
    ok: false,
    configured: true,
    latencyMs,
    model: config.model,
    status: result.status,
    error: result.body.slice(0, 500),
  };
}

export function aiAgentPingHttpStatus(result: AiAgentPingResult): number {
  if (result.ok) {
    return 200;
  }
  if (!result.configured) {
    return 503;
  }
  if (result.status === 401 || result.status === 403) {
    return 502;
  }
  return 503;
}
