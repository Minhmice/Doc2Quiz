import { describe, expect, it } from "vitest";
import { parseDashboardParams } from "@/hooks/useDashboardHome";

describe("dashboard URL contract", () => {
  it("normalizes invalid type and preserves durable filters", () => {
    expect(parseDashboardParams(new URLSearchParams("type=wat&search=biology&status=ready&sort=title&practice=mistakes"))).toEqual({
      type: "all", search: "biology", status: "ready", sort: "title", practice: "mistakes",
    });
  });

  it("defaults every filter safely", () => {
    expect(parseDashboardParams(new URLSearchParams())).toEqual({ type: "all", search: "", status: "all", sort: "recent", practice: "all" });
  });
});
