import { describe, expect, it } from "vitest";

import {
  buildOutputSourceSnapshots,
  dedupeCanonicalVersionIds,
  redactSourceProvenance,
  type CanonicalVersionSnapshotInput,
  type SectionSnapshotInput,
} from "./outputSnapshot";

const versionA: CanonicalVersionSnapshotInput = {
  id: "cv-a",
  canonical_markdown: "# A\n\nBody A.",
  canonical_content_checksum: "checksum-a-content",
  sections_checksum: "checksum-a-sections",
  metadata: { language: "en", atomic_facts: [] },
  model: "gpt-test",
  prompt_version: "1.0",
  parser_version: "1.0",
  generator_settings: { temperature: 0 },
  provenance: {
    mode: "ai",
    api_key: "sk-secret",
    openai_api_key: "should-strip",
  },
};

const versionB: CanonicalVersionSnapshotInput = {
  id: "cv-b",
  canonical_markdown: "# B\n\nBody B.",
  canonical_content_checksum: "checksum-b-content",
  sections_checksum: "checksum-b-sections",
  metadata: { language: "vi" },
  model: null,
  prompt_version: "1.0",
  parser_version: "1.0",
  generator_settings: {},
  provenance: { mode: "heuristic" },
};

const sectionsA: SectionSnapshotInput[] = [
  {
    ordinal: 1,
    section_key: "sec_a1",
    heading: "A",
    section_type: "theory",
    body_markdown: "Body A.",
  },
];

const sectionsB: SectionSnapshotInput[] = [
  {
    ordinal: 1,
    section_key: "sec_b1",
    heading: "B",
    section_type: "theory",
    body_markdown: "Body B.",
  },
  {
    ordinal: 2,
    section_key: "sec_b2",
    heading: "B2",
    section_type: "theory",
    body_markdown: "More B.",
  },
];

describe("dedupeCanonicalVersionIds", () => {
  it("preserves first-seen order and drops later duplicates", () => {
    expect(
      dedupeCanonicalVersionIds(["cv-b", "cv-a", "cv-b", "cv-a", "cv-c"]),
    ).toEqual(["cv-b", "cv-a", "cv-c"]);
  });

  it("returns empty array for empty input", () => {
    expect(dedupeCanonicalVersionIds([])).toEqual([]);
  });
});

describe("redactSourceProvenance", () => {
  it("keeps model/prompt/parser/settings and strips API key fields", () => {
    const redacted = redactSourceProvenance({
      model: "gpt-test",
      prompt_version: "1.0",
      parser_version: "1.0",
      generator_settings: { temperature: 0, apiKey: "x" },
      provenance: {
        mode: "ai",
        api_key: "sk-secret",
        authorization: "Bearer x",
        key: "secret",
      },
    });

    expect(redacted).toEqual({
      model: "gpt-test",
      prompt_version: "1.0",
      parser_version: "1.0",
      generator_settings: { temperature: 0 },
      provenance: { mode: "ai" },
    });
    expect(JSON.stringify(redacted)).not.toMatch(/sk-secret|api_key|apiKey|Bearer/i);
  });
});

describe("buildOutputSourceSnapshots", () => {
  it("builds frozen snapshots in declared selection order after dedupe", () => {
    const sectionsByVersionId = new Map<string, SectionSnapshotInput[]>([
      ["cv-a", sectionsA],
      ["cv-b", sectionsB],
    ]);

    const snapshots = buildOutputSourceSnapshots({
      orderedVersionIds: ["cv-b", "cv-a"],
      versionsById: new Map([
        ["cv-a", versionA],
        ["cv-b", versionB],
      ]),
      sectionsByVersionId,
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      canonical_version_id: "cv-b",
      ordinal: 1,
      canonical_content_checksum: "checksum-b-content",
      sections_checksum: "checksum-b-sections",
      canonical_markdown: "# B\n\nBody B.",
    });
    expect(snapshots[0]?.sections).toEqual(sectionsB);
    expect(snapshots[1]).toMatchObject({
      canonical_version_id: "cv-a",
      ordinal: 2,
      canonical_content_checksum: "checksum-a-content",
      sections_checksum: "checksum-a-sections",
    });
    expect(snapshots[1]?.sections).toEqual(sectionsA);
    expect(JSON.stringify(snapshots)).not.toMatch(/sk-secret|openai_api_key/i);
  });

  it("includes ordered sections and both checksums exactly", () => {
    const snapshots = buildOutputSourceSnapshots({
      orderedVersionIds: ["cv-a"],
      versionsById: new Map([["cv-a", versionA]]),
      sectionsByVersionId: new Map([["cv-a", sectionsA]]),
    });

    expect(snapshots[0]).toEqual({
      canonical_version_id: "cv-a",
      ordinal: 1,
      canonical_content_checksum: "checksum-a-content",
      sections_checksum: "checksum-a-sections",
      canonical_markdown: "# A\n\nBody A.",
      sections: sectionsA,
      canonical_metadata: { language: "en", atomic_facts: [] },
      source_provenance: {
        model: "gpt-test",
        prompt_version: "1.0",
        parser_version: "1.0",
        generator_settings: { temperature: 0 },
        provenance: { mode: "ai" },
      },
    });
  });
});
