import { describe, expect, it, vi } from "vitest";

import {
  listDirectMessages,
  markDirectConversationRead,
  openDirectConversation,
  sendDirectMessage,
  sendPresetReaction,
  updateReactionPreferences,
} from "./messages";

const USER_ID = "00000000-0000-4000-8000-000000000011";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000012";

describe("messages client", () => {
  it("uses protected APIs with bounded payload contracts", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { conversationId: CONVERSATION_ID, ok: true } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await openDirectConversation(USER_ID);
    await listDirectMessages(CONVERSATION_ID, "2026-07-31T10:00:00.000Z");
    await sendDirectMessage(CONVERSATION_ID, "hello");
    await sendDirectMessage(CONVERSATION_ID, "", [{ id: "00000000-0000-4000-8000-000000000013", name: "photo.png", mimeType: "image/png", sizeBytes: 8 }]);
    await markDirectConversationRead(CONVERSATION_ID);
    await updateReactionPreferences({ enabled: false, blockedSenderIds: [USER_ID] });
    await sendPresetReaction(USER_ID, "xin_chao");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/messages",
      expect.objectContaining({ body: JSON.stringify({ userId: USER_ID }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/friends/messages/${CONVERSATION_ID}?before=2026-07-31T10%3A00%3A00.000Z`,
      undefined,
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/friends/messages/${CONVERSATION_ID}`,
      expect.objectContaining({ body: JSON.stringify({ body: "hello" }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/friends/messages/${CONVERSATION_ID}`,
      expect.objectContaining({ body: JSON.stringify({ body: null, attachments: ["00000000-0000-4000-8000-000000000013"] }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/friends/messages/${CONVERSATION_ID}/read`,
      { method: "POST" },
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/preferences",
      expect.objectContaining({ body: JSON.stringify({ enabled: false, blockedSenderIds: [USER_ID] }) }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/friends/reactions",
      expect.objectContaining({ body: JSON.stringify({ recipientUserId: USER_ID, reactionId: "xin_chao" }) }),
    );
  });
});
