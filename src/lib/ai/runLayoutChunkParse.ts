import { FatalParseError } from "@/lib/ai/errors";
import {
  buildChunkUserContent,
  buildLayoutChunksFromRun,
  expandChunkText,
} from "@/lib/ai/layoutChunksFromOcr";
import type { LayoutChunk, OcrRunResult } from "@/types/ocr";
import type { Question } from "@/types/question";

export type ChunkParseOutcome =
  | { ok: true; question: Question }
  | { ok: false; error: string };

export type ChunkParseResult = {
  layoutChunkId: string;
  pageIndex: number;
  outcome: ChunkParseOutcome;
  usedExpandedText: boolean;
};

export type RunLayoutChunkParseParams = {
  run: OcrRunResult;
  /** Defaults to `buildLayoutChunksFromRun(run)`. */
  chunks?: LayoutChunk[];
  /** Returns one question or null; should use text-only MCQ extraction. */
  parse: (userContent: string, signal: AbortSignal) => Promise<Question | null>;
  signal: AbortSignal;
  progress?: (done: number, total: number, pageIndex: number) => void;
  onChunkResult?: (r: ChunkParseResult) => void;
};

export function computeNeedsVisionFallback(
  run: OcrRunResult,
  chunks: LayoutChunk[],
  byChunk: ChunkParseResult[],
): boolean {
  const successByPage = new Map<number, boolean>();
  for (const r of byChunk) {
    if (r.outcome.ok) {
      successByPage.set(r.pageIndex, true);
    }
  }
  for (const p of run.pages) {
    if ((p.status ?? "success") === "failed") {
      return true;
    }
    const hasChunks = chunks.some((c) => c.pageIndex === p.pageIndex);
    if (!hasChunks) {
      return true;
    }
    if (!successByPage.get(p.pageIndex)) {
      return true;
    }
  }
  return false;
}

export async function runLayoutChunkParse(
  params: RunLayoutChunkParseParams,
): Promise<{
  questions: Question[];
  byChunk: ChunkParseResult[];
  needsVisionFallback: boolean;
}> {
  const { run, chunks: chunksIn, parse, signal, progress, onChunkResult } =
    params;
  const chunks = chunksIn ?? buildLayoutChunksFromRun(run);
  const byChunk: ChunkParseResult[] = [];
  const questions: Question[] = [];
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (!chunk.text.trim()) {
      const result: ChunkParseResult = {
        layoutChunkId: chunk.id,
        pageIndex: chunk.pageIndex,
        outcome: { ok: false, error: "empty chunk" },
        usedExpandedText: false,
      };
      byChunk.push(result);
      onChunkResult?.(result);
      progress?.(i + 1, total, chunk.pageIndex);
      continue;
    }

    let usedExpanded = false;
    let userContent = buildChunkUserContent(run, chunk);
    let outcome: ChunkParseOutcome;

    try {
      let q = await parse(userContent, signal);
      if (!q) {
        const expanded = expandChunkText(run, chunk);
        if (expanded) {
          usedExpanded = true;
          const expandedChunk: LayoutChunk = { ...chunk, text: expanded };
          userContent = buildChunkUserContent(run, expandedChunk);
          q = await parse(userContent, signal);
        }
      }
      if (!q) {
        outcome = { ok: false, error: "no MCQ in model output" };
      } else {
        q.sourcePageIndex = chunk.pageIndex;
        q.layoutChunkId = chunk.id;
        q.parseConfidence = 0.88;
        q.parseStructureValid = true;
        outcome = { ok: true, question: q };
        questions.push(q);
      }
    } catch (e) {
      if (e instanceof FatalParseError) {
        throw e;
      }
      outcome = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }

    const result: ChunkParseResult = {
      layoutChunkId: chunk.id,
      pageIndex: chunk.pageIndex,
      outcome,
      usedExpandedText: usedExpanded,
    };
    byChunk.push(result);
    onChunkResult?.(result);
    progress?.(i + 1, total, chunk.pageIndex);
  }

  const needsVisionFallback = computeNeedsVisionFallback(run, chunks, byChunk);
  return { questions, byChunk, needsVisionFallback };
}
