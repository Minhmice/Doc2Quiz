import { describe, expect, it, vi } from "vitest";
import { decodeSocialCursor, encodeSocialCursor, listSocialFriends } from "./socialLists";

describe("bounded social list authority", () => {
  it("binds friends cursors to destination, version, and presence bucket", () => {
    const cursor = encodeSocialCursor("friends", [1, "minh", "00000000-0000-0000-0000-000000000001"], "online");
    expect(decodeSocialCursor("friends", cursor, "online")).toEqual([1, "minh", "00000000-0000-0000-0000-000000000001"]);
    expect(() => decodeSocialCursor("friends", cursor, "offline")).toThrow("social_unavailable");
    expect(() => decodeSocialCursor("blocks", cursor)).toThrow("social_unavailable");
    expect(() => decodeSocialCursor("friends", "not-base64", "online")).toThrow("social_unavailable");

    const legacyCursor = Buffer.from(JSON.stringify({
      v: 1,
      d: "friends",
      k: [1, "minh", "00000000-0000-0000-0000-000000000001"],
    })).toString("base64url");
    expect(() => decodeSocialCursor("friends", legacyCursor, "online")).toThrow("social_unavailable");
  });

  it("requests online bucket limit plus one and returns final stable tuple", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [
      { userId: "1", username: "a", presenceRank: 0, presence: "online" },
      { userId: "2", username: "b", presenceRank: 0, presence: "online" },
      { userId: "3", username: "c", presenceRank: 0, presence: "online" },
    ], totalCount: 3 }, error: null });
    const page = await listSocialFriends({ rpc }, 2, null, "online");
    expect(rpc).toHaveBeenCalledWith("list_social_friends", {
      p_limit: 3,
      p_cursor: null,
      p_presence: "online",
    });
    expect(page.items.map((item) => item.userId)).toEqual(["1", "2"]);
    expect(page.hasMore).toBe(true);
    expect(decodeSocialCursor("friends", page.nextCursor!, "online")).toEqual([0, "b", "2"]);
  });

  it("passes offline bucket to RPC and keeps server-normalized non-online rows", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [
      { userId: "2", username: "b", presenceRank: 1, presence: "recently_active" },
      { userId: "3", username: "c", presenceRank: 2, presence: "offline" },
    ] }, error: null });
    const page = await listSocialFriends({ rpc }, 20, null, "offline");
    expect(rpc).toHaveBeenCalledWith("list_social_friends", {
      p_limit: 21,
      p_cursor: null,
      p_presence: "offline",
    });
    expect(page.items.map((item) => item.presenceRank)).toEqual([1, 2]);
    expect(page.nextCursor).toBeNull();
  });
});
