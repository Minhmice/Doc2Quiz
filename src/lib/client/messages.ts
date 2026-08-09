import { mapSocialHttpError, type Page } from "@/lib/client/friends";
import {
  DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT,
  validateDirectMessageAttachment,
  type DirectMessageAttachmentInput as SharedDirectMessageAttachmentInput,
} from "@/lib/messages/attachmentValidation";

export const PRESET_REACTION_IDS = [
  "xin_chao",
  "co_len",
  "dinh_qua",
  "qua_hay",
  "ban_gioi",
  "thu_gian",
  "good_luck",
  "tuyet_voi",
] as const;

export type PresetReactionId = (typeof PRESET_REACTION_IDS)[number];
export type DirectConversation = { conversationId: string };
export type DirectMessageAttachment = { id: string; name: string; mimeType: string; sizeBytes: number; url: string };
export type DirectMessageAttachmentInput = { id: string; name: string; mimeType: string; sizeBytes: number };
export type DirectMessage = { id: string; senderId: string; body: string | null; createdAt: string; attachments?: DirectMessageAttachment[] };
export type ConversationSummary = { conversationId: string; peerId: string; username: string | null; preview: string | null; lastMessageAt: string | null; unreadCount?: number };
export function listConversationPage(cursor?: string): Promise<Page<ConversationSummary>> { const params=new URLSearchParams({limit:"20",...(cursor?{cursor}:{})}); return request(`/api/friends/messages?${params}`); }
export type ReactionPreferences = { enabled: boolean; blockedSenderIds: string[] };

const UNAVAILABLE = "Social features are unavailable.";
const attachmentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ApiEnvelope<T> = { data: T };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw mapSocialHttpError(response.status, UNAVAILABLE);
    return ((await response.json()) as ApiEnvelope<T>).data;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Connection lost. Check your network and try again.");
    if (error instanceof Error) throw error;
    throw new Error(UNAVAILABLE);
  }
}

function json(method: string, body: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function openDirectConversation(userId: string): Promise<DirectConversation> {
  return request("/api/friends/messages", json("POST", { userId }));
}

export async function listDirectMessages(
  conversationId: string,
  before?: string,
): Promise<DirectMessage[]> {
  const params = new URLSearchParams(before ? { before } : {});
  const data = await request<{ messages?: DirectMessage[] }>(
    `/api/friends/messages/${conversationId}${params.size ? `?${params}` : ""}`,
  );
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function uploadDirectMessageAttachments(conversationId: string, files: File[]): Promise<DirectMessageAttachmentInput[]> {
  if (files.length === 0 || files.length > DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT) throw new Error("Invalid attachment count.");
  for (const file of files) {
    const error = validateDirectMessageAttachment(file);
    if (error) throw new Error(error);
  }
  const form = new FormData();
  for (const file of files) form.append("files", file);
  const data = await request<DirectMessageAttachmentInput[]>(`/api/friends/messages/${conversationId}/attachments`, { method: "POST", body: form });
  return Array.isArray(data) ? data : [];
}

export async function discardDirectMessageAttachments(conversationId: string, attachments: DirectMessageAttachmentInput[]): Promise<{ ok: true }> {
  const attachmentIds = attachments.map(({ id }) => id);
  if (!attachmentIds.length || attachmentIds.length > DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT || attachmentIds.some((id) => !attachmentIdPattern.test(id))) throw new Error("Invalid attachment ids.");
  await request<{ ok: true }>(`/api/friends/messages/${conversationId}/attachments`, json("DELETE", { attachmentIds }));
  return { ok: true };
}

export async function sendDirectMessage(conversationId: string, body: string, attachments: DirectMessageAttachmentInput[] = []): Promise<DirectMessage> {
  if (attachments.length > DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT || attachments.some((attachment) => !attachmentIdPattern.test(attachment.id))) throw new Error("Invalid attachment ids.");
  const value = body.trim();
  if (!value && attachments.length === 0) throw new Error("Message cannot be empty.");
  return request(`/api/friends/messages/${conversationId}`, json("POST", { body: value || null, ...(attachments.length ? { attachments: attachments.map(({ id }) => id) } : {}) }));
}

export async function markDirectConversationRead(conversationId: string): Promise<{ ok: true }> {
  const data = await request<{ ok?: boolean }>(`/api/friends/messages/${conversationId}/read`, { method: "POST" });
  if (!data.ok) throw new Error(UNAVAILABLE);
  return { ok: true };
}

export async function updateReactionPreferences(
  preferences: ReactionPreferences,
): Promise<{ ok: true }> {
  const data = await request<{ ok?: boolean }>("/api/friends/preferences", json("PATCH", preferences));
  if (!data.ok) throw new Error(UNAVAILABLE);
  return { ok: true };
}

export async function sendPresetReaction(
  recipientUserId: string,
  reactionId: PresetReactionId,
): Promise<{ recipientUserId: string; senderId: string; reactionId: PresetReactionId }> {
  return request("/api/friends/reactions", json("POST", { recipientUserId, reactionId }));
}

export type { SharedDirectMessageAttachmentInput };
