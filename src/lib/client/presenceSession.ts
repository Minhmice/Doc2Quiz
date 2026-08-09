import type { PresenceSource } from "@/lib/social/presenceTypes";

export const PRESENCE_CACHE_MS = 15_000;
export const HEARTBEAT_MIN_MS = 20_000;
export const HEARTBEAT_MAX_MS = 40_000;

type Timer = ReturnType<typeof setTimeout>;
type PresenceDocument = { visibilityState: string; addEventListener: Document["addEventListener"]; removeEventListener: Document["removeEventListener"] };
type PresenceWindow = Pick<Window, "addEventListener" | "removeEventListener">;

type CacheEntry<T> = { value: T; expiresAt: number };

export function createLastKnownCache<T>(now: () => number = Date.now) {
  let entry: CacheEntry<T> | null = null;
  return {
    store(value: T) { entry = { value, expiresAt: now() + PRESENCE_CACHE_MS }; },
    read(): { value: T; source: PresenceSource } | null {
      if (!entry || entry.expiresAt < now()) return null;
      return { value: entry.value, source: "last_known" };
    },
    clear() { entry = null; },
  };
}

export type PresenceSessionOptions = {
  heartbeat: (sessionId: string) => Promise<void>;
  sessionId?: string;
  random?: () => number;
  documentTarget?: PresenceDocument;
  windowTarget?: PresenceWindow;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
};

function createSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function createPresenceSessionController(options: PresenceSessionOptions) {
  const documentTarget = options.documentTarget ?? (typeof document === "undefined" ? undefined : document);
  const windowTarget = options.windowTarget ?? (typeof window === "undefined" ? undefined : window);
  const setTimeoutFn = options.setTimeout ?? setTimeout;
  const clearTimeoutFn = options.clearTimeout ?? clearTimeout;
  const random = options.random ?? Math.random;
  const sessionId = options.sessionId ?? createSessionId();
  let timer: Timer | null = null;
  let running = false;
  let inFlight = false;

  const delay = () => HEARTBEAT_MIN_MS + Math.floor(random() * (HEARTBEAT_MAX_MS - HEARTBEAT_MIN_MS + 1));
  const clear = () => { if (timer !== null) clearTimeoutFn(timer); timer = null; };
  const schedule = () => {
    clear();
    if (!running || documentTarget?.visibilityState === "hidden") return;
    timer = setTimeoutFn(() => { void beat(); }, delay());
  };
  const beat = async () => {
    if (!running || inFlight || documentTarget?.visibilityState === "hidden") return;
    inFlight = true;
    try { await options.heartbeat(sessionId); } catch { } finally { inFlight = false; schedule(); }
  };
  const visible = () => {
    if (documentTarget?.visibilityState === "visible") void beat();
    else clear();
  };

  return {
    sessionId,
    start() {
      if (running) return;
      running = true;
      documentTarget?.addEventListener("visibilitychange", visible);
      windowTarget?.addEventListener("focus", visible);
      void beat();
    },
    stop() {
      running = false;
      clear();
      documentTarget?.removeEventListener("visibilitychange", visible);
      windowTarget?.removeEventListener("focus", visible);
    },
  };
}

export async function sendPresenceHeartbeat(sessionId: string): Promise<void> {
  const response = await fetch("/api/friends/presence/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  if (!response.ok) throw new Error("presence_unavailable");
}
