import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUserMock = vi.fn();
const broadcastSocialEventMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();
const enqueueActivityMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/friends/realtimeBroadcast", () => ({ broadcastSocialEvent: (...args: unknown[]) => broadcastSocialEventMock(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => createSupabaseAdminClientMock() }));
vi.mock("@/lib/server/social/activityQueue", () => ({ enqueueActivity: (...args: unknown[]) => enqueueActivityMock(...args) }));

import { GET, POST } from "./route";

const responseOf = (response: Response | undefined) => response as Response;

const conversationId = "00000000-0000-4000-8000-000000000002";
const attachmentId = "00000000-0000-4000-8000-000000000003";

function context() {
  return { params: Promise.resolve({ conversationId }) };
}

function request(method: string, payload: unknown) {
  return new Request(`http://localhost/api/friends/messages/${conversationId}`, { method, body: JSON.stringify(payload), headers: { "content-type": "application/json" } });
}

describe("direct message attachment contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc: vi.fn() } });
    broadcastSocialEventMock.mockResolvedValue(true);
    enqueueActivityMock.mockResolvedValue(null);
  });

  it("keeps text-only POST shape while using new RPC signature and invalidation-only broadcast", async () => {
    const message = { id: "message-1", senderId: "00000000-0000-4000-8000-000000000001", recipientUserId: "00000000-0000-4000-8000-000000000004", body: "hello", createdAt: "2026-08-04T00:00:00.000Z" };
    const rpc = vi.fn().mockResolvedValue({ data: message, error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc } });
    const response = responseOf(await POST(request("POST", { body: " hello " }), context()));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("send_direct_message", { p_conversation_id: conversationId, p_body: "hello", p_attachment_ids: [] });
    expect(enqueueActivityMock).toHaveBeenCalledTimes(1);
    expect(enqueueActivityMock).toHaveBeenCalledWith({ userId: "00000000-0000-4000-8000-000000000001", activityKind: "message_sent", source: "message" });
    expect(broadcastSocialEventMock).toHaveBeenCalledWith(`social-messages:${conversationId}`, "message", { source: "message" });
    expect(JSON.stringify(await response.json())).not.toContain("path");
  });

  it("does not enqueue when durable message send fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "no" } });
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc } });

    expect(responseOf(await POST(request("POST", { body: "hello" }), context())).status).toBe(404);
    expect(enqueueActivityMock).not.toHaveBeenCalled();
  });

  it("accepts attachment-only and multiple attachment ids", async () => {
    const message = { id: "message-2", senderId: "00000000-0000-4000-8000-000000000001", recipientUserId: "recipient-1", body: null, attachments: [{ id: attachmentId, name: "one.png", mimeType: "image/png", sizeBytes: 8, path: `00000000-0000-4000-8000-000000000001/messages/${conversationId}/${attachmentId}.png` }], createdAt: "2026-08-04T00:00:00.000Z" };
    const rpc = vi.fn().mockResolvedValue({ data: message, error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/one.png" }, error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc } });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } });
    const response = responseOf(await POST(request("POST", { body: "", attachments: [attachmentId, "00000000-0000-4000-8000-000000000004"] }), context()));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("send_direct_message", { p_conversation_id: conversationId, p_body: null, p_attachment_ids: [attachmentId, "00000000-0000-4000-8000-000000000004"] });
    expect(createSignedUrl).toHaveBeenCalledWith(`00000000-0000-4000-8000-000000000001/messages/${conversationId}/${attachmentId}.png`, expect.any(Number));
    const body = await response.json();
    expect(body.data).toEqual(expect.objectContaining({ body: null, attachments: [expect.objectContaining({ url: "https://signed.example/one.png" })] }));
    expect(JSON.stringify(body)).not.toContain("raw/path.png");
  });

  it("rejects empty payload and invalid attachment ids before RPC", async () => {
    const rpc = vi.fn();
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc } });
    expect(responseOf(await POST(request("POST", { body: "", attachments: [] }), context())).status).toBe(400);
    expect(responseOf(await POST(request("POST", { body: "hello", attachments: ["bad"] }), context())).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps list attachments to signed DTOs and hides signing failures generically", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { messages: [{ id: "message-3", senderId: "00000000-0000-4000-8000-000000000001", body: null, attachments: [{ id: attachmentId, name: "one.png", mimeType: "image/png", sizeBytes: 8, path: `00000000-0000-4000-8000-000000000001/messages/${conversationId}/${attachmentId}.png` }], createdAt: "2026-08-04T00:00:00.000Z" }] }, error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: null, error: new Error("signing denied") });
    requireApiUserMock.mockResolvedValue({ user: { id: "00000000-0000-4000-8000-000000000001" }, supabase: { rpc } });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } });
    const response = responseOf(await GET(new Request(`http://localhost/api/friends/messages/${conversationId}`), context()));
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("/messages/");
  });
});
