import { describe, expect, it } from "vitest";

import {
  buildProfileAvatarPath,
  isOwnProfileAvatarPath,
  parseProfileAvatarPath,
  PROFILE_IMAGE_EXTENSIONS,
  PROFILE_IMAGE_MAX_BYTES,
  profileImageExtension,
  validateProfileImage,
} from "./profileValidation";

describe("profileValidation", () => {
  it("uses canonical storage extensions for accepted image MIME types", () => {
    expect(profileImageExtension("image/jpeg")).toBe("jpg");
    expect(profileImageExtension("image/png")).toBe("png");
    expect(profileImageExtension("image/webp")).toBe("webp");
    expect(profileImageExtension("image/gif")).toBe("gif");
  });

  it("exports one MIME allowlist and enforces the exclusive 10 MiB boundary", () => {
    expect(PROFILE_IMAGE_EXTENSIONS).toEqual({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" });
    expect(PROFILE_IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(validateProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_MAX_BYTES - 1 })).toBeNull();
    expect(validateProfileImage({ type: "image/jpeg", size: PROFILE_IMAGE_MAX_BYTES })).toBe("Image must be smaller than 10 MB.");
    expect(validateProfileImage({ type: "image/svg+xml", size: 1 })).toMatch(/PNG, JPEG, WebP, or GIF/);
  });

  it("builds and parses only canonical avatar paths", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    expect(buildProfileAvatarPath(userId, "image/gif")).toBe(`${userId}/profile/avatar.gif`);
    expect(buildProfileAvatarPath("not-a-user", "image/png")).toBeNull();
    expect(parseProfileAvatarPath(`${userId}/profile/avatar.jpeg`)).toEqual({ userId, extension: "jpg" });
    expect(isOwnProfileAvatarPath(`${userId}/profile/avatar.jpg`, userId)).toBe(true);
    expect(isOwnProfileAvatarPath(`${userId}/profile/avatar.svg`, userId)).toBe(false);
    expect(isOwnProfileAvatarPath(`${userId}/other/avatar.jpg`, userId)).toBe(false);
  });
});
