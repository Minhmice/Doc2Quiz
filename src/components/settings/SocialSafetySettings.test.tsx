import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/locale/LocaleProvider";
import { messages } from "@/lib/locale/messages";
import { SocialSafetySettings } from "./SocialSafetySettings";

function renderSettings() {
  return renderToStaticMarkup(
    createElement(
      LocaleProvider,
      { initialLocale: "en" },
      createElement(SocialSafetySettings),
    ),
  );
}

describe("SocialSafetySettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { username: null, requests: [], blocks: [] } }),
    }));
  });

  it("renders username, requests, blocks, and report actions in settings", () => {
    const html = renderSettings();
    const copy = messages.en.socialSafety;

    expect(html).toContain(copy.heading);
    expect(html).toContain(copy.usernameTitle);
    expect(html).toContain(copy.requestsTitle);
    expect(html).toContain(copy.blocksTitle);
    expect(html).toContain(copy.sendRequestButton);
    expect(html).toContain('data-social-settings="true"');

    const source = readFileSync(
      resolve(process.cwd(), "src/components/settings/SocialSafetySettings.tsx"),
      "utf8",
    );
    expect(source).toContain("copy.reportUser");
    expect(source).toContain("copy.reportDialogTitle");
  });

  it("includes accessible dialog labels, live regions, and confirmation copy", () => {
    const html = renderSettings();
    const source = readFileSync(
      resolve(process.cwd(), "src/components/settings/SocialSafetySettings.tsx"),
      "utf8",
    );

    expect(html).toContain('aria-live="polite"');
    expect(source).toContain("copy.sendRequestDialogTitle");
    expect(source).toContain("copy.sendRequestUsernameLabel");
    expect(source).toContain("copy.blockConfirmTitle");
    expect(source).toContain("copy.unblockConfirmTitle");
    expect(source).toContain("copy.reportDialogTitle");
    expect(source).toContain("copy.reportReasonLabel");
    expect(source).toContain("sendRequestTriggerRef.current?.focus()");
    expect(source).toContain("reportTriggerRef.current?.focus()");
  });

  it("uses generic social safety errors without account disclosure markers", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/settings/SocialSafetySettings.tsx"),
      "utf8",
    );

    expect(source).toContain("copy.genericError");
    expect(source).toContain("copy.reportAcknowledgement");
    expect(source).not.toMatch(/does not exist|user not found|blocked by recipient/i);
    expect(source).not.toMatch(/reportId|moderation|admin/i);
  });

  it("keeps EN and VI social safety keys literal and aligned", () => {
    const en = messages.en.socialSafety;
    const vi = messages.vi.socialSafety;

    expect(en.heading).toBe("Social safety");
    expect(vi.heading).toBe("An toàn xã hội");
    expect(en.reportAcknowledgement).toMatch(/do not share report status/i);
    expect(vi.reportAcknowledgement).toMatch(/không chia sẻ trạng thái/i);
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort());
  });
});
