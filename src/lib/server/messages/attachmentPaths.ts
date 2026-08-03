import { DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES, type DirectMessageAttachmentMime } from "@/lib/messages/attachmentValidation";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const attachmentPathPattern = new RegExp(`^(${uuidPattern})/messages/(${uuidPattern})/(${uuidPattern})\\.(jpg|png|webp|gif|mp4|webm|mov)$`);
const extensionByMime: Record<DirectMessageAttachmentMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function directMessageAttachmentExtension(mimeType: string): string | null {
  return (DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)
    ? extensionByMime[mimeType as DirectMessageAttachmentMime]
    : null;
}

export function buildDirectMessageAttachmentPath(userId: string, conversationId: string, attachmentId: string, mimeType: string): string | null {
  const extension = directMessageAttachmentExtension(mimeType);
  const path = extension ? `${userId.toLowerCase()}/messages/${conversationId.toLowerCase()}/${attachmentId.toLowerCase()}.${extension}` : null;
  return path && attachmentPathPattern.test(path) ? path : null;
}

export function parseDirectMessageAttachmentPath(path: unknown): { userId: string; conversationId: string; attachmentId: string; extension: string } | null {
  if (typeof path !== "string") return null;
  const match = attachmentPathPattern.exec(path);
  return match ? { userId: match[1], conversationId: match[2], attachmentId: match[3], extension: match[4] } : null;
}

export function sanitizeDirectMessageAttachmentName(name: string): string {
  const basename = name.split(/[\\/]/).pop() ?? "attachment";
  const sanitized = basename.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return sanitized || "attachment";
}
