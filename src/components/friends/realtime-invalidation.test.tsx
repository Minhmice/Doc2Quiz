import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("social realtime invalidation", () => {
  it("broadcasts metadata-only invalidation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/server/friends/realtimeBroadcast.ts"), "utf8");
    expect(source).toContain('type: "invalidate"');
    expect(source).toContain('"invalidate"');
    expect(source).not.toMatch(/body|presenceRank|cursor|redis value/i);
  });

  it("keeps event payload out of FriendsHub and ConversationView display state", () => {
    const hub = readFileSync(resolve(process.cwd(), "src/components/friends/FriendsHub.tsx"), "utf8");
    const conversation = readFileSync(resolve(process.cwd(), "src/components/friends/ConversationView.tsx"), "utf8");
    expect(hub).toContain("createFriendsInvalidationController");
    expect(conversation).toContain("onInvalidate");
    expect(`${hub}\n${conversation}`).not.toMatch(/payload\.(body|presence|cursor|avatar|name)/);
  });
});
