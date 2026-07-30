import { describe, expect, it } from "vitest";
import { parseDashboardParams } from "@/hooks/useDashboardHome";

describe("dashboard URL contract", () => {
  it("preserves workspace filters and ignores legacy parameters", () => {
    expect(parseDashboardParams(new URLSearchParams("type=quiz&search=biology&status=ready&sort=title&practice=mistakes"))).toEqual({
      search: "biology", status: "ready", sort: "title",
    });
  });

  it("defaults invalid filters safely", () => {
    expect(parseDashboardParams(new URLSearchParams("status=failed&sort=oldest"))).toEqual({ search: "", status: "all", sort: "recent" });
  });
});
