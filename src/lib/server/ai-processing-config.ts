import {
  normalizeOpenAiChatCompletionsUrl,
  resolveEmbeddingsTargetUrl,
} from "@/lib/ai/openAiEndpoint";

/**
 * Server-only document/LLM processing configuration (env). Never import in client components.
 */
export type UserAiTier = "free" | "pro";

export type AiProcessingConfig = {
  url: string;
  key: string;
  modelFree: string;
  modelPro: string;
};

const DEFAULT_MODEL_FREE = "mineru25";
const DEFAULT_MODEL_PRO = "gpt-4.1-mini";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Optional embedding model for `/v1/embeddings` (OpenAI-compatible).
 * Defaults to a standard OpenAI embedding id when unset.
 */
export function getServerEmbeddingModel(): string {
  const m = trimEnv("AI_EMBEDDING_MODEL");
  return m || DEFAULT_EMBEDDING_MODEL;
}

export function getDocProcessingMode(): string {
  return trimEnv("DOC_PROCESSING_MODE") || "auto";
}

export function isDevEnginePanelEnabled(): boolean {
  return trimEnv("ENABLE_DEV_ENGINE_PANEL") === "true";
}

function readRawConfig(): AiProcessingConfig | null {
  const url = trimEnv("AI_PROVIDER_URL");
  const key = trimEnv("AI_PROVIDER_KEY");
  if (!url || !key) {
    return null;
  }
  return {
    url,
    key,
    modelFree: trimEnv("AI_MODEL_FREE") || DEFAULT_MODEL_FREE,
    modelPro: trimEnv("AI_MODEL_PRO") || DEFAULT_MODEL_PRO,
  };
}

/** True when URL and key are both non-empty. */
export function isAiProcessingConfigured(): boolean {
  return readRawConfig() !== null;
}

export function resolveAiModel(tier: UserAiTier): string {
  const raw = readRawConfig();
  if (!raw) {
    return tier === "free" ? DEFAULT_MODEL_FREE : DEFAULT_MODEL_PRO;
  }
  return tier === "free" ? raw.modelFree : raw.modelPro;
}

export function getAiProcessingConfig(tier: UserAiTier): {
  url: string;
  key: string;
  model: string;
  tier: UserAiTier;
} {
  const raw = readRawConfig();
  if (!raw) {
    throw new Error("AI processing is not configured");
  }
  return {
    url: raw.url,
    key: raw.key,
    model: resolveAiModel(tier),
    tier,
  };
}

export function getChatCompletionsUrl(configUrl: string): string {
  return normalizeOpenAiChatCompletionsUrl(configUrl);
}

export function getEmbeddingsUrl(configUrl: string): string {
  return resolveEmbeddingsTargetUrl(configUrl.trim() ? configUrl : undefined);
}
