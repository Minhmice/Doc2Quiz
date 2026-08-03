import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUserMock = vi.fn();
const createSupabaseAdminClientMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => createSupabaseAdminClientMock() }));

import { DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES } from "@/lib/messages/attachmentValidation";
import { DELETE, POST } from "./route";

// Vitest's inferred union includes error responses; route tests only exercise success-shaped responses.
const responseOf = (response: Response | undefined) => response as Response;

const userId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const attachmentId = "00000000-0000-4000-8000-000000000003";

function context(id = conversationId) {
  return { params: Promise.resolve({ conversationId: id }) };
}

function multipartRequest(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return new Request(`http://localhost/api/friends/messages/${conversationId}/attachments`, { method: "POST", body: form });
}

function pngFile(size = 8, name = "picture.png") {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return new File([bytes], name, { type: "image/png" });
}

function webmFile() {
  return new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], "clip.webm", { type: "video/webm" });
}

describe("direct message attachment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc: vi.fn() } });
  });

  it("authenticates before parsing multipart or creating admin storage client", async () => {
    requireApiUserMock.mockResolvedValue({ error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) });
    const response = responseOf(await POST(multipartRequest([pngFile()]), context()));
    expect(response.status).toBe(401);
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("rejects malformed UUID and exact-limit overflow before RPC or Storage", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    expect((await responseOf(await POST(multipartRequest([pngFile()]), context("bad")))).status).toBe(400);
    const tooLarge = new File([new Uint8Array(DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES + 1)], "large.png", { type: "image/png" });
    expect((await responseOf(await POST(multipartRequest([tooLarge]), context()))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
  });

  it("accepts valid WebM signatures before private upload", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { id: attachmentId }, error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ upload }) } });

    const response = responseOf(await POST(multipartRequest([webmFile()]), context()));

    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.webm$/), expect.any(Uint8Array), expect.objectContaining({ contentType: "video/webm", upsert: false }));
  });

  it("authorizes, uploads multiple files privately, and registers opaque metadata", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { id: attachmentId }, error: null })
      .mockResolvedValueOnce({ data: { id: "00000000-0000-4000-8000-000000000004" }, error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upload });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from } });

    const response = await responseOf(await POST(multipartRequest([pngFile(), pngFile(8, "second.png")]), context()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "authorize_direct_message_upload", { p_conversation_id: conversationId });
    expect(from).toHaveBeenCalledWith("doc2quiz");
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${userId}/messages/${conversationId}/.*\\.png$`)), expect.any(Uint8Array), expect.objectContaining({ contentType: "image/png", upsert: false }));
    expect(rpc).toHaveBeenCalledWith("register_direct_message_upload", expect.objectContaining({ p_conversation_id: conversationId, p_mime_type: "image/png", p_size_bytes: 8 }));
    expect(JSON.stringify(body)).not.toContain("/messages/");
    expect(body.data).toEqual(expect.arrayContaining([expect.objectContaining({ name: "picture.png", mimeType: "image/png", sizeBytes: 8 })]));
  });

  it("cleans already uploaded objects when later registration fails", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { id: attachmentId }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("register failed") })
      .mockResolvedValue({ data: { ok: true }, error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    createSupabaseAdminClientMock.mockReturnValue({ storage: { from: vi.fn().mockReturnValue({ upload, remove }) } });

    const response = await responseOf(await POST(multipartRequest([pngFile(), pngFile(8, "second.png")]), context()));
    expect(response.status).toBe(404);
    expect(remove).toHaveBeenCalledWith(expect.arrayContaining([expect.stringMatching(new RegExp(`^${userId}/messages/${conversationId}/`))]));
  });

  it("discards only opaque ids through guarded cleanup RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    requireApiUserMock.mockResolvedValue({ user: { id: userId }, supabase: { rpc } });
    const response = await responseOf(await DELETE(new Request("http://localhost", { method: "DELETE", body: JSON.stringify({ attachmentIds: [attachmentId] }), headers: { "content-type": "application/json" } }), context()));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("discard_direct_message_uploads", { p_conversation_id: conversationId, p_attachment_ids: [attachmentId] });
  });
});
