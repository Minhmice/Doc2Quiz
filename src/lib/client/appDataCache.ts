import type { ActivityStats } from "@/lib/client/activityTracking";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";

/** How long cached page data is shown instantly before a background refresh. */
export const APP_DATA_CACHE_TTL_MS = 5 * 60 * 1000;

/** @deprecated Study-set N+1 counts — retained for legacy library consumers. */
export type DashboardSetCounts = Record<
  string,
  { editorStaging: number; approved: number }
>;

export type DashboardCachePayload = {
  workspaces: WorkspaceSummary[];
  activity: ActivityStats | null;
};

type CacheEnvelope<T> = {
  data: T;
  fetchedAt: number;
};

const DASHBOARD_STORAGE_KEY = "d2q-cache-dashboard-v2-workspaces";

let dashboardMemory: CacheEnvelope<DashboardCachePayload> | null = null;

function isFresh(fetchedAt: number, ttlMs = APP_DATA_CACHE_TTL_MS): boolean {
  return Date.now() - fetchedAt < ttlMs;
}

function readDashboardFromSession(): CacheEnvelope<DashboardCachePayload> | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const candidate = parsed as Partial<CacheEnvelope<DashboardCachePayload>>;
    if (
      typeof candidate.fetchedAt !== "number" ||
      !candidate.data ||
      !Array.isArray(candidate.data.workspaces)
    ) {
      return null;
    }
    return candidate as CacheEnvelope<DashboardCachePayload>;
  } catch {
    return null;
  }
}

function writeDashboardToSession(envelope: CacheEnvelope<DashboardCachePayload>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or private mode — memory cache still works this session.
  }
}

/** Returns dashboard payload if memory or session cache is still within TTL. */
export function getDashboardCache(): DashboardCachePayload | null {
  if (dashboardMemory && isFresh(dashboardMemory.fetchedAt)) {
    return dashboardMemory.data;
  }

  const fromSession = readDashboardFromSession();
  if (fromSession && isFresh(fromSession.fetchedAt)) {
    dashboardMemory = fromSession;
    return fromSession.data;
  }

  return null;
}

export function setDashboardCache(data: DashboardCachePayload): void {
  const envelope: CacheEnvelope<DashboardCachePayload> = {
    data,
    fetchedAt: Date.now(),
  };
  dashboardMemory = envelope;
  writeDashboardToSession(envelope);
}

export function invalidateDashboardCache(): void {
  dashboardMemory = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(DASHBOARD_STORAGE_KEY);
      // Drop legacy study-set cache key from prior dashboard shape.
      sessionStorage.removeItem("d2q-cache-dashboard-v1");
    } catch {
      // ignore
    }
  }
}
