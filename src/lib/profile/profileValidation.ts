export const PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const PROFILE_IMAGE_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type ProfileImageMime = keyof typeof PROFILE_IMAGE_EXTENSIONS;

const avatarPathPattern = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/profile\/avatar\.(png|jpg|jpeg|webp|gif)$/;

export function validateProfileImage(file: Pick<File, "type" | "size">): string | null {
  if (!profileImageExtension(file.type)) return "Choose a PNG, JPEG, WebP, or GIF image.";
  if (file.size >= PROFILE_IMAGE_MAX_BYTES) return "Image must be smaller than 10 MB.";
  return null;
}

export function hasProfileImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const header = String.fromCharCode(...bytes.subarray(0, 12));
  if (mimeType === "image/webp") return bytes.length >= 12 && header.startsWith("RIFF") && header.slice(8) === "WEBP";
  if (mimeType === "image/gif") return bytes.length >= 6 && (header.startsWith("GIF87a") || header.startsWith("GIF89a"));
  return false;
}

export function profileImageExtension(type: string): string | null {
  return PROFILE_IMAGE_EXTENSIONS[type as ProfileImageMime] ?? null;
}

export function buildProfileAvatarPath(userId: string, mimeType: string): string | null {
  const extension = profileImageExtension(mimeType);
  return extension && avatarPathPattern.test(`${userId}/profile/avatar.${extension}`)
    ? `${userId}/profile/avatar.${extension}`
    : null;
}

export function parseProfileAvatarPath(path: unknown): { userId: string; extension: string } | null {
  if (typeof path !== "string") return null;
  const match = avatarPathPattern.exec(path);
  return match ? { userId: match[1], extension: match[2] === "jpeg" ? "jpg" : match[2] } : null;
}

export function isOwnProfileAvatarPath(path: unknown, userId: string): path is string {
  return parseProfileAvatarPath(path)?.userId === userId.toLowerCase();
}

export function validateProfileText(displayName: unknown, bio: unknown): string | null {
  if (displayName !== undefined) {
    if (typeof displayName !== "string" || displayName.length > 40) return "Display name must be 40 characters or fewer.";
  }
  if (bio !== undefined) {
    if (typeof bio !== "string" || bio.length > 240) return "Bio must be 240 characters or fewer.";
  }
  return null;
}
