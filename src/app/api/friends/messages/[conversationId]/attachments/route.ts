import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES,
  DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT,
  validateDirectMessageAttachment,
} from "@/lib/messages/attachmentValidation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildDirectMessageAttachmentPath,
  directMessageAttachmentExtension,
  sanitizeDirectMessageAttachmentName,
} from "@/lib/server/messages/attachmentPaths";

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
type StorageBucket = {
  upload: (path: string, body: Uint8Array, options: { contentType: string; upsert: false; cacheControl: string }) => Promise<{ error: unknown }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};

const idSchema = z.string().uuid();
const attachmentIdsSchema = z.object({ attachmentIds: z.array(idSchema).min(1).max(DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT) });

function unavailable() { return NextResponse.json({ error: "social_unavailable" }, { status: 404 }); }
function invalid() { return NextResponse.json({ error: "invalid_attachment" }, { status: 400 }); }

function hasSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/gif") return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.subarray(0, 6)));
  if (mimeType === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
  if (mimeType === "video/webm") return bytes.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((value, index) => bytes[index] === value);
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") return bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === "ftyp";
  return false;
}

export async function POST(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return invalid();

  let form: FormData;
  try { form = await request.formData(); } catch { return invalid(); }
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0 || files.length > DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT) return invalid();

  const preparedFiles: Array<{ file: File; bytes: Uint8Array; extension: string }> = [];
  for (const file of files) {
    const validationError = validateDirectMessageAttachment({ name: file.name, type: file.type, size: file.size });
    const extension = directMessageAttachmentExtension(file.type);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (validationError || !extension || bytes.length !== file.size || file.size > DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES || !hasSignature(bytes, file.type)) return invalid();
    preparedFiles.push({ file, bytes, extension });
  }

  const rpc = auth.supabase as unknown as RpcClient;
  const authorization = await rpc.rpc("authorize_direct_message_upload", { p_conversation_id: conversationId });
  if (authorization.error || (authorization.data as { ok?: unknown } | null)?.ok !== true) return unavailable();

  const admin = createSupabaseAdminClient();
  const storage = admin.storage.from("doc2quiz") as unknown as StorageBucket;
  const uploadedPaths: string[] = [];
  const uploadedIds: string[] = [];
  const result: Array<{ id: string; name: string; mimeType: string; sizeBytes: number }> = [];

  try {
    for (const { file, bytes, extension } of preparedFiles) {
      const attachmentId = crypto.randomUUID();
      const path = buildDirectMessageAttachmentPath(auth.user.id, conversationId, attachmentId, file.type);
      if (!path) throw new Error("invalid_attachment");
      const upload = await storage.upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (upload.error) throw new Error("storage_upload_failed");
      uploadedPaths.push(path);
      const name = sanitizeDirectMessageAttachmentName(file.name);
      const registered = await rpc.rpc("register_direct_message_upload", {
        p_attachment_id: attachmentId,
        p_conversation_id: conversationId,
        p_name: name,
        p_mime_type: file.type,
        p_size_bytes: file.size,
        p_extension: extension,
      });
      if (registered.error || !(registered.data as { id?: unknown } | null)?.id) throw new Error("registration_failed");
      uploadedIds.push(attachmentId);
      result.push({ id: attachmentId, name, mimeType: file.type, sizeBytes: file.size });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    if (uploadedPaths.length) await storage.remove(uploadedPaths).catch(() => undefined);
    if (uploadedIds.length) {
      try { await rpc.rpc("discard_direct_message_uploads", { p_conversation_id: conversationId, p_attachment_ids: uploadedIds }); } catch { /* best effort */ }
    }
    if (error instanceof Error && error.message === "invalid_attachment") return invalid();
    return unavailable();
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return invalid();
  let body: z.infer<typeof attachmentIdsSchema>;
  try { body = attachmentIdsSchema.parse(await request.json()); } catch { return invalid(); }
  const result = await (auth.supabase as unknown as RpcClient).rpc("discard_direct_message_uploads", { p_conversation_id: conversationId, p_attachment_ids: body.attachmentIds });
  return result.error ? unavailable() : NextResponse.json({ data: { ok: true } });
}

export const runtime = "nodejs";
