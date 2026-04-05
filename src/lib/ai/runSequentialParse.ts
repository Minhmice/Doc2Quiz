/**
 * Sequential chunk parsing (D-10): one chunk at a time, optional cancel via AbortSignal (D-19).
 */

import type { AiProvider, Question } from "@/types/question";
import { FatalParseError, isAbortError } from "@/lib/ai/errors";
import { parseChunkOnce } from "@/lib/ai/parseChunk";

export type ParseProgress = {
  current: number;
  total: number;
  status: "idle" | "running" | "done";
};

export async function runSequentialParse(options: {
  provider: AiProvider;
  apiKey: string;
  chunks: string[];
  signal: AbortSignal;
  onProgress?: (p: { current: number; total: number }) => void;
}): Promise<{
  questions: Question[];
  failedChunks: number;
  /** Set when a chunk hit 401/429 etc. — earlier chunks remain in `questions`. */
  fatalError?: string;
}> {
  const { provider, apiKey, chunks, signal, onProgress } = options;
  const questions: Question[] = [];
  let failedChunks = 0;
  const total = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) {
      break;
    }

    let chunkSucceeded = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) {
        break;
      }

      try {
        const qs = await parseChunkOnce({
          provider,
          apiKey,
          chunkText: chunks[i]!,
          signal,
        });
        questions.push(...qs);
        chunkSucceeded = true;
        break;
      } catch (e) {
        if (e instanceof FatalParseError) {
          onProgress?.({ current: i + 1, total });
          return {
            questions,
            failedChunks,
            fatalError: e.message,
          };
        }
        if (isAbortError(e)) {
          break;
        }
      }
    }

    if (signal.aborted) {
      break;
    }

    if (!chunkSucceeded) {
      failedChunks += 1;
    }

    onProgress?.({ current: i + 1, total });
  }

  return { questions, failedChunks };
}
