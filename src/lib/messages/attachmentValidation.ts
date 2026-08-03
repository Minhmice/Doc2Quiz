export const DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT = 5;

export const DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type DirectMessageAttachmentMime = (typeof DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES)[number];
export type DirectMessageAttachmentInput = Readonly<{
  name: string;
  type: string;
  size: number;
}>;
export type DirectMessageAttachmentMetadata = Readonly<{
  name: string;
  mimeType: string;
  sizeBytes: number;
}>;

const allowedMimeTypes = new Set<string>(DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES);
const displayNamePattern = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$/;

export function validateDirectMessageAttachment(file: DirectMessageAttachmentInput): string | null {
  if (!allowedMimeTypes.has(file.type)) return "Unsupported attachment type.";
  if (!Number.isInteger(file.size) || file.size < 0 || file.size > DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES) {
    return "Attachment exceeds the 20 MiB limit.";
  }
  if (typeof file.name !== "string" || file.name.length === 0 || file.name.length > 120) {
    return "Attachment name is invalid.";
  }
  return null;
}

export function validateDirectMessageAttachmentMetadata(metadata: DirectMessageAttachmentMetadata): string | null {
  const error = validateDirectMessageAttachment({ name: metadata.name, type: metadata.mimeType, size: metadata.sizeBytes });
  if (error) return error;
  return displayNamePattern.test(metadata.name) ? null : "Attachment name is invalid.";
}

export function isDirectMessageAttachmentMime(value: string): value is DirectMessageAttachmentMime {
  return allowedMimeTypes.has(value);
}
