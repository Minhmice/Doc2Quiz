export type PdfTextItem = {
  pageIndex: number;
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontName?: string;
  hasEOL?: boolean;
};

export type PdfTextLine = {
  items: PdfTextItem[];
  text: string;
  bbox: Bbox;
  hasExplicitEOL: boolean;
};

export type PdfLayoutBlock = {
  pageIndex: number;
  lines: PdfTextLine[];
  text: string;
  bbox: Bbox;
};

export type BuildLayoutBlocksOptions = {
  /**
   * Baseline proximity tolerance when grouping items into a line (viewport units).
   * Keep conservative: too small splits lines; too large merges adjacent lines.
   */
  lineMergeToleranceY: number;
  /**
   * A vertical gap between consecutive lines larger than this starts a new block.
   */
  paragraphGapThreshold: number;
  /**
   * If a line ends with an explicit `hasEOL`, a smaller gap can still start a new block.
   */
  eolParagraphGapThreshold: number;
  /**
   * Upper bound on the number of text items processed per page to avoid pathological PDFs.
   */
  maxItemsPerPage: number;
  /**
   * When joining items in a line, treat a gap larger than this as a word boundary.
   */
  wordGapThreshold: number;
};

export type BuildLayoutBlocksResult = {
  itemCount: number;
  truncated: boolean;
  lines: PdfTextLine[];
  blocks: PdfLayoutBlock[];
};

export type Bbox = { x0: number; y0: number; x1: number; y1: number };

const DEFAULT_OPTS: BuildLayoutBlocksOptions = {
  lineMergeToleranceY: 2.2,
  paragraphGapThreshold: 10,
  eolParagraphGapThreshold: 5.5,
  maxItemsPerPage: 20000,
  wordGapThreshold: 1.6,
};

type PdfJsTextItemLike = {
  str?: unknown;
  hasEOL?: unknown;
  fontName?: unknown;
  transform?: unknown;
  width?: unknown;
  height?: unknown;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clampOpts(opts?: Partial<BuildLayoutBlocksOptions>): BuildLayoutBlocksOptions {
  const o = { ...DEFAULT_OPTS, ...(opts ?? {}) };
  return {
    lineMergeToleranceY: Math.max(0.1, o.lineMergeToleranceY),
    paragraphGapThreshold: Math.max(0.1, o.paragraphGapThreshold),
    eolParagraphGapThreshold: Math.max(0.1, Math.min(o.eolParagraphGapThreshold, o.paragraphGapThreshold)),
    maxItemsPerPage: Math.max(1, Math.floor(o.maxItemsPerPage)),
    wordGapThreshold: Math.max(0, o.wordGapThreshold),
  };
}

function emptyBbox(): Bbox {
  return { x0: Number.POSITIVE_INFINITY, y0: Number.POSITIVE_INFINITY, x1: Number.NEGATIVE_INFINITY, y1: Number.NEGATIVE_INFINITY };
}

function extendBbox(b: Bbox, x0: number, y0: number, x1: number, y1: number): void {
  if (x0 < b.x0) b.x0 = x0;
  if (y0 < b.y0) b.y0 = y0;
  if (x1 > b.x1) b.x1 = x1;
  if (y1 > b.y1) b.y1 = y1;
}

function finalizeBbox(b: Bbox): Bbox {
  if (!Number.isFinite(b.x0) || !Number.isFinite(b.y0) || !Number.isFinite(b.x1) || !Number.isFinite(b.y1)) {
    return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  return b;
}

function mergeBboxes(bs: Bbox[]): Bbox {
  const out = emptyBbox();
  for (const b of bs) {
    extendBbox(out, b.x0, b.y0, b.x1, b.y1);
  }
  return finalizeBbox(out);
}

function normalizeWhitespace(s: string): string {
  // Keep newlines (line/block boundaries) but normalize intra-line spaces.
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

function multMatrix(a: readonly number[], b: readonly number[]): number[] | null {
  // 2D affine transform matrices [a,b,c,d,e,f]
  if (a.length !== 6 || b.length !== 6) return null;
  const [a0, a1, a2, a3, a4, a5] = a;
  const [b0, b1, b2, b3, b4, b5] = b;
  if (![a0, a1, a2, a3, a4, a5, b0, b1, b2, b3, b4, b5].every((n) => Number.isFinite(n))) return null;
  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ];
}

/**
 * Convert pdf.js `textContent.items` into normalized `PdfTextItem`s using:
 * viewportTransform(scale=1) × item.transform.
 *
 * The output is deterministic for the same input arrays.
 */
export function pdfjsTextContentItemsToPdfTextItems(args: {
  pageIndex: number;
  items: readonly unknown[];
  viewportTransform: readonly number[];
  maxItems?: number;
}): { items: PdfTextItem[]; truncated: boolean; itemCount: number } {
  const pageIndex = args.pageIndex;
  const maxItems = Math.max(1, Math.floor(args.maxItems ?? DEFAULT_OPTS.maxItemsPerPage));
  const viewport = Array.from(args.viewportTransform);

  const rawItems = Array.from(args.items);
  const itemCount = rawItems.length;
  const truncated = rawItems.length > maxItems;
  const slice = truncated ? rawItems.slice(0, maxItems) : rawItems;

  const out: PdfTextItem[] = [];
  for (let idx = 0; idx < slice.length; idx++) {
    const raw = slice[idx];
    if (!raw || typeof raw !== "object") continue;
    const r = raw as PdfJsTextItemLike;
    if (typeof r.str !== "string") continue;
    const str = r.str;
    if (str.trim().length === 0) continue;

    const transform = Array.isArray(r.transform) ? (r.transform as unknown[]) : null;
    const m = transform && transform.length === 6 ? multMatrix(viewport, transform as number[]) : null;
    const x = isFiniteNumber(m?.[4]) ? (m![4] as number) : 0;
    const y = isFiniteNumber(m?.[5]) ? (m![5] as number) : 0;

    const width = isFiniteNumber(r.width) ? r.width : 0;
    const height = isFiniteNumber(r.height) ? r.height : 0;
    const sx = m ? Math.hypot(m[0]!, m[1]!) : 1;
    const sy = m ? Math.hypot(m[2]!, m[3]!) : 1;
    const w = Math.max(0, width * sx);
    const h = Math.max(0, height * sy);

    out.push({
      pageIndex,
      str,
      x,
      y,
      w,
      h,
      fontName: typeof r.fontName === "string" ? r.fontName : undefined,
      hasEOL: typeof r.hasEOL === "boolean" ? r.hasEOL : undefined,
    });
  }

  return { items: out, truncated, itemCount };
}

type NormalizedItem = PdfTextItem & { __idx: number };

function itemBbox(it: PdfTextItem): Bbox {
  const x0 = it.x;
  const y0 = it.y;
  const x1 = it.x + (isFiniteNumber(it.w) ? it.w : 0);
  const y1 = it.y + (isFiniteNumber(it.h) ? it.h : 0);
  const b = emptyBbox();
  extendBbox(b, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1));
  return finalizeBbox(b);
}

function buildLineText(items: PdfTextItem[], wordGapThreshold: number): string {
  if (items.length === 0) return "";
  const parts: string[] = [];
  let prev: PdfTextItem | null = null;
  for (const it of items) {
    const s = it.str.trim();
    if (s.length === 0) continue;
    if (!prev) {
      parts.push(s);
      prev = it;
      continue;
    }
    const prevRight = prev.x + prev.w;
    const gap = it.x - prevRight;
    const needsSpace = gap > wordGapThreshold && !parts[parts.length - 1]!.endsWith("-");
    const last = parts[parts.length - 1]!;
    parts[parts.length - 1] = needsSpace ? `${last} ${s}` : `${last}${s}`;
    prev = it;
  }
  return normalizeWhitespace(parts.join(""));
}

function buildLines(sorted: NormalizedItem[], opts: BuildLayoutBlocksOptions): PdfTextLine[] {
  const lines: PdfTextLine[] = [];
  let current: NormalizedItem[] = [];
  let currentY: number | null = null;

  const flush = () => {
    if (current.length === 0) return;
    current.sort((a, b) => (a.x - b.x) || (a.__idx - b.__idx));
    const bbox = mergeBboxes(current.map(itemBbox));
    const text = buildLineText(current, opts.wordGapThreshold);
    const hasExplicitEOL = current.some((it) => it.hasEOL === true);
    lines.push({ items: current, text, bbox, hasExplicitEOL });
    current = [];
    currentY = null;
  };

  for (const it of sorted) {
    if (current.length === 0) {
      current.push(it);
      currentY = it.y;
      continue;
    }
    const y = it.y;
    const within = currentY !== null && Math.abs(y - currentY) <= opts.lineMergeToleranceY;
    if (!within) {
      flush();
      current.push(it);
      currentY = it.y;
      continue;
    }
    // keep Y stable by a running median-ish update (deterministic).
    current.push(it);
    currentY = (currentY! * (current.length - 1) + it.y) / current.length;
  }
  flush();

  // Deterministic ordering: top-to-bottom, then left-to-right.
  lines.sort((a, b) => (b.bbox.y1 - a.bbox.y1) || (a.bbox.x0 - b.bbox.x0));
  return lines;
}

function verticalGapBetween(prev: PdfTextLine, next: PdfTextLine): number {
  // With lines sorted top-to-bottom, a positive value means "space" between prev bottom and next top.
  return prev.bbox.y0 - next.bbox.y1;
}

function buildBlocks(lines: PdfTextLine[], pageIndex: number, opts: BuildLayoutBlocksOptions): PdfLayoutBlock[] {
  const blocks: PdfLayoutBlock[] = [];
  let cur: PdfTextLine[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    const bbox = mergeBboxes(cur.map((l) => l.bbox));
    const text = normalizeWhitespace(cur.map((l) => l.text).filter((t) => t.length > 0).join("\n"));
    blocks.push({ pageIndex, lines: cur, text, bbox });
    cur = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (cur.length === 0) {
      cur.push(line);
      continue;
    }
    const prev = cur[cur.length - 1]!;
    const gap = verticalGapBetween(prev, line);
    const shouldBreak =
      gap > opts.paragraphGapThreshold ||
      (prev.hasExplicitEOL && gap > opts.eolParagraphGapThreshold);
    if (shouldBreak) {
      flush();
      cur.push(line);
    } else {
      cur.push(line);
    }
  }
  flush();

  return blocks.filter((b) => b.text.trim().length > 0);
}

/**
 * Deterministic geometry-driven builder: items → lines → blocks.
 *
 * This function is pure given `items` and `options`.
 */
export function layoutBlocksFromTextLayer(
  items: readonly PdfTextItem[],
  options?: Partial<BuildLayoutBlocksOptions>,
): BuildLayoutBlocksResult {
  const opts = clampOpts(options);
  const itemCount = items.length;
  const truncated = itemCount > opts.maxItemsPerPage;

  const normalized: NormalizedItem[] = [];
  const take = truncated ? items.slice(0, opts.maxItemsPerPage) : items;
  for (let i = 0; i < take.length; i++) {
    const it = take[i]!;
    const s = it.str;
    if (typeof s !== "string") continue;
    if (s.trim().length === 0) continue;
    normalized.push({ ...it, __idx: i });
  }

  // Stable sort key: y desc, x asc, then original index.
  normalized.sort((a, b) => (b.y - a.y) || (a.x - b.x) || (a.__idx - b.__idx));

  const lines = buildLines(normalized, opts);
  const pageIndex = normalized.length > 0 ? normalized[0]!.pageIndex : (items[0]?.pageIndex ?? 0);
  const blocks = buildBlocks(lines, pageIndex, opts);

  return { itemCount, truncated, lines, blocks };
}

