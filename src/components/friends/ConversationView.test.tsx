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
const ATTACHMENT_ID = "00000000-0000-4000-8000-000000000013";
const message = (id: string, createdAt: string, senderId = "friend"): DirectMessage => ({ id, body: id, senderId, createdAt });
const attachment = (id = ATTACHMENT_ID): NonNullable<DirectMessage["attachments"]>[number] => ({ id, name: "photo.png", mimeType: "image/png", sizeBytes: 8, url: "https://signed.example/photo.png" });

type TestTransport = ConversationTransport & { emit: () => void; subscribe: () => void; removed: () => boolean };

function transport(pages: DirectMessage[][]): TestTransport {
  let event = () => undefined;
  let subscribed = () => undefined;
  let isRemoved = false;
  return {
    list: vi.fn().mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
    upload: vi.fn().mockResolvedValue([{ id: ATTACHMENT_ID, name: "photo.png", mimeType: "image/png", sizeBytes: 8 }]),
    discard: vi.fn().mockResolvedValue({ ok: true as const }),
    send: vi.fn().mockResolvedValue({ ...message("sent", "2026-07-31T10:04:00Z", "me"), attachments: [attachment()] }),
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

function file(name = "photo.png") { return new File([new Uint8Array([1])], name, { type: "image/png" }); }

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
    const desktop = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("./DirectMessageDialog.tsx", import.meta.url), "utf8"),
    );
    const mobile = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(new URL("../../app/(app)/friends/messages/[conversationId]/ConversationPageClient.tsx", import.meta.url), "utf8"),
    );
    expect(desktop).toContain("<ConversationView");
    expect(mobile).toContain("<ConversationView");
    expect(source).toContain("min-w-0");
    expect(source).toContain("wrap-anywhere");
    expect(source).toContain("createConversationController");
    expect(source).toContain('accept="image/*,video/*"');
    expect(source).toContain("multiple");
    expect(source).toContain("URL.createObjectURL");
    expect(source).toContain("URL.revokeObjectURL");
    expect(source).toContain("aria-label={`Xóa ${file.name}`}");
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
    expect(api.send).toHaveBeenCalledWith(CONVERSATION_ID, "hello", []);
    expect(controller.snapshot().messages.map(({ id }) => id)).toEqual(["a", "b", "sent"]);
    expect(api.removed()).toBe(true);
  });

  it("keeps attachment-only messages and rejects empty messages", () => {
    const attachmentOnly: DirectMessage = { id: "attachment", body: null, senderId: "friend", createdAt: "2026-07-31T10:03:00Z", attachments: [attachment()] };
    const empty: DirectMessage = { id: "empty", body: null, senderId: "friend", createdAt: "2026-07-31T10:04:00Z" };
    expect(mergeDirectMessages([], [attachmentOnly, empty]).map(({ id }) => id)).toEqual(["attachment"]);
  });

  it("uploads all selected files before sending mixed content and cleans failed sends", async () => {
    const api = transport([[], []]);
    vi.mocked(api.upload).mockResolvedValue([
      { id: ATTACHMENT_ID, name: "photo.png", mimeType: "image/png", sizeBytes: 1 },
      { id: "00000000-0000-4000-8000-000000000014", name: "second.png", mimeType: "image/png", sizeBytes: 1 },
    ]);
    vi.mocked(api.send).mockRejectedValueOnce(new Error("send failed"));
    const controller = createConversationController({ conversationId: CONVERSATION_ID, transport: api, onChange: vi.fn() });
    await controller.start();
    expect(await controller.send(" hello ", [file(), file("second.png")])).toBe(false);
    expect(vi.mocked(api.upload)).toHaveBeenCalledBefore(vi.mocked(api.send));
    expect(api.send).toHaveBeenCalledWith(CONVERSATION_ID, "hello", expect.arrayContaining([expect.objectContaining({ id: ATTACHMENT_ID })]));
    expect(api.discard).toHaveBeenCalledWith(CONVERSATION_ID, expect.arrayContaining([expect.objectContaining({ id: ATTACHMENT_ID })]));
    expect(controller.snapshot().error).toContain("thử lại");
  });

  it("keeps mobile route full-screen without hiding desktop deep links", () => {
    expect(conversationPageClassName).toContain("h-[100dvh]");
    expect(conversationPageClassName).toContain("safe-area-inset-top");
    expect(conversationPageClassName).not.toContain("hidden md:flex");
    expect(conversationPageClassName).toContain("md:static");
  });
});
