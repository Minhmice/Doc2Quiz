const SECRET_KEY_PATTERN =
  /^(?:api[_-]?key|openai_api_key|authorization|secret|password|token|bearer|key)$/i;

export type CanonicalVersionSnapshotInput = {
  id: string;
  canonical_markdown: string;
  canonical_content_checksum: string;
  sections_checksum: string;
  metadata: Record<string, unknown>;
  model: string | null;
  prompt_version: string | null;
  parser_version: string | null;
  generator_settings: Record<string, unknown>;
  provenance: Record<string, unknown>;
};

export type SectionSnapshotInput = {
  ordinal: number;
  section_key: string | null;
  heading: string | null;
  section_type: string | null;
  body_markdown: string;
};

export type OutputSourceSnapshot = {
  canonical_version_id: string;
  ordinal: number;
  canonical_content_checksum: string;
  sections_checksum: string;
  canonical_markdown: string;
  sections: SectionSnapshotInput[];
  canonical_metadata: Record<string, unknown>;
  source_provenance: Record<string, unknown>;
};

/** Preserve first-ID order; drop later duplicates without reordering survivors. */
export function dedupeCanonicalVersionIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function scrubRecord(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubRecord);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key)) continue;
      result[key] = scrubRecord(nested);
    }
    return result;
  }
  return value;
}

/**
 * Model/prompt/parser/settings provenance for snapshots.
 * Never includes API keys or other secret-bearing fields.
 */
export function redactSourceProvenance(input: {
  model: string | null;
  prompt_version: string | null;
  parser_version: string | null;
  generator_settings: Record<string, unknown>;
  provenance: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    model: input.model,
    prompt_version: input.prompt_version,
    parser_version: input.parser_version,
    generator_settings: scrubRecord(input.generator_settings) as Record<
      string,
      unknown
    >,
    provenance: scrubRecord(input.provenance) as Record<string, unknown>,
  };
}

export function buildOutputSourceSnapshots(params: {
  orderedVersionIds: string[];
  versionsById: Map<string, CanonicalVersionSnapshotInput>;
  sectionsByVersionId: Map<string, SectionSnapshotInput[]>;
}): OutputSourceSnapshot[] {
  return params.orderedVersionIds.map((versionId, index) => {
    const version = params.versionsById.get(versionId);
    if (!version) {
      throw new Error(`Missing canonical version for snapshot: ${versionId}`);
    }
    const sections = params.sectionsByVersionId.get(versionId) ?? [];
    return {
      canonical_version_id: version.id,
      ordinal: index + 1,
      canonical_content_checksum: version.canonical_content_checksum,
      sections_checksum: version.sections_checksum,
      canonical_markdown: version.canonical_markdown,
      sections: sections.map((section) => ({
        ordinal: section.ordinal,
        section_key: section.section_key,
        heading: section.heading,
        section_type: section.section_type,
        body_markdown: section.body_markdown,
      })),
      canonical_metadata: { ...version.metadata },
      source_provenance: redactSourceProvenance({
        model: version.model,
        prompt_version: version.prompt_version,
        parser_version: version.parser_version,
        generator_settings: version.generator_settings,
        provenance: version.provenance,
      }),
    };
  });
}
