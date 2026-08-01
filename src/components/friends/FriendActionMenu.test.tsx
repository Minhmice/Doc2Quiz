import { describe, expect, it } from "vitest";

import { getFriendPresencePresentation } from "./FriendActionMenu";

describe("FriendActionMenu presence presentation", () => {
  it("keeps online dot and status label only for online", () => {
    expect(getFriendPresencePresentation("online")).toEqual({
      isOnline: true,
      showOnlineAffordance: true,
    });
  });

  it.each(["recently_active", "offline"] as const)(
    "suppresses dot and status label for %s",
    (presence) => {
      expect(getFriendPresencePresentation(presence)).toEqual({
        isOnline: false,
        showOnlineAffordance: false,
      });
    },
  );
});
