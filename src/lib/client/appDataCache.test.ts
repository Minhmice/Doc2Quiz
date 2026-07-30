import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_DATA_CACHE_TTL_MS,
  getDashboardCache,
  invalidateDashboardCache,
  setDashboardCache,
  type DashboardCachePayload,
} from "@/lib/client/appDataCache";

const samplePayload: DashboardCachePayload = {
  workspaces: [
    {
      id: "ws-1",
      title: "Biology",
      subtitle: null,
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      documentCount: 1,
      canonicalVersionCount: 1,
      quizOutputCount: 1,
      flashcardOutputCount: 0,
      recentOutputs: [],
    },
  ],
  activity: null,
};

describe("appDataCache", () => {
  beforeEach(() => {
    invalidateDashboardCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
  });

  afterEach(() => {
    invalidateDashboardCache();
    vi.useRealTimers();
  });

  it("returns null when cache is empty", () => {
    expect(getDashboardCache()).toBeNull();
  });

  it("stores and reads dashboard payload from memory", () => {
    setDashboardCache(samplePayload);
    expect(getDashboardCache()).toEqual(samplePayload);
  });

  it("expires dashboard cache after TTL", () => {
    setDashboardCache(samplePayload);
    vi.advanceTimersByTime(APP_DATA_CACHE_TTL_MS + 1);
    expect(getDashboardCache()).toBeNull();
  });

  it("invalidates dashboard cache", () => {
    setDashboardCache(samplePayload);
    invalidateDashboardCache();
    expect(getDashboardCache()).toBeNull();
  });
});
