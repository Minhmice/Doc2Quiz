import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES_BY_MIME,
  MIN_PASTE_CHARS,
  type FileInput,
  type PasteInput,
  type PipelineInput,
  SUPPORTED_MIME_TYPES,
  type YoutubeInput,
  validateFileUpload,
  validatePasteInput,
  validateYoutubeUrl,
} from "@/lib/pipeline/validation";

describe("SUPPORTED_MIME_TYPES", () => {
  it("includes application/pdf and at least 10 distinct MIME strings", () => {
    expect(SUPPORTED_MIME_TYPES).toContain("application/pdf");
    expect(new Set(SUPPORTED_MIME_TYPES).size).toBeGreaterThanOrEqual(10);
  });

  it("includes image/jpeg, audio/mpeg, and text/plain", () => {
    expect(SUPPORTED_MIME_TYPES).toContain("image/jpeg");
    expect(SUPPORTED_MIME_TYPES).toContain("audio/mpeg");
    expect(SUPPORTED_MIME_TYPES).toContain("text/plain");
  });
});

describe("MAX_UPLOAD_BYTES_BY_MIME", () => {
  it("has a positive limit for every supported MIME type", () => {
    for (const mime of SUPPORTED_MIME_TYPES) {
      expect(MAX_UPLOAD_BYTES_BY_MIME[mime]).toBeGreaterThan(0);
    }
  });
});

describe("PipelineInput union", () => {
  it("accepts paste, youtube, and file discriminants", () => {
    const paste: PasteInput = { kind: "paste", text: "hello" };
    const youtube: YoutubeInput = {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=abc",
    };
    const file: FileInput = {
      kind: "file",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    };

    const inputs: PipelineInput[] = [paste, youtube, file];
    expect(inputs.map((i) => i.kind)).toEqual(["paste", "youtube", "file"]);
  });
});

describe("validateFileUpload", () => {
  it("returns null for valid PDF at 1 KB", () => {
    expect(validateFileUpload("application/pdf", 1024)).toBeNull();
  });

  it("rejects unsupported MIME types", () => {
    const error = validateFileUpload("application/zip", 1024);
    expect(error).not.toBeNull();
    expect(error).toMatch(/unsupported/i);
  });

  it("rejects oversize files", () => {
    const max = MAX_UPLOAD_BYTES_BY_MIME["application/pdf"];
    const error = validateFileUpload("application/pdf", max + 1);
    expect(error).not.toBeNull();
    expect(error).toMatch(/limit|size|large/i);
  });

  it("accepts all SUPPORTED_MIME_TYPES at 1 byte", () => {
    for (const mime of SUPPORTED_MIME_TYPES) {
      expect(validateFileUpload(mime, 1)).toBeNull();
    }
  });
});

describe("validatePasteInput", () => {
  it("returns null for text at or above MIN_PASTE_CHARS", () => {
    const text = "a".repeat(MIN_PASTE_CHARS);
    expect(validatePasteInput(text)).toBeNull();
    expect(validatePasteInput("hello world and more text")).toBeNull();
  });

  it("rejects empty and whitespace-only paste", () => {
    expect(validatePasteInput("")).not.toBeNull();
    expect(validatePasteInput("   ")).not.toBeNull();
  });

  it("rejects text shorter than MIN_PASTE_CHARS", () => {
    expect(validatePasteInput("short")).not.toBeNull();
  });
});

describe("validateYoutubeUrl", () => {
  it("accepts youtube.com and youtu.be HTTPS URLs", () => {
    expect(
      validateYoutubeUrl("https://www.youtube.com/watch?v=abc"),
    ).toBeNull();
    expect(validateYoutubeUrl("https://youtu.be/abc")).toBeNull();
  });

  it("rejects internal IPs and non-YouTube hosts", () => {
    expect(validateYoutubeUrl("http://169.254.169.254/")).not.toBeNull();
    expect(validateYoutubeUrl("https://example.com/video")).not.toBeNull();
  });

  it("rejects non-HTTPS URLs", () => {
    expect(
      validateYoutubeUrl("http://www.youtube.com/watch?v=abc"),
    ).not.toBeNull();
  });
});
