/**
 * Lightweight probe: server-side AI processing availability (`/api/ai/processing-status`).
 */

export const LS_LAST_AI_REACHABILITY = "doc2quiz:ai:lastReachability";

/** Same-tab signal when processing availability may have changed */
export const AI_CONFIG_CHANGED_EVENT = "doc2quiz:ai-config-changed";

export type AiReachabilitySnapshot = {
  ok: boolean;
  message?: string;
  checkedAt: string;
};

function logSnapshot(s: AiReachabilitySnapshot): void {
  console.info("[Doc2Quiz][AI-reachability]", {
    ok: s.ok,
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
    if (typeof rec.checkedAt !== "string" || typeof rec.ok !== "boolean") {
      return null;
    }
    return {
      ok: rec.ok,
      message: typeof rec.message === "string" ? rec.message : undefined,
      checkedAt: rec.checkedAt,
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
    /* quota */
  }
  logSnapshot(s);
}

export async function runAiReachabilityCheck(
  signal?: AbortSignal,
): Promise<AiReachabilitySnapshot> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch("/api/ai/processing-status", {
      signal,
      credentials: "same-origin",
    });
    if (res.status === 401) {
      const s: AiReachabilitySnapshot = {
        ok: false,
        message: "Sign in to check processing status.",
        checkedAt,
      };
      writeReachabilityToStorage(s);
      return s;
    }
    if (!res.ok) {
      const s: AiReachabilitySnapshot = {
        ok: false,
        message: "Could not reach processing status.",
        checkedAt,
      };
      writeReachabilityToStorage(s);
      return s;
    }
    const data = (await res.json()) as { available?: unknown };
    const ok = data.available === true;
    const s: AiReachabilitySnapshot = {
      ok,
      message: ok ? undefined : "Document processing is temporarily unavailable.",
      checkedAt,
    };
    writeReachabilityToStorage(s);
    return s;
  } catch {
    const s: AiReachabilitySnapshot = {
      ok: false,
      message: "Reachability check failed",
      checkedAt,
    };
    writeReachabilityToStorage(s);
    return s;
  }
}

export function dispatchAiConfigChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
}
