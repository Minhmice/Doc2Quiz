import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/profile/ProfilePageClient.tsx"),
  "utf8",
);

describe("ProfilePageClient avatar flow", () => {
  it("accepts supported static and animated image formats", () => {
    expect(source).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    expect(source).toContain("validateProfileImage(file)");
    expect(source).toContain("buildProfileAvatarPath(user.id, file.type)");
  });

  it("reports upload, persistence, and private preview failures", () => {
    expect(source).toContain("Avatar upload failed. Try again.");
    expect(source).toContain("Avatar uploaded, but profile save failed. Try again.");
    expect(source).toContain("Avatar saved, but private preview could not load. Refresh and try again.");
  });

  it("keeps confirmed avatar until a refreshed signed URL succeeds", () => {
    expect(source).toContain("const avatarUrl = await refreshAvatar()");
    expect(source).toContain("if (!avatarUrl) throw new Error");
    expect(source).toContain("setProfile((current) => current ? { ...current, avatarUrl } : current)");
    expect(source).toContain("onError={() => setAvatarFailed(true)}");
  });
});
