/**
 * Split a MCQ stem/option string into alternating plain text and TeX fragments.
 *
 * Rules (v1):
 * 1. **Display math first:** scan for `$$ ... $$` (non-greedy). Inner content becomes
 *    `{ kind: "math", display: true }`. Unclosed `$$` leaves the rest as plain text.
 * 2. **Inline math:** within each plain-text segment, find `$ ... $` pairs where the
 *    opening `$` is not followed by a second `$`. Inner becomes `{ kind: "math", display: false }`.
 *    A lone `$` with no closing `$` is treated as plain text (no throw).
 * 3. Adjacent plain-text pieces are merged to keep arrays short.
 */

export type MathSegment = {
  kind: "text" | "math";
  value: string;
  display?: boolean;
};

function mergeTextChunks(chunks: MathSegment[]): MathSegment[] {
  const out: MathSegment[] = [];
  for (const c of chunks) {
    if (c.kind === "text" && c.value === "") {
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === "text" && c.kind === "text") {
      last.value += c.value;
    } else {
      out.push({ ...c });
    }
  }
  return out.length > 0 ? out : [{ kind: "text", value: "" }];
}

function splitInlineSegment(segment: string): MathSegment[] {
  const parts: MathSegment[] = [];
  let i = 0;
  while (i < segment.length) {
    const open = segment.indexOf("$", i);
    if (open === -1) {
      parts.push({ kind: "text", value: segment.slice(i) });
      break;
    }
    if (open > i) {
      parts.push({ kind: "text", value: segment.slice(i, open) });
    }
    if (open + 1 < segment.length && segment[open + 1] === "$") {
      parts.push({ kind: "text", value: "$" });
      i = open + 1;
      continue;
    }
    const close = segment.indexOf("$", open + 1);
    if (close === -1) {
      parts.push({ kind: "text", value: segment.slice(open) });
      break;
    }
    parts.push({
      kind: "math",
      value: segment.slice(open + 1, close),
      display: false,
    });
    i = close + 1;
  }
  return mergeTextChunks(parts);
}

export function splitMathSegments(input: string): MathSegment[] {
  const chunks: MathSegment[] = [];
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf("$$", cursor);
    if (open === -1) {
      chunks.push(...splitInlineSegment(input.slice(cursor)));
      break;
    }
    if (open > cursor) {
      chunks.push(...splitInlineSegment(input.slice(cursor, open)));
    }
    const close = input.indexOf("$$", open + 2);
    if (close === -1) {
      chunks.push({ kind: "text", value: input.slice(open) });
      break;
    }
    chunks.push({
      kind: "math",
      value: input.slice(open + 2, close).trim(),
      display: true,
    });
    cursor = close + 2;
  }
  return mergeTextChunks(chunks);
}
