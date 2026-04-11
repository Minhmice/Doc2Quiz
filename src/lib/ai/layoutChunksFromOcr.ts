import type { LayoutChunk, OcrBlock, OcrPageResult, OcrRunResult } from "@/types/ocr";

/** Trim and collapse excessive blank lines before model calls (token hygiene). */
export function normalizeChunkTextForModel(s: string): string {
  return s.trim().replace(/\n{2,}/g, "\n");
}

/** Heuristics for “new question” boundaries in OCR block text (first line). */
export const QUESTION_START_REGEXES: RegExp[] = [
  /^\s*Câu\s*\d+/i,
  /^\s*\d+\s*[.)]/,
  /^\s*Question\s*\d+/i,
];

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] ?? "";
}

function blockStartsQuestion(text: string): boolean {
  const line = firstLine(text);
  return QUESTION_START_REGEXES.some((re) => re.test(line));
}

function bboxCenter(block: OcrBlock): { cx: number; cy: number } | null {
  const b = block.bbox;
  if (!b || b.space !== "relative") {
    return null;
  }
  const { x, y, width, height } = b;
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  return { cx: x + width / 2, cy: y + height / 2 };
}

function sortedBlockIndices(page: OcrPageResult): number[] {
  const indices = page.blocks.map((_, i) => i);
  const withBbox: number[] = [];
  const withoutBbox: number[] = [];
  for (const i of indices) {
    if (bboxCenter(page.blocks[i]!) !== null) {
      withBbox.push(i);
    } else {
      withoutBbox.push(i);
    }
  }
  withBbox.sort((ai, bi) => {
    const ca = bboxCenter(page.blocks[ai]!)!;
    const cb = bboxCenter(page.blocks[bi]!)!;
    if (ca.cy !== cb.cy) {
      return ca.cy - cb.cy;
    }
    return ca.cx - cb.cx;
  });
  return [...withBbox, ...withoutBbox];
}

function makeChunk(
  pageIndex: number,
  seq: number,
  indices: number[],
  page: OcrPageResult,
): LayoutChunk {
  const texts = indices
    .map((i) => page.blocks[i]?.text ?? "")
    .filter((t) => t.trim().length > 0);
  const rawJoined = texts.join("\n\n");
  return {
    id: `p${pageIndex}-c${seq}`,
    pageIndex,
    text: normalizeChunkTextForModel(rawJoined),
    blockIndices: indices,
  };
}

function chunkPage(page: OcrPageResult): LayoutChunk[] {
  const order = sortedBlockIndices(page);
  if (order.length === 0) {
    return [];
  }

  let hadBoundarySplit = false;
  const rawChunks: { indices: number[] }[] = [];
  let cur: number[] = [];
  for (const bi of order) {
    const block = page.blocks[bi]!;
    if (cur.length > 0 && blockStartsQuestion(block.text)) {
      hadBoundarySplit = true;
      rawChunks.push({ indices: cur });
      cur = [];
    }
    cur.push(bi);
  }
  if (cur.length > 0) {
    rawChunks.push({ indices: cur });
  }

  if (!hadBoundarySplit && order.length > 1) {
    const chunks: LayoutChunk[] = [];
    let seq = 0;
    for (let i = 0; i < order.length; ) {
      const take = Math.min(3, order.length - i);
      const indices = order.slice(i, i + take);
      chunks.push(makeChunk(page.pageIndex, seq++, indices, page));
      i += take;
    }
    return chunks;
  }

  return rawChunks.map((c, seq) =>
    makeChunk(page.pageIndex, seq, c.indices, page),
  );
}

export function buildLayoutChunksFromRun(run: OcrRunResult): LayoutChunk[] {
  const out: LayoutChunk[] = [];
  for (const page of run.pages) {
    out.push(...chunkPage(page));
  }
  return out;
}

export function buildSpatialHintLine(
  page: OcrPageResult,
  chunk: LayoutChunk,
): string | undefined {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (const bi of chunk.blockIndices) {
    const b = page.blocks[bi]?.bbox;
    if (!b || b.space !== "relative") {
      continue;
    }
    any = true;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!any) {
    return undefined;
  }
  return `Layout hint: chunk spans relative box x=${minX.toFixed(3)}–${maxX.toFixed(3)} y=${minY.toFixed(3)}–${maxY.toFixed(3)} (0–1 page coords).`;
}

/**
 * User message for single-chunk MCQ extraction (OCR text + optional bbox hint).
 * Spatial hint is omitted when no chunk block has a usable relative bbox (D-21).
 */
export function buildChunkUserContent(run: OcrRunResult, chunk: LayoutChunk): string {
  const page = run.pages.find((p) => p.pageIndex === chunk.pageIndex);
  const hint = page ? buildSpatialHintLine(page, chunk) : undefined;
  const parts = [
    `OCR text chunk (page ${chunk.pageIndex}):\n---\n${chunk.text}\n---`,
  ];
  if (hint) {
    parts.push(hint);
  }
  return parts.join("\n\n");
}

export function nextBlockIndexInPageOrder(
  page: OcrPageResult,
  chunk: LayoutChunk,
): number | null {
  const order = sortedBlockIndices(page);
  const maxIdx = Math.max(...chunk.blockIndices);
  const pos = order.findIndex((i) => i === maxIdx);
  if (pos === -1 || pos + 1 >= order.length) {
    return null;
  }
  return order[pos + 1] ?? null;
}

export function expandChunkText(
  run: OcrRunResult,
  chunk: LayoutChunk,
): string | null {
  const page = run.pages.find((p) => p.pageIndex === chunk.pageIndex);
  if (!page) {
    return null;
  }
  const next = nextBlockIndexInPageOrder(page, chunk);
  if (next === null) {
    return null;
  }
  const extra = page.blocks[next]?.text?.trim() ?? "";
  if (!extra) {
    return null;
  }
  return normalizeChunkTextForModel(`${chunk.text}\n\n${extra}`);
}
