import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT, validateDirectMessageAttachmentMetadata } from "@/lib/messages/attachmentValidation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  directMessageAttachmentExtension,
  parseDirectMessageAttachmentPath,
} from "@/lib/server/messages/attachmentPaths";
import { broadcastSocialEvent, broadcastSocialInvalidation } from "@/lib/server/friends/realtimeBroadcast";
import { enqueueActivity } from "@/lib/server/social/activityQueue";

const idSchema = z.string().uuid();
const sendSchema = z.object({
  body: z.string().trim().max(2000).nullable().optional(),
  attachments: z.array(idSchema).max(DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT).optional(),
}).strict();
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
type RawAttachment = { id?: unknown; name?: unknown; mimeType?: unknown; sizeBytes?: unknown; path?: unknown };
type RawMessage = { id?: unknown; senderId?: unknown; recipientUserId?: unknown; body?: unknown; createdAt?: unknown; attachments?: unknown };

function unavailable() { return NextResponse.json({ error: "social_unavailable" }, { status: 404 }); }
function invalid() { return NextResponse.json({ error: "invalid" }, { status: 400 }); }

async function signMessage(rawValue: unknown, conversationId: string): Promise<Record<string, unknown>> {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) throw new Error("message_unavailable");
  const raw = rawValue as RawMessage;
  if (typeof raw.id !== "string" || typeof raw.senderId !== "string" || typeof raw.createdAt !== "string") throw new Error("message_unavailable");
  const safe: Record<string, unknown> = { id: raw.id, senderId: raw.senderId, body: typeof raw.body === "string" ? raw.body : null, createdAt: raw.createdAt };
  if (typeof raw.recipientUserId === "string") safe.recipientUserId = raw.recipientUserId;
  if (!Array.isArray(raw.attachments) || raw.attachments.length === 0) return safe;

  const admin = createSupabaseAdminClient();
  const bucket = admin.storage.from("doc2quiz");
  const attachments: Array<{ id: string; name: string; mimeType: string; sizeBytes: number; url: string }> = [];
  for (const value of raw.attachments) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("attachment_unavailable");
    const attachment = value as RawAttachment;
    if (typeof attachment.id !== "string" || typeof attachment.name !== "string" || typeof attachment.mimeType !== "string" || typeof attachment.sizeBytes !== "number" || typeof attachment.path !== "string") throw new Error("attachment_unavailable");
    if (validateDirectMessageAttachmentMetadata({ name: attachment.name, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes })) throw new Error("attachment_unavailable");
    const parsed = parseDirectMessageAttachmentPath(attachment.path);
    if (
      !parsed
      || parsed.conversationId !== conversationId
      || parsed.attachmentId !== attachment.id
      || parsed.extension !== directMessageAttachmentExtension(attachment.mimeType)
    ) throw new Error("attachment_unavailable");
    const signed = await bucket.createSignedUrl(attachment.path, 5 * 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error("attachment_unavailable");
    attachments.push({ id: attachment.id, name: attachment.name, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, url: signed.data.signedUrl });
  }
  safe.attachments = attachments;
  return safe;
}

async function cleanupUploadedAttachments(rpc: RpcClient, conversationId: string, attachmentIds: string[]) {
  if (!attachmentIds.length) return;
  try {
    const discarded = await rpc.rpc("discard_direct_message_uploads", { p_conversation_id: conversationId, p_attachment_ids: attachmentIds });
    const paths = (discarded.data as { paths?: unknown } | null)?.paths;
    if (!Array.isArray(paths) || !paths.every((path): path is string => typeof path === "string")) return;
    await createSupabaseAdminClient().storage.from("doc2quiz").remove(paths);
  } catch {
    // Cleanup is best-effort; no storage path belongs in logs or responses.
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  const before = new URL(request.url).searchParams.get("before");
  if (!idSchema.safeParse(conversationId).success || (before !== null && Number.isNaN(Date.parse(before)))) return invalid();
  const result = await (auth.supabase as unknown as RpcClient).rpc("list_direct_messages", { p_conversation_id: conversationId, p_before: before, p_limit: 50 });
  if (result.error) return unavailable();
  try {
    const data = result.data as { messages?: unknown } | null;
    const rawMessages = Array.isArray(data?.messages) ? data.messages : [];
    const messages = await Promise.all(rawMessages.map((message) => signMessage(message, conversationId)));
    return NextResponse.json({ data: { messages } });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { conversationId } = await ctx.params;
  if (!idSchema.safeParse(conversationId).success) return invalid();
  let body: z.infer<typeof sendSchema>;
  try { body = sendSchema.parse(await request.json()); } catch { return invalid(); }
  const value = body.body ?? "";
  const attachmentIds = body.attachments ?? [];
  if (!value && attachmentIds.length === 0) return invalid();

  const rpc = auth.supabase as unknown as RpcClient;
  const result = await rpc.rpc("send_direct_message", { p_conversation_id: conversationId, p_body: value || null, p_attachment_ids: attachmentIds });
  if (result.error || !result.data) {
    await cleanupUploadedAttachments(rpc, conversationId, attachmentIds);
    return unavailable();
  }
  try {
    const message = await signMessage(result.data, conversationId);
    await enqueueActivity({ userId: auth.user.id, activityKind: "message_sent", source: "message" });
    await broadcastSocialInvalidation(`social-messages:${conversationId}`, conversationId);
    const recipientUserId = (result.data as RawMessage).recipientUserId;
    if (typeof recipientUserId === "string") await broadcastSocialEvent(`social-counts:${recipientUserId}`, "invalidate", { source: "message" });
    return NextResponse.json({ data: message });
  } catch {
    return unavailable();
  }
}

export const runtime = "nodejs";
