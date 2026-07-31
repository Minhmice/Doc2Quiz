import { describe, expect, it, vi } from "vitest";
import { decodeSocialCursor, encodeSocialCursor, listSocialFriends } from "./socialLists";

describe("bounded social list authority", () => {
  it("binds opaque cursors to destination and version", () => {
    const cursor = encodeSocialCursor("friends", [1, "minh", "00000000-0000-0000-0000-000000000001"]);
    expect(decodeSocialCursor("friends", cursor)).toEqual([1, "minh", "00000000-0000-0000-0000-000000000001"]);
    expect(() => decodeSocialCursor("blocks", cursor)).toThrow("social_unavailable");
    expect(() => decodeSocialCursor("friends", "not-base64")).toThrow("social_unavailable");
  });

  it("requests limit plus one and returns bounded continuation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { items: [
      { userId: "1", username: "a", presenceRank: 0 },
      { userId: "2", username: "b", presenceRank: 1 },
      { userId: "3", username: "c", presenceRank: 2 },
    ], totalCount: 3 }, error: null });
    const page = await listSocialFriends({ rpc }, 2, null);
    expect(rpc).toHaveBeenCalledWith("list_social_friends", expect.objectContaining({ p_limit: 3 }));
    expect(page.items.map((item) => item.userId)).toEqual(["1", "2"]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
  });
});
