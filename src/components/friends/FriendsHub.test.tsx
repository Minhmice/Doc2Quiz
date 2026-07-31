import { describe, expect, it } from "vitest";
import { FRIEND_DESTINATIONS, normalizeFriendDestination } from "./FriendsHub";
describe("FriendsHub",()=>{it("exposes five safe destinations",()=>{expect(FRIEND_DESTINATIONS).toHaveLength(5);expect(normalizeFriendDestination("messages")).toBe("messages");expect(normalizeFriendDestination("unsafe")).toBe("friends");});});
