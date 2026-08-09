import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("FriendsMenu presence contract", () => {
  it("uses canonical accepted-friend data without stale buckets", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/layout/FriendsMenu.tsx"), "utf8");
    expect(source).toContain("AcceptedFriendSummary");
    expect(source).not.toContain("recently_active");
  });
});
