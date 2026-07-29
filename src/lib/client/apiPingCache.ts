import type { AiAgentPingResponse } from "@/lib/ai/ping";

export const API_PING_CACHE_TTL_MS = 60_000;

type PingEnvelope = {
  data: AiAgentPingResponse;
  fetchedAt: number;
};

const STORAGE_KEY = "d2q-cache-ai-ping-v1";

let memory: PingEnvelope | null = null;

function isFresh(fetchedAt: number, ttlMs = API_PING_CACHE_TTL_MS): boolean {
  return Date.now() - fetchedAt < ttlMs;
}

function readFromSession(): PingEnvelope | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PingEnvelope;
    if (
      !parsed ||
      typeof parsed.fetchedAt !== "number" ||
      !parsed.data ||
      typeof parsed.data.ok !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToSession(envelope: PingEnvelope): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore quota / private mode
  }
}

export function getApiPingCache(): AiAgentPingResponse | null {
  if (memory && isFresh(memory.fetchedAt)) {
    return memory.data;
  }
  const fromSession = readFromSession();
  if (fromSession && isFresh(fromSession.fetchedAt)) {
    memory = fromSession;
    return fromSession.data;
  }
  return null;
}

export function setApiPingCache(data: AiAgentPingResponse): void {
  const envelope: PingEnvelope = { data, fetchedAt: Date.now() };
  memory = envelope;
  writeToSession(envelope);
}

export function invalidateApiPingCache(): void {
  memory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
