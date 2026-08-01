import { describe, expect, it } from "vitest";

import {
  getDirectMessageHeaderStatus,
  type DirectMessageFriend,
} from "./DirectMessageDialog";

const friend = (presence: DirectMessageFriend["presence"]): DirectMessageFriend => ({
  userId: "friend-1",
  username: "Mina",
  avatarUrl: null,
  presence,
  lastActiveAt: "2026-08-01T23:00:00.000Z",
});

describe("DirectMessageDialog presence contract", () => {
  it("accepts API-shaped online friend data and selects online header treatment", () => {
    expect(getDirectMessageHeaderStatus(friend("online"))).toBe("online");
  });

  it.each(["recently_active", "offline"] as const)(
    "keeps %s on existing last-active fallback",
    (presence) => {
      expect(getDirectMessageHeaderStatus(friend(presence))).toBe("last-active");
    },
  );

  it("does not retain stale boolean dialog contract", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("./DirectMessageDialog.tsx", import.meta.url), "utf8"),
    );
    expect(source).not.toContain("isOnline: boolean");
    expect(source).toContain('presence === "online"');
  });
});
