import { describe, expect, it, vi } from "vitest";
import { createTypingController, getTypingSnapshot, updateTyping } from "./typing";

describe("typing client", () => {
  it("uses canonical route and preserves unknown outage state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { state: "unknown", users: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTypingSnapshot("conversation")).resolves.toEqual({ state: "unknown", users: [] });
    await updateTyping("conversation", "typing");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/friends/messages/conversation/typing", undefined);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/friends/messages/conversation/typing", expect.objectContaining({ method: "POST", body: JSON.stringify({ state: "typing" }) }));
  });

  it("debounces typing and stops without sending message content", () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const controller = createTypingController("conversation", send, 500);
    controller.input("hello");
    controller.input("hello again");
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("conversation", "typing");
    controller.stop();
    expect(send).toHaveBeenLastCalledWith("conversation", "stopped");
    vi.useRealTimers();
  });
});
