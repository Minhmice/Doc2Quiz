import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/profile/ProfilePageClient.tsx"),
  "utf8",
);

describe("ProfilePageClient avatar flow", () => {
  it("posts only the file to authenticated profile endpoint", () => {
    expect(source).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    expect(source).toContain("validateProfileImage(file)");
    expect(source).toContain('form.set("file", file)');
    expect(source).toContain('fetch("/api/profile", { method: "POST", body: form })');
    expect(source).not.toContain("createSupabaseBrowserClient");
    expect(source).not.toContain("supabase.storage");
    expect(source).not.toContain("buildProfileAvatarPath");
  });

  it("reports server and private preview failures", () => {
    expect(source).toContain("avatarUploadFailed");
    expect(source).toContain("avatarUploadAuth");
    expect(source).toContain("avatarPreviewFailed");
    expect(source).not.toContain("Profile avatar request failed");
  });

  it("renders the signed upload response and updates shared avatar state", () => {
    expect(source).toContain("const avatarUrl = body?.data?.avatarUrl");
    expect(source).toContain("if (!avatarUrl)");
    expect(source).toContain("setProfile((current) => current ? { ...current, avatarUrl } : current)");
    expect(source).toContain("setAvatarUrl(avatarUrl)");
    expect(source).toContain("onError={() => setAvatarFailed(true)}");
  });
});
