import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/components/friends/NotificationsMenu.tsx"), "utf8");

describe("NotificationsMenu contracts", () => {
  it("does not mutate read state on menu open", () => {
    expect(source).not.toMatch(/onOpenChange=.*mark/);
    expect(source).toMatch(/markChallengeNotificationRead\(notification\.id\)/);
  });
  it("supports explicit mark-all and archives only after invite outcome", () => {
    expect(source).toMatch(/markAllChallengeNotificationsRead/);
    expect(source).toMatch(/await acceptStudyChallenge[\s\S]*await archiveChallengeInvite/);
    expect(source).toMatch(/await declineStudyChallenge[\s\S]*await archiveChallengeInvite/);
  });
  it("reconciles authoritative counts after each mutation", () => {
    expect(source.match(/await refresh\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("creator entries start or reopen and navigate only using returned href", () => {
    expect(source).toMatch(/startOrResumeCreatorAttempt/);
    expect(source).toMatch(/router\.push\(attempt\.playHref\)/);
  });
});
