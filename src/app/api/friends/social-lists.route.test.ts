import { describe, expect, it } from "vitest";
import { parseSocialListQuery } from "@/lib/server/friends/socialListQuery";

describe("social list route query", () => {
  it("defaults and bounds pagination", () => {
    expect(parseSocialListQuery(new URLSearchParams())).toEqual({ limit: 20, cursor: null });
    expect(parseSocialListQuery(new URLSearchParams("limit=50&cursor=abc"))).toEqual({ limit: 50, cursor: "abc" });
    expect(() => parseSocialListQuery(new URLSearchParams("limit=0"))).toThrow();
    expect(() => parseSocialListQuery(new URLSearchParams("limit=2.5"))).toThrow();
  });
});
