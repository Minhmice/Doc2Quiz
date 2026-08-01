import { describe, expect, it, vi } from "vitest";

import {
  createConversationController,
  mergeDirectMessages,
  messageBubbleClassName,
  type ConversationTransport,
} from "./ConversationView";
import type { DirectMessage } from "@/lib/client/messages";
import { conversationPageClassName } from "@/app/(app)/friends/messages/[conversationId]/ConversationPageClient";

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000012";
const message = (id: string, createdAt: string, senderId = "friend"): DirectMessage => ({ id, body: id, senderId, createdAt });

function transport(pages: DirectMessage[][]): ConversationTransport & { emit: () => void; subscribe: () => void; removed: () => boolean } {
  let event = () => undefined;
  let subscribed = () => undefined;
  let isRemoved = false;
  return {
    list: vi.fn().mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
    send: vi.fn().mockResolvedValue(message("sent", "2026-07-31T10:04:00Z", "me")),
    read: vi.fn().mockResolvedValue({ ok: true as const }),
    currentUser: vi.fn().mockResolvedValue("me"),
    connect: vi.fn((_id, onInvalidate, onSubscribed) => {
      event = onInvalidate;
      subscribed = onSubscribed;
      return () => { isRemoved = true; };
    }),
    emit: () => event(),
    subscribe: () => subscribed(),
    removed: () => isRemoved,
  };
}

describe("shared conversation bubble presentation", () => {
  it.each([
    [false, "A long sentence with normal whitespace that should remain readable inside its bubble."],
    [true, "A long sentence with normal whitespace that should remain readable inside its bubble."],
    [false, "x".repeat(2000)],
    [true, "x".repeat(2000)],
  ] as const)("contains safe wrapping classes for sent=%s and body length=%s", (sent, body) => {
    const classes = messageBubbleClassName(sent, body);
    expect(classes).toContain("min-w-0");
    expect(classes).toContain("wrap-anywhere");
    expect(classes).toContain("max-w-[75%]");
    expect(classes).toContain(sent ? "bg-primary" : "bg-muted");
  });

  it("keeps wrapping in shared desktop and mobile view without a second controller", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("./ConversationView.tsx", import.meta.url), "utf8"),
    );
    expect(source).toContain("<ConversationView");
    expect(source).toContain("min-w-0 wrap-anywhere");
    expect(source).toContain("createConversationController");
  });
});

describe("shared conversation controller", () => {
  it("dedupes and orders initial, older, and reconnect history using before cursor", async () => {
    const api = transport([
      [message("c", "2026-07-31T10:03:00Z"), message("b", "2026-07-31T10:02:00Z")],
      [message("b", "2026-07-31T10:02:00Z"), message("a", "2026-07-31T10:01:00Z")],
      [message("d", "2026-07-31T10:04:00Z"), message("c", "2026-07-31T10:03:00Z")],
    ]);
    const snapshots: string[][] = [];
    const controller = createConversationController({ conversationId: CONVERSATION_ID, transport: api, onChange: (state) => snapshots.push(state.messages.map(({ id }) => id)) });

    await controller.start();
    await controller.loadOlder();
    api.subscribe();
    await controller.settled();

    expect(api.list).toHaveBeenNthCalledWith(1, CONVERSATION_ID);
    expect(api.list).toHaveBeenNthCalledWith(2, CONVERSATION_ID, "2026-07-31T10:02:00Z");
    expect(snapshots.at(-1)).toEqual(["a", "b", "c", "d"]);
    expect(api.read).toHaveBeenCalled();
  });

  it("reconciles missed events, focus, visibility, send, and cleans up", async () => {
    const api = transport([[message("a", "2026-07-31T10:01:00Z")], [message("b", "2026-07-31T10:02:00Z")], [], []]);
    const controller = createConversationController({ conversationId: CONVERSATION_ID, transport: api, onChange: vi.fn() });
    await controller.start();
    api.emit();
    await controller.settled();
    await controller.reconcile();
    await controller.send(" hello ");
    controller.stop();

    expect(api.list).toHaveBeenCalledTimes(4);
    expect(api.send).toHaveBeenCalledWith(CONVERSATION_ID, "hello");
    expect(controller.snapshot().messages.map(({ id }) => id)).toEqual(["a", "b", "sent"]);
    expect(api.removed()).toBe(true);
  });

  it("provides stable merge order and duplicate suppression", () => {
    expect(mergeDirectMessages([message("b", "2026-07-31T10:02:00Z")], [message("a", "2026-07-31T10:01:00Z"), message("b", "2026-07-31T10:02:00Z")]).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("keeps mobile route full-screen without hiding desktop deep links", () => {
    expect(conversationPageClassName).toContain("h-[100dvh]");
    expect(conversationPageClassName).toContain("safe-area-inset-top");
    expect(conversationPageClassName).not.toContain("hidden md:flex");
    expect(conversationPageClassName).toContain("md:static");
  });
});
