import { createHash } from "node:crypto";

export type ChecksumSectionInput = {
  ordinal: number;
  section_key: string | null;
  heading: string | null;
  section_type: string | null;
  body_markdown: string;
};

/** Normalize CRLF/CR to LF only; never trim or rewrite other whitespace. */
export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256Utf8Hex(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

/**
 * SHA-256 of UTF-8 canonical markdown after CRLF/CR → LF only.
 * No trim. Lowercase hex. Provenance/model/settings are never included.
 */
export function checksumCanonicalMarkdown(markdown: string): string {
  return sha256Utf8Hex(normalizeLineEndings(markdown));
}

/**
 * SHA-256 of JSON.stringify of ordered section tuples with fixed key order:
 * ordinal, section_key, heading, section_type, body_markdown.
 * Line endings normalized in every string field.
 */
export function checksumSections(sections: ChecksumSectionInput[]): string {
  const tuples = sections.map((section) => ({
    ordinal: section.ordinal,
    section_key:
      section.section_key == null
        ? null
        : normalizeLineEndings(section.section_key),
    heading:
      section.heading == null ? null : normalizeLineEndings(section.heading),
    section_type:
      section.section_type == null
        ? null
        : normalizeLineEndings(section.section_type),
    body_markdown: normalizeLineEndings(section.body_markdown),
  }));

  return sha256Utf8Hex(JSON.stringify(tuples));
}
