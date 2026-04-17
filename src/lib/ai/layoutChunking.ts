import {
  CHUNK_HARD_MAX,
  CHUNK_SOFT_MIN,
  CHUNK_SOFT_TARGET,
} from "@/lib/ai/chunkText";
import type { ExtractPdfLayoutBlocksPage } from "@/lib/pdf/extractPdfLayoutBlocks";
import type { PdfLayoutBlock } from "@/lib/pdf/layoutBlocksFromTextLayer";

export type LayoutQuizChunk = {
  chunkText: string;
  sourcePageIndices: number[];
  blockCount: number;
};

export type LayoutChunkingOptions = {
  softTargetChars: number;
  softMinChars: number;
  hardMaxChars: number;
  allowCrossPageMerge: boolean;
};

const DEFAULT_OPTS: LayoutChunkingOptions = {
  softTargetChars: CHUNK_SOFT_TARGET,
  softMinChars: CHUNK_SOFT_MIN,
  hardMaxChars: CHUNK_HARD_MAX,
  allowCrossPageMerge: false,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeChunkText(s: string): string {
  return s.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function lastBreakableIndex(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i];
    if (c === " " || c === "\n" || c === "\t") return i;
  }
  return -1;
}

function hardSliceText(text: string, hardMax: number, softMin: number): string[] {
  const t = text.trim();
  if (t.length === 0) return [];
  if (t.length <= hardMax) return [t];

  const parts: string[] = [];
  let remaining = t;
  while (remaining.length > hardMax) {
    const window = remaining.slice(0, hardMax);
    let cut = hardMax;
    const br = lastBreakableIndex(window);
    if (br >= softMin) {
      cut = br + 1;
    }
    const piece = remaining.slice(0, cut).trimEnd();
    if (piece.length > 0) parts.push(piece);
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}

function pagesFromBlocksInput(pages: readonly ExtractPdfLayoutBlocksPage[]): ExtractPdfLayoutBlocksPage[] {
  // Defensive copy + deterministic ordering.
  return Array.from(pages).slice().sort((a, b) => a.pageIndex1 - b.pageIndex1);
}

function blocksForPage(p: ExtractPdfLayoutBlocksPage): PdfLayoutBlock[] {
  return p.blocks.filter((b) => b.text.trim().length > 0);
}

/**
 * Convert page-level layout blocks into AI-ready chunk strings, carrying provenance.
 *
 * Default policy:
 * - Usually one block per chunk.
 * - Merge adjacent short blocks on the same page until reaching a soft size target.
 * - If a single block exceeds the hard max, slice it deterministically.
 */
export function layoutBlocksToQuizChunks(
  pages: readonly ExtractPdfLayoutBlocksPage[],
  opts?: Partial<LayoutChunkingOptions>,
): LayoutQuizChunk[] {
  const o: LayoutChunkingOptions = { ...DEFAULT_OPTS, ...(opts ?? {}) };
  const hardMax = Math.max(200, Math.floor(o.hardMaxChars));
  const softTarget = clamp(Math.floor(o.softTargetChars), 1, hardMax);
  const softMin = clamp(Math.floor(o.softMinChars), 1, softTarget);

  const out: LayoutQuizChunk[] = [];

  const sortedPages = pagesFromBlocksInput(pages);
  for (let pi = 0; pi < sortedPages.length; pi++) {
    const page = sortedPages[pi]!;
    const pageIndex1 = page.pageIndex1;
    const blocks = blocksForPage(page);

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi]!;
      const blockText = normalizeChunkText(block.text);
      if (blockText.length === 0) continue;

      if (blockText.length > hardMax) {
        const parts = hardSliceText(blockText, hardMax, softMin);
        for (const part of parts) {
          out.push({
            chunkText: part,
            sourcePageIndices: [pageIndex1],
            blockCount: 1,
          });
        }
        continue;
      }

      let chunkText = blockText;
      let blockCount = 1;
      const pagesInChunk = new Set<number>([pageIndex1]);

      while (chunkText.length < softMin) {
        const nextBlock = blocks[bi + 1];
        if (!nextBlock) break;

        const nextText = normalizeChunkText(nextBlock.text);
        if (nextText.length === 0) {
          bi++;
          continue;
        }

        const nextPageIndex1 = pageIndex1;
        if (!o.allowCrossPageMerge && nextPageIndex1 !== pageIndex1) break;

        const candidate = normalizeChunkText(`${chunkText}\n\n${nextText}`);
        if (candidate.length > hardMax) break;

        chunkText = candidate;
        blockCount++;
        pagesInChunk.add(nextPageIndex1);
        bi++;

        if (chunkText.length >= softTarget) break;
      }

      out.push({
        chunkText,
        sourcePageIndices: Array.from(pagesInChunk).sort((a, b) => a - b),
        blockCount,
      });
    }
  }

  return out;
}

