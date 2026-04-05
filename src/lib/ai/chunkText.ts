/**
 * Deterministic chunking for AI parsing (AI-02, D-08–D-09).
 * Consumers must process chunks sequentially only — no parallel batching in v1 (D-10).
 */

export const CHUNK_SOFT_TARGET = 1000;
export const CHUNK_HARD_MAX = 1200;
export const CHUNK_SOFT_MIN = 800;

const PARA_SEP = "\n\n";

function splitParagraphs(normalized: string): string[] {
  return normalized
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Last index of a break-friendly whitespace in `s`, or -1. */
function lastBreakableIndex(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === " " || c === "\n" || c === "\t") {
      return i;
    }
  }
  return -1;
}

/**
 * Split a paragraph longer than CHUNK_HARD_MAX into segments ≤ CHUNK_HARD_MAX,
 * preferring breaks at whitespace when a segment can stay ≥ CHUNK_SOFT_MIN (D-09).
 */
function hardSliceLongParagraph(para: string): string[] {
  if (para.length <= CHUNK_HARD_MAX) {
    return [para];
  }

  const parts: string[] = [];
  let remaining = para;

  while (remaining.length > CHUNK_HARD_MAX) {
    const window = remaining.slice(0, CHUNK_HARD_MAX);
    let cut = CHUNK_HARD_MAX;
    const br = lastBreakableIndex(window);
    if (br >= CHUNK_SOFT_MIN) {
      cut = br + 1;
    }
    const piece = remaining.slice(0, cut).trimEnd();
    if (piece.length > 0) {
      parts.push(piece);
    }
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

/**
 * Split extracted document text into chunks for sequential API calls.
 * Does not mutate `fullText`.
 */
export function chunkText(fullText: string): string[] {
  const text = fullText.trim();
  if (text.length === 0) {
    return [];
  }

  const paragraphs = splitParagraphs(text);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
  };

  for (const para of paragraphs) {
    if (para.length > CHUNK_HARD_MAX) {
      flush();
      chunks.push(...hardSliceLongParagraph(para));
      continue;
    }

    const candidate =
      current.length === 0 ? para : current + PARA_SEP + para;

    if (candidate.length > CHUNK_HARD_MAX) {
      flush();
      current = para;
    } else {
      current = candidate;
    }
  }

  flush();
  return chunks;
}
