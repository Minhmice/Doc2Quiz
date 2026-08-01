import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSocialCountsController, emptySocialCountsSnapshot, refreshSocialCounts } from "./socialCounts";

const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

describe("social counts reconciliation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches distinct count authorities and newest notifications", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const data = url === "/api/friends"
        ? { incomingRequestCount: 2, unreadMessageCount: 5 }
        : url.includes("unread-count") ? { count: 3 } : { notifications: [{ id: "new" }] };
      return new Response(JSON.stringify({ data }), { status: 200 });
    });

    await expect(refreshSocialCounts()).resolves.toEqual({
      notificationUnreadCount: 3,
      incomingRequestCount: 2,
      unreadMessageCount: 5,
      notifications: [{ id: "new" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not manufacture counts when authenticated HTTP fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ count: 999 }), { status: 500 }));
    await expect(refreshSocialCounts()).rejects.toThrow("social_unavailable");
  });

  it("reconciles on private events, subscribe, focus, and visibility without trusting payload counts", async () => {
    const handlers = new Map<string, () => void>();
    const channels: Array<{ event?: () => void; subscribed?: (status: string) => void }> = [];
    const supabase = {
      channel: vi.fn(),
      removeChannel: vi.fn(),
    };
    supabase.channel.mockImplementation(() => {
      const state: { event?: () => void; subscribed?: (status: string) => void } = {};
      channels.push(state);
      const channel = {
        on: vi.fn((_type, _filter, callback) => { state.event = callback; return channel; }),
        subscribe: vi.fn((callback) => { state.subscribed = callback; return channel; }),
      };
      return channel;
    });
    const windowTarget = { addEventListener: vi.fn((name, fn) => handlers.set(`w:${name}`, fn)), removeEventListener: vi.fn() };
    const documentTarget = { visibilityState: "visible", addEventListener: vi.fn((name, fn) => handlers.set(`d:${name}`, fn)), removeEventListener: vi.fn() };
    const fetched = { ...emptySocialCountsSnapshot(), notificationUnreadCount: 1, incomingRequestCount: 2, unreadMessageCount: 3 };
    const reconcile = vi.fn().mockResolvedValue(fetched);
    const onSnapshot = vi.fn();

    const stop = createSocialCountsController({ supabase: supabase as never, userId: "user-1", reconcile, onSnapshot, windowTarget: windowTarget as never, documentTarget: documentTarget as never });
    await tick();
    for (const channel of channels) { channel.subscribed?.("SUBSCRIBED"); await tick(); channel.event?.(); await tick(); }
    handlers.get("w:focus")?.(); await tick();
    handlers.get("d:visibilitychange")?.(); await tick();

    expect(onSnapshot).toHaveBeenLastCalledWith(fetched);
    expect(onSnapshot).not.toHaveBeenCalledWith(expect.objectContaining({ unreadMessageCount: 999 }));
    expect(reconcile).toHaveBeenCalledTimes(9);
    stop();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(3);
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(documentTarget.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
