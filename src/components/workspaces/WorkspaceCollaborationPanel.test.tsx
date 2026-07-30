import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "@/lib/locale/messages";
import { LocaleProvider } from "@/components/locale/LocaleProvider";
import {
  WorkspaceCollaborationPanel,
  copyShareLinkToClipboard,
} from "./WorkspaceCollaborationPanel";
import {
  canManageWorkspaceCollaboration,
  createWorkspaceShare,
} from "@/lib/client/workspaceCollaboration";

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

function renderPanel(role: "owner" | "editor" | "viewer") {
  return renderToStaticMarkup(
    createElement(
      LocaleProvider,
      { initialLocale: "en" },
      createElement(WorkspaceCollaborationPanel, {
        workspaceId: WORKSPACE_ID,
        membershipRole: role,
      }),
    ),
  );
}

describe("WorkspaceCollaborationPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders owner mutation controls for owners only", () => {
    const ownerHtml = renderPanel("owner");
    expect(ownerHtml).toContain(messages.en.collaboration.panel.inviteButton);
    expect(ownerHtml).toContain(messages.en.collaboration.panel.createWorkspaceShare);
    expect(ownerHtml).toContain(messages.en.collaboration.panel.membersHeading);

    const editorHtml = renderPanel("editor");
    expect(editorHtml).toContain(messages.en.collaboration.panel.readOnlyNotice);
    expect(editorHtml).not.toContain(messages.en.collaboration.panel.inviteButton);
    expect(editorHtml).not.toContain(messages.en.collaboration.panel.revokeMember);

    const viewerHtml = renderPanel("viewer");
    expect(viewerHtml).toContain(messages.en.collaboration.panel.readOnlyNotice);
    expect(viewerHtml).not.toContain(messages.en.collaboration.panel.inviteButton);
  });

  it("exposes membership role and workspace id for composition contracts", () => {
    const html = renderPanel("owner");
    expect(html).toContain(`data-workspace-id="${WORKSPACE_ID}"`);
    expect(html).toContain('data-membership-role="owner"');
  });

  it("includes accessible invite dialog labels and live status regions for owners", () => {
    const html = renderPanel("owner");
    expect(html).toContain('aria-live="polite"');
    const source = readFileSync(
      resolve(process.cwd(), "src/components/workspaces/WorkspaceCollaborationPanel.tsx"),
      "utf8",
    );
    expect(source).toContain("panel.inviteDialogTitle");
    expect(source).toContain("panel.recipientUserIdLabel");
    expect(source).toContain("panel.revokeMemberConfirmTitle");
    expect(source).toContain("panel.revokeShareConfirmTitle");
  });

  it("copies share links only through explicit clipboard action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });

    await copyShareLinkToClipboard("/share/secret-token");

    expect(writeText).toHaveBeenCalledWith(
      "https://app.test/share/secret-token",
    );
  });
});

describe("canManageWorkspaceCollaboration", () => {
  it("allows only owners to manage collaboration", () => {
    expect(canManageWorkspaceCollaboration("owner")).toBe(true);
    expect(canManageWorkspaceCollaboration("editor")).toBe(false);
    expect(canManageWorkspaceCollaboration("viewer")).toBe(false);
  });
});

describe("createWorkspaceShare client contract", () => {
  it("returns shareUrl without token field for copy-only handling", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "share-1",
          targetKind: "workspace",
          targetId: WORKSPACE_ID,
          permission: "view",
          createdAt: "2026-01-01",
          token: "one-time-token",
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await createWorkspaceShare(WORKSPACE_ID, {
      targetKind: "workspace",
      targetId: WORKSPACE_ID,
    });

    expect(result.shareUrl).toBe("/share/one-time-token");
    expect("token" in result).toBe(false);
  });
});
