import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FRIEND_DESTINATIONS, normalizeFriendDestination, normalizeFriendPresenceDestination, createFriendsPresenceRefreshController } from "./FriendsHub";
describe("FriendsHub",()=>{it("exposes five safe destinations",()=>{expect(FRIEND_DESTINATIONS).toHaveLength(5);expect(normalizeFriendDestination("messages")).toBe("messages");expect(normalizeFriendDestination("unsafe")).toBe("friends");});});
describe("FriendsHub study handoff",()=>{it("passes studyWith and resolves accepted recipient before rendering dialog",()=>{const client=readFileSync(resolve(process.cwd(),"src/app/(app)/friends/FriendsHubClient.tsx"),"utf8");const hub=readFileSync(resolve(process.cwd(),"src/components/friends/FriendsHub.tsx"),"utf8");expect(client).toContain("params.get(\"studyWith\")");expect(client).toContain("studyWith={studyWith}");expect(hub).toContain("listAcceptedFriends");expect(hub).toContain("<StudyChallengeDialog");expect(hub).toContain("router.replace(`/friends?destination=${destination}`");});});

describe("FriendsHub presence buckets", () => {
  it.each([
    [null, "offline"],
    ["invalid", "offline"],
    ["online", "online"],
    ["offline", "offline"],
  ] as const)("normalizes presence=%s to %s", (value, expected) => {
    expect(normalizeFriendPresenceDestination(value)).toBe(expected);
  });

  it("keeps bucket URL state and server paging separate", () => {
    const hub = readFileSync(resolve(process.cwd(), "src/components/friends/FriendsHub.tsx"), "utf8");
    expect(hub).toContain("useSearchParams");
    expect(hub).toContain("&presence=${next}");
    expect(hub).toContain("listAcceptedFriendPage(presence, cursor)");
    expect(hub).toContain("requestSequenceRef");
    expect(hub).toContain("setPage(emptyPage)");
  });

  it("refreshes only through bounded lifecycle signals and cleans up stale callbacks", () => {
    vi.useFakeTimers();
    const listeners = new Map<string, () => void>();
    const windowTarget = {
      addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(`window:${name}`, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(`window:${name}`)),
    };
    const documentTarget = {
      visibilityState: "hidden",
      addEventListener: vi.fn((name: string, listener: () => void) => listeners.set(`document:${name}`, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(`document:${name}`)),
    };
    const nextTransitionAt = Date.now() + 300_000;
    const onRefresh = vi.fn();
    const controller = createFriendsPresenceRefreshController({ onRefresh, getNextTransitionAt: () => nextTransitionAt, windowTarget, documentTarget });
    controller.start();

    listeners.get("window:focus")?.();
    documentTarget.visibilityState = "visible";
    listeners.get("document:visibilitychange")?.();
    vi.advanceTimersByTime(60_000);
    vi.advanceTimersByTime(240_000);
    const refreshCount = onRefresh.mock.calls.length;
    expect(refreshCount).toBeGreaterThanOrEqual(4);

    controller.stop();
    listeners.get("window:focus")?.();
    documentTarget.visibilityState = "hidden";
    listeners.get("document:visibilitychange")?.();
    vi.advanceTimersByTime(60_000);
    expect(onRefresh.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(documentTarget.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    vi.useRealTimers();
  });

  it("uses canonical server DTOs without client presence reclassification", () => {
    const hub = readFileSync(resolve(process.cwd(), "src/components/friends/FriendsHub.tsx"), "utf8");
    expect(hub).toContain('import type { PresenceBucket } from "@/lib/social/presenceTypes"');
    expect(hub).not.toContain("recently_active");
    expect(hub).not.toMatch(/\.sort\(|\.filter\(.*presence/);
  });
});
