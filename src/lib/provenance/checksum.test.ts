import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  checksumCanonicalMarkdown,
  checksumSections,
  type ChecksumSectionInput,
} from "./checksum";

function sha256Hex(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

describe("checksumCanonicalMarkdown", () => {
  it("yields one lowercase SHA-256 for LF, CRLF, and CR equivalents", () => {
    const lf = "hello\nworld";
    const crlf = "hello\r\nworld";
    const cr = "hello\rworld";

    const digest = checksumCanonicalMarkdown(lf);
    expect(digest).toBe(checksumCanonicalMarkdown(crlf));
    expect(digest).toBe(checksumCanonicalMarkdown(cr));
    expect(digest).toBe(sha256Hex("hello\nworld"));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not trim or rewrite surrounding whitespace", () => {
    const padded = "  keep spaces  \n";
    expect(checksumCanonicalMarkdown(padded)).toBe(sha256Hex(padded));
    expect(checksumCanonicalMarkdown(padded)).not.toBe(
      checksumCanonicalMarkdown(padded.trim()),
    );
  });
});

describe("checksumSections", () => {
  const base: ChecksumSectionInput[] = [
    {
      ordinal: 1,
      section_key: "sec_a",
      heading: "Alpha",
      section_type: "section",
      body_markdown: "line one\nline two",
    },
    {
      ordinal: 2,
      section_key: "sec_b",
      heading: "Beta",
      section_type: "section",
      body_markdown: "body",
    },
  ];

  it("hashes ordered tuples with fixed key order after line-ending normalization", () => {
    const withCrlf: ChecksumSectionInput[] = [
      {
        ...base[0],
        heading: "Alpha\r\n",
        body_markdown: "line one\r\nline two",
      },
      base[1],
    ];

    const expectedPayload = JSON.stringify([
      {
        ordinal: 1,
        section_key: "sec_a",
        heading: "Alpha\n",
        section_type: "section",
        body_markdown: "line one\nline two",
      },
      {
        ordinal: 2,
        section_key: "sec_b",
        heading: "Beta",
        section_type: "section",
        body_markdown: "body",
      },
    ]);

    const digest = checksumSections(withCrlf);
    expect(digest).toBe(checksumSections(base.map((section) => ({
      ...section,
      heading: section.heading === "Alpha" ? "Alpha\n" : section.heading,
    }))));
    expect(digest).toBe(sha256Hex(expectedPayload));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes digest when ordinal, heading, type, key, or body changes", () => {
    const original = checksumSections(base);

    expect(
      checksumSections([{ ...base[0], ordinal: 9 }, base[1]]),
    ).not.toBe(original);
    expect(
      checksumSections([{ ...base[0], heading: "Changed" }, base[1]]),
    ).not.toBe(original);
    expect(
      checksumSections([{ ...base[0], section_type: "aside" }, base[1]]),
    ).not.toBe(original);
    expect(
      checksumSections([{ ...base[0], section_key: "other" }, base[1]]),
    ).not.toBe(original);
    expect(
      checksumSections([{ ...base[0], body_markdown: "different" }, base[1]]),
    ).not.toBe(original);
  });
});
