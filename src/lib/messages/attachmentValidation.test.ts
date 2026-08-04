import { describe, expect, it } from "vitest";

import {
  DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES,
  DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT,
  DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES,
  validateDirectMessageAttachment,
  validateDirectMessageAttachmentMetadata,
} from "./attachmentValidation";

describe("direct message attachment validation", () => {
  it("accepts every allowlisted MIME at the exact byte limit", () => {
    for (const type of DIRECT_MESSAGE_ATTACHMENT_MIME_TYPES) {
      expect(validateDirectMessageAttachment({ name: `file.${type.split("/")[1]}`, type, size: DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES })).toBeNull();
    }
  });

  it("rejects one byte over the limit and unsupported MIME", () => {
    expect(validateDirectMessageAttachment({ name: "large.png", type: "image/png", size: DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES + 1 })).not.toBeNull();
    expect(validateDirectMessageAttachment({ name: "script.svg", type: "image/svg+xml", size: 1 })).not.toBeNull();
  });

  it("validates bounded canonical metadata", () => {
    expect(DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT).toBeGreaterThan(1);
    expect(validateDirectMessageAttachmentMetadata({ name: "clip.mp4", mimeType: "video/mp4", sizeBytes: 12 })).toBeNull();
    expect(validateDirectMessageAttachmentMetadata({ name: "clip.mp4", mimeType: "video/mp4", sizeBytes: DIRECT_MESSAGE_ATTACHMENT_MAX_BYTES + 1 })).not.toBeNull();
    expect(validateDirectMessageAttachmentMetadata({ name: "clip.mp4", mimeType: "application/octet-stream", sizeBytes: 12 })).not.toBeNull();
    expect(validateDirectMessageAttachmentMetadata({ name: "../clip.mp4", mimeType: "video/mp4", sizeBytes: 12 })).not.toBeNull();
  });
});
