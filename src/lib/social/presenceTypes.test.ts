import { describe, expect, it } from "vitest";

import { presenceBuckets, presenceSources } from "./presenceTypes";

describe("presence DTO contract", () => {
  it("allows only canonical buckets and sources", () => {
    expect(presenceBuckets).toEqual(["online", "active_15m", "active_today", "offline", "unknown"]);
    expect(presenceSources).toEqual(["redis", "last_known", "unknown"]);
    expect(presenceBuckets).not.toContain("recently_active");
  });
});
