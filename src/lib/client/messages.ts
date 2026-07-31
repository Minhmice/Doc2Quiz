import { mapSocialHttpError, type Page } from "@/lib/client/friends";

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
export type DirectMessage = { id: string; senderId: string; body: string; createdAt: string };
export type ConversationSummary = { conversationId: string; peerId: string; username: string | null; preview: string | null; lastMessageAt: string | null; unreadCount?: number };
export function listConversationPage(cursor?: string): Promise<Page<ConversationSummary>> { const params=new URLSearchParams({limit:"20",...(cursor?{cursor}:{})}); return request(`/api/friends/messages?${params}`); }
export type ReactionPreferences = { enabled: boolean; blockedSenderIds: string[] };

const UNAVAILABLE = "Social features are unavailable.";

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
    `/api/friends/messages/${conversationId}?${params}`,
  );
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function sendDirectMessage(conversationId: string, body: string): Promise<DirectMessage> {
  return request(`/api/friends/messages/${conversationId}`, json("POST", { body }));
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

export async function touchSocialActivity(): Promise<{ ok: true }> {
  try {
    const response = await fetch("/api/friends/activity", { method: "POST" });
    if (!response.ok) throw mapSocialHttpError(response.status, UNAVAILABLE);
    return { ok: true };
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Connection lost. Check your network and try again.");
    if (error instanceof Error) throw error;
    throw new Error(UNAVAILABLE);
  }
}

export async function sendPresetReaction(
  recipientUserId: string,
  reactionId: PresetReactionId,
): Promise<{ recipientUserId: string; senderId: string; reactionId: PresetReactionId }> {
  return request("/api/friends/reactions", json("POST", { recipientUserId, reactionId }));
}
