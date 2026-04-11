import { FatalParseError } from "@/lib/ai/errors";
import {
  buildChunkUserContent,
  buildLayoutChunksFromRun,
  expandChunkText,
} from "@/lib/ai/layoutChunksFromOcr";
import { isPipelineVerbose, pipelineLog } from "@/lib/logging/pipelineLogger";
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
  /** D-27: sum of wall ms around each injected `parse()` for this chunk row */
  chunkAiWallMs: number;
  /** Count of `parse()` invocations (0 when empty chunk skipped AI) */
  parseAttempts: number;
  /** Optional: wall ms per `parse()` call in order */
  attemptWallMs?: number[];
};

export type RunLayoutChunkParseParams = {
  run: OcrRunResult;
  /** Defaults to `buildLayoutChunksFromRun(run)`. */
  chunks?: LayoutChunk[];
  /** Returns one question or null; should use text-only MCQ extraction. */
  parse: (
    userContent: string,
    signal: AbortSignal,
    trace?: { layoutChunkId: string },
  ) => Promise<Question | null>;
  signal: AbortSignal;
  progress?: (done: number, total: number, pageIndex: number) => void;
  onChunkResult?: (r: ChunkParseResult) => void;
  /** Optional: verbose pipelineLog context */
  studySetId?: string;
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
  const {
    run,
    chunks: chunksIn,
    parse,
    signal,
    progress,
    onChunkResult,
    studySetId,
  } = params;
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
        chunkAiWallMs: 0,
        parseAttempts: 0,
      };
      byChunk.push(result);
      onChunkResult?.(result);
      progress?.(i + 1, total, chunk.pageIndex);
      continue;
    }

    let usedExpanded = false;
    let userContent = buildChunkUserContent(run, chunk);
    let outcome: ChunkParseOutcome;
    const attemptWallMs: number[] = [];
    const trace = { layoutChunkId: chunk.id };

    const timedParse = async (content: string): Promise<Question | null> => {
      const t0 = performance.now();
      try {
        return await parse(content, signal, trace);
      } finally {
        attemptWallMs.push(performance.now() - t0);
      }
    };

    try {
      let q = await timedParse(userContent);
      if (!q) {
        const expanded = expandChunkText(run, chunk);
        if (expanded) {
          usedExpanded = true;
          const expandedChunk: LayoutChunk = { ...chunk, text: expanded };
          userContent = buildChunkUserContent(run, expandedChunk);
          q = await timedParse(userContent);
        }
      }
      if (!q) {
        outcome = { ok: false, error: "no MCQ in model output" };
      } else {
        q.sourcePageIndex = chunk.pageIndex;
        if (!q.layoutChunkId?.trim()) {
          q.layoutChunkId = chunk.id;
        }
        /*
         * D-25 parseConfidence (0..1): 1 when stem + all four options non-empty after
         * validation; 0.75 stem only; else 0.5 (should not occur for validated rows).
         */
        const stemOk = q.question.trim().length > 0;
        const optsOk = q.options.every((o) => o.trim().length > 0);
        const confidence = stemOk && optsOk ? 1 : stemOk ? 0.75 : 0.5;
        if (q.parseConfidence === undefined) {
          q.parseConfidence = confidence;
        }
        if (q.parseStructureValid === undefined) {
          q.parseStructureValid = true;
        }
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

    const chunkAiWallMs = attemptWallMs.reduce((a, b) => a + b, 0);
    const result: ChunkParseResult = {
      layoutChunkId: chunk.id,
      pageIndex: chunk.pageIndex,
      outcome,
      usedExpandedText: usedExpanded,
      chunkAiWallMs,
      parseAttempts: attemptWallMs.length,
      attemptWallMs: attemptWallMs.length > 0 ? attemptWallMs : undefined,
    };
    if (isPipelineVerbose()) {
      pipelineLog("VISION", "chunk-timing", "info", "layout chunk AI wall", {
        layoutChunkId: chunk.id,
        chunkAiWallMs,
        parseAttempts: result.parseAttempts,
        ...(studySetId?.trim()
          ? { studySetId: studySetId.trim() }
          : {}),
      });
    }
    byChunk.push(result);
    onChunkResult?.(result);
    progress?.(i + 1, total, chunk.pageIndex);
  }

  const needsVisionFallback = computeNeedsVisionFallback(run, chunks, byChunk);
  return { questions, byChunk, needsVisionFallback };
}
