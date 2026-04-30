/**
 * Phase 19 — single forward BYOK configuration (OpenAI-compatible chat + vision).
 *
 * **Migration (once, idempotent):** If `LS_FORWARD_MIGRATED_V1` is unset, copy legacy keys into the forward triple:
 * 1. **Custom** — when `LS_CUSTOM_URL` is non-empty after trim → use custom URL, key, model.
 * 2. Else **OpenAI** — when `LS_OPENAI_KEY` or `LS_OPENAI_URL` has content → openai URL/key/model (empty URL means “use default host” in UI; stored as empty string).
 * 3. Else **Anthropic** — when anthropic key or URL has content → migrate URL/key/model into forward fields so users can later point at an OpenAI-compatible proxy (Anthropic Messages URL may remain until changed).
 *
 * Legacy keys are **not** deleted in Phase 19 wave 1–2 (read-only merge). Never log API keys.
 */

import {
  LS_ANTHROPIC_KEY,
  LS_ANTHROPIC_MODEL,
  LS_ANTHROPIC_URL,
  LS_CUSTOM_KEY,
  LS_CUSTOM_MODEL,
  LS_CUSTOM_URL,
  LS_FORWARD_API_KEY,
  LS_FORWARD_BASE_URL,
  LS_FORWARD_MIGRATED_V1,
  LS_FORWARD_MODEL_ID,
  LS_OPENAI_KEY,
  LS_OPENAI_MODEL,
  LS_OPENAI_URL,
} from "@/types/question";

/** Default OpenAI chat completions URL (must match `parseChunk.ts`). */
const DEFAULT_OPENAI_CHAT_URL =
  "https://api.openai.com/v1/chat/completions";

const DEFAULT_ANTHROPIC_MESSAGES_URL =
  "https://api.anthropic.com/v1/messages";

export type ForwardClientSettings = {
  baseUrl: string;
  apiKey: string;
  modelId: string;
};

function lsGet(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(key) ?? "";
}

function lsSet(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const LS_FORWARD_PURGE_V2 = "doc2quiz:ai:forwardSecretsPurgedV2";

/** One-time removal of BYOK fields from localStorage (secrets move to server env). */
export function purgeForwardSecretsFromStorageOnce(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (lsGet(LS_FORWARD_PURGE_V2) === "1") {
    return;
  }
  clearForwardSettings();
  lsSet(LS_OPENAI_KEY, "");
  lsSet(LS_OPENAI_URL, "");
  lsSet(LS_OPENAI_MODEL, "");
  lsSet(LS_ANTHROPIC_KEY, "");
  lsSet(LS_ANTHROPIC_URL, "");
  lsSet(LS_ANTHROPIC_MODEL, "");
  lsSet(LS_CUSTOM_KEY, "");
  lsSet(LS_CUSTOM_URL, "");
  lsSet(LS_CUSTOM_MODEL, "");
  lsSet(LS_FORWARD_PURGE_V2, "1");
}

export function migrateForwardSettingsFromLegacy(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (lsGet(LS_FORWARD_MIGRATED_V1) === "1") {
    return;
  }

  const customUrl = lsGet(LS_CUSTOM_URL).trim();
  if (customUrl) {
    lsSet(LS_FORWARD_BASE_URL, customUrl);
    lsSet(LS_FORWARD_API_KEY, lsGet(LS_CUSTOM_KEY));
    lsSet(LS_FORWARD_MODEL_ID, lsGet(LS_CUSTOM_MODEL));
    lsSet(LS_FORWARD_MIGRATED_V1, "1");
    return;
  }

  const openaiKey = lsGet(LS_OPENAI_KEY).trim();
  const openaiUrl = lsGet(LS_OPENAI_URL).trim();
  if (openaiKey || openaiUrl) {
    lsSet(LS_FORWARD_BASE_URL, openaiUrl);
    lsSet(LS_FORWARD_API_KEY, lsGet(LS_OPENAI_KEY));
    lsSet(LS_FORWARD_MODEL_ID, lsGet(LS_OPENAI_MODEL));
    lsSet(LS_FORWARD_MIGRATED_V1, "1");
    return;
  }

  const anthropicKey = lsGet(LS_ANTHROPIC_KEY).trim();
  const anthropicUrl = lsGet(LS_ANTHROPIC_URL).trim();
  if (anthropicKey || anthropicUrl) {
    lsSet(
      LS_FORWARD_BASE_URL,
      anthropicUrl || DEFAULT_ANTHROPIC_MESSAGES_URL,
    );
    lsSet(LS_FORWARD_API_KEY, lsGet(LS_ANTHROPIC_KEY));
    lsSet(LS_FORWARD_MODEL_ID, lsGet(LS_ANTHROPIC_MODEL));
    lsSet(LS_FORWARD_MIGRATED_V1, "1");
    return;
  }

  lsSet(LS_FORWARD_MIGRATED_V1, "1");
}

export function readForwardSettings(): ForwardClientSettings {
  migrateForwardSettingsFromLegacy();
  if (typeof window === "undefined") {
    return { baseUrl: "", apiKey: "", modelId: "" };
  }
  return {
    baseUrl: lsGet(LS_FORWARD_BASE_URL),
    apiKey: lsGet(LS_FORWARD_API_KEY),
    modelId: lsGet(LS_FORWARD_MODEL_ID),
  };
}

export function writeForwardSettings(
  partial: Partial<ForwardClientSettings>,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const cur = readForwardSettings();
  const next: ForwardClientSettings = {
    baseUrl: partial.baseUrl ?? cur.baseUrl,
    apiKey: partial.apiKey ?? cur.apiKey,
    modelId: partial.modelId ?? cur.modelId,
  };
  lsSet(LS_FORWARD_BASE_URL, next.baseUrl);
  lsSet(LS_FORWARD_API_KEY, next.apiKey);
  lsSet(LS_FORWARD_MODEL_ID, next.modelId);
}

export function clearForwardSettings(): void {
  if (typeof window === "undefined") {
    return;
  }
  lsSet(LS_FORWARD_BASE_URL, "");
  lsSet(LS_FORWARD_API_KEY, "");
  lsSet(LS_FORWARD_MODEL_ID, "");
}

/**
 * `forwardAiPost` / `parseOpenAI` expect `"openai"` (vendor default URL) vs `"custom"` (user URL required).
 */
export function getForwardOpenAiCompatKind(): "openai" | "custom" {
  const { baseUrl } = readForwardSettings();
  return baseUrl.trim().length > 0 ? "custom" : "openai";
}

export { DEFAULT_OPENAI_CHAT_URL };
