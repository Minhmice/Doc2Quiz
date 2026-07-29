import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_DATA_CACHE_TTL_MS,
  getDashboardCache,
  invalidateDashboardCache,
  setDashboardCache,
  type DashboardCachePayload,
} from "@/lib/client/appDataCache";

const samplePayload: DashboardCachePayload = {
  sets: [
    {
      id: "set-1",
      title: "Biology",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      pipelineStage: "quiz",
      contentKind: "quiz",
    },
  ],
  counts: { "set-1": { editorStaging: 0, approved: 3 } },
  mistakes: { "set-1": false },
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
