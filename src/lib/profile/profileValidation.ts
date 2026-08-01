export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

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
  if (file.size > PROFILE_IMAGE_MAX_BYTES) return "Image must be 2 MB or smaller.";
  return null;
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
