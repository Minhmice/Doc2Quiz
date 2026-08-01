import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FRIEND_DESTINATIONS, normalizeFriendDestination } from "./FriendsHub";
describe("FriendsHub",()=>{it("exposes five safe destinations",()=>{expect(FRIEND_DESTINATIONS).toHaveLength(5);expect(normalizeFriendDestination("messages")).toBe("messages");expect(normalizeFriendDestination("unsafe")).toBe("friends");});});
describe("FriendsHub study handoff",()=>{it("passes studyWith and resolves accepted recipient before rendering dialog",()=>{const client=readFileSync(resolve(process.cwd(),"src/app/(app)/friends/FriendsHubClient.tsx"),"utf8");const hub=readFileSync(resolve(process.cwd(),"src/components/friends/FriendsHub.tsx"),"utf8");expect(client).toContain("params.get(\"studyWith\")");expect(client).toContain("studyWith={studyWith}");expect(hub).toContain("listAcceptedFriends");expect(hub).toContain("<StudyChallengeDialog");expect(hub).toContain("router.replace(`/friends?destination=${destination}`");});});
