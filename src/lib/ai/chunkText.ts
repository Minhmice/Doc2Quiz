/**
 * Deterministic chunking for AI parsing (AI-02, D-08–D-09).
 * Consumers must process chunks sequentially only — no parallel batching in v1 (D-10).
 */

export const CHUNK_SOFT_TARGET = 1000;
export const CHUNK_HARD_MAX = 1200;
export const CHUNK_SOFT_MIN = 800;

/** Chars from the end of chunk i prepended to chunk i+1 so cross-boundary MCQs stay in context (extra tokens). */
export const CHUNK_CONTEXT_OVERLAP = 520;

const PARA_SEP = "\n\n";
const OVERLAP_SEP = "\n\n";

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

function tailForOverlap(s: string, maxChars: number): string {
  if (maxChars <= 0 || s.length === 0) {
    return "";
  }
  if (s.length <= maxChars) {
    return s.trim();
  }
  return s.slice(-maxChars).trimStart();
}

/**
 * After base chunking, prepend each chunk with the tail of the previous chunk (raw slice, not recursively overlapped).
 */
export function applyChunkContextOverlap(
  baseChunks: string[],
  overlapChars: number = CHUNK_CONTEXT_OVERLAP,
): string[] {
  if (baseChunks.length <= 1 || overlapChars <= 0) {
    return baseChunks;
  }
  const out: string[] = [baseChunks[0]!];
  for (let i = 1; i < baseChunks.length; i++) {
    const prev = baseChunks[i - 1]!;
    const tail = tailForOverlap(prev, overlapChars);
    const cur = baseChunks[i]!;
    out.push(tail.length > 0 ? tail + OVERLAP_SEP + cur : cur);
  }
  return out;
}

function chunkTextWithoutOverlap(fullText: string): string[] {
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

/**
 * Split extracted document text into chunks for sequential API calls.
 * Chunks after the first include a tail of the previous chunk for cross-boundary MCQs.
 * Does not mutate `fullText`.
 */
export function chunkText(fullText: string): string[] {
  return applyChunkContextOverlap(chunkTextWithoutOverlap(fullText));
}
