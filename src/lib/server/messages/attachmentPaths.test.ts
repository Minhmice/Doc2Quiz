import { describe, expect, it } from "vitest";

import {
  buildDirectMessageAttachmentPath,
  directMessageAttachmentExtension,
  parseDirectMessageAttachmentPath,
  sanitizeDirectMessageAttachmentName,
} from "./attachmentPaths";

const userId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const attachmentId = "00000000-0000-4000-8000-000000000003";

describe("direct message attachment paths", () => {
  it("derives and parses canonical server-owned paths", () => {
    const path = buildDirectMessageAttachmentPath(userId, conversationId, attachmentId, "image/png");
    expect(path).toBe(`${userId}/messages/${conversationId}/${attachmentId}.png`);
    expect(parseDirectMessageAttachmentPath(path)).toEqual({ userId, conversationId, attachmentId, extension: "png" });
    expect(directMessageAttachmentExtension("video/quicktime")).toBe("mov");
  });

  it("rejects foreign or unsafe paths and sanitizes display names", () => {
    expect(parseDirectMessageAttachmentPath(`${userId}/messages/${conversationId}/wrong.png`)).toBeNull();
    expect(parseDirectMessageAttachmentPath("../../private.txt")).toBeNull();
    expect(sanitizeDirectMessageAttachmentName("../My video?.mp4")).toBe("My video_.mp4");
  });
});
