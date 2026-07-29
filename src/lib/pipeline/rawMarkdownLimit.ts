/** Keep canonical-builder prompts under slow gateway limits (e.g. Cloudflare ~100s). */
export const CANONICAL_LLM_RAW_MARKDOWN_MAX_CHARS = 12_000;

/** Max canonical_markdown sent to quiz/flashcard generators. */
export const GENERATOR_LLM_CANONICAL_MARKDOWN_MAX_CHARS = 24_000;

/** Max chars stored in Postgres for raw_markdown (canonicalize reads from DB). */
export const RAW_MARKDOWN_MAX_CHARS = 120_000;

export function truncateRawMarkdown(rawMarkdown: string): {
  markdown: string;
  truncated: boolean;
  warnings: string[];
} {
  return truncateRawMarkdownToMax(rawMarkdown, RAW_MARKDOWN_MAX_CHARS);
}

export function truncateRawMarkdownToMax(
  rawMarkdown: string,
  maxChars: number,
): {
  markdown: string;
  truncated: boolean;
  warnings: string[];
} {
  if (rawMarkdown.length <= maxChars) {
    return { markdown: rawMarkdown, truncated: false, warnings: [] };
  }
  return {
    markdown: rawMarkdown.slice(0, maxChars),
    truncated: true,
    warnings: [
      `raw_markdown truncated from ${rawMarkdown.length} to ${maxChars} characters`,
    ],
  };
}
