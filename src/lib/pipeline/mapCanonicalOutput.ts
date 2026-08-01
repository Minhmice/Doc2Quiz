import type { CanonicalBuilderOutput } from "@/lib/pipeline/canonicalSchemas";

type CanonicalMetadata = Record<string, unknown> & {
  prompt_version?: string;
  title?: string;
  clean_filename?: string;
  language?: string;
  content_type?: string;
  topics?: string[];
  extracted_questions?: CanonicalBuilderOutput["extracted_questions"];
  atomic_facts?: CanonicalBuilderOutput["atomic_facts"];
  source_readiness?: CanonicalBuilderOutput["source_readiness"];
  max_supported_count?: number;
  warnings?: string[];
  canonicalization_status?: "ok" | "failed";
  canonicalization_error?: string | null;
  canonicalization_mode?: "ai" | "heuristic";
  canonicalization_upstream_error?: string | null;
};

export function mapCanonicalOutputToMetadata(
  output: CanonicalBuilderOutput,
  existing: CanonicalMetadata,
  extraWarnings: string[],
  canonicalization: {
    mode: "ai" | "heuristic";
    upstreamError: string | null;
  },
): CanonicalMetadata {
  return {
    ...existing,
    title: output.title,
    clean_filename: output.filename,
    language: output.language,
    content_type: output.document_type,
    topics: output.topics,
    extracted_questions: output.extracted_questions,
    atomic_facts: output.atomic_facts,
    source_readiness: output.source_readiness,
    max_supported_count: output.max_supported_count,
    warnings: [
      ...new Set([
        ...(existing.warnings ?? []),
        ...output.warnings,
        ...extraWarnings,
      ]),
    ],
    prompt_version: "1.0",
    canonicalization_status: "ok",
    canonicalization_error: null,
    canonicalization_mode: canonicalization.mode,
    canonicalization_upstream_error: canonicalization.upstreamError,
  };
}

export function mapCanonicalOutputToSections(
  output: CanonicalBuilderOutput,
  params: { userId: string; documentId: string },
) {
  return output.sections.map((section, index) => ({
    user_id: params.userId,
    canonical_document_id: params.documentId,
    ordinal: index + 1,
    heading: section.title,
    body_markdown: section.content,
    section_type: section.content_type,
    section_key: section.id,
  }));
}
