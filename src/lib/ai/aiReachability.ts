import { testAiConnection } from "@/lib/ai/testConnection";
import {
  getKeyForProvider,
  getModelForProvider,
  getProvider,
  getUrlForProvider,
} from "@/lib/ai/storage";
import type { AiProvider } from "@/types/question";

export const LS_LAST_AI_REACHABILITY = "doc2quiz:ai:lastReachability";

/** Same-tab signal when Settings changes credentials */
export const AI_CONFIG_CHANGED_EVENT = "doc2quiz:ai-config-changed";

export type AiReachabilitySnapshot = {
  ok: boolean;
  message?: string;
  checkedAt: string;
  provider: AiProvider;
};

const LOG_PREFIX = "[Doc2Quiz][AI-reachability]";

function logSnapshot(s: AiReachabilitySnapshot): void {
  console.info(LOG_PREFIX, {
    ok: s.ok,
    provider: s.provider,
    checkedAt: s.checkedAt,
    message: s.message ?? null,
  });
}

export function readReachabilityFromStorage(): AiReachabilitySnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(LS_LAST_AI_REACHABILITY);
    if (!raw) {
      return null;
    }
    const o = JSON.parse(raw) as unknown;
    if (o === null || typeof o !== "object") {
      return null;
    }
    const rec = o as Record<string, unknown>;
    if (
      typeof rec.checkedAt !== "string" ||
      typeof rec.ok !== "boolean" ||
      (rec.provider !== "openai" &&
        rec.provider !== "anthropic" &&
        rec.provider !== "custom")
    ) {
      return null;
    }
    return {
      ok: rec.ok,
      message: typeof rec.message === "string" ? rec.message : undefined,
      checkedAt: rec.checkedAt,
      provider: rec.provider,
    };
  } catch {
    return null;
  }
}

export function writeReachabilityToStorage(s: AiReachabilitySnapshot): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(LS_LAST_AI_REACHABILITY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
  logSnapshot(s);
}

/**
 * Probes whether the configured AI can be used from this browser (same rules as Settings test).
 */
export async function runAiReachabilityCheck(
  signal?: AbortSignal,
): Promise<AiReachabilitySnapshot> {
  const provider = getProvider();
  const apiKey = getKeyForProvider(provider).trim();
  const apiUrl = getUrlForProvider(provider);
  const model = getModelForProvider(provider);

  const checkedAt = new Date().toISOString();

  if (!apiKey) {
    const s: AiReachabilitySnapshot = {
      ok: false,
      message: "No API key configured",
      checkedAt,
      provider,
    };
    writeReachabilityToStorage(s);
    return s;
  }

  if (provider === "custom") {
    if (!apiUrl.trim()) {
      const s: AiReachabilitySnapshot = {
        ok: false,
        message: "Custom API URL required",
        checkedAt,
        provider,
      };
      writeReachabilityToStorage(s);
      return s;
    }
    if (!model.trim()) {
      const s: AiReachabilitySnapshot = {
        ok: false,
        message: "Custom model id required",
        checkedAt,
        provider,
      };
      writeReachabilityToStorage(s);
      return s;
    }
  }

  let result: Awaited<ReturnType<typeof testAiConnection>>;
  try {
    result = await testAiConnection({
      provider,
      apiUrl,
      apiKey,
      model,
      signal,
    });
  } catch {
    const s: AiReachabilitySnapshot = {
      ok: false,
      message: "Reachability check failed",
      checkedAt,
      provider,
    };
    writeReachabilityToStorage(s);
    return s;
  }

  const s: AiReachabilitySnapshot = result.ok
    ? { ok: true, checkedAt, provider }
    : {
        ok: false,
        message: result.message,
        checkedAt,
        provider,
      };
  writeReachabilityToStorage(s);
  return s;
}

export function dispatchAiConfigChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
}
