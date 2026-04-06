import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type { Question } from "@/types/question";
import { dedupeQuestionsByStem } from "@/lib/ai/dedupeQuestions";
import { FatalParseError, isAbortError } from "@/lib/ai/errors";
import {
  parseVisionPage,
  parseVisionPagePair,
  type VisionForwardProvider,
} from "@/lib/ai/parseVisionPage";

export type VisionParseProgress = {
  current: number;
  total: number;
  questionsSoFar: number;
};

export async function runVisionSequential(options: {
  forwardProvider: VisionForwardProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  pages: PageImageResult[];
  signal: AbortSignal;
  onProgress?: (p: VisionParseProgress) => void;
}): Promise<{
  questions: Question[];
  /** Failed API passes (single page or one overlapping pair). */
  failedSteps: number;
  fatalError?: string;
}> {
  const {
    forwardProvider,
    apiKey,
    apiUrl,
    model,
    pages,
    signal,
    onProgress,
  } = options;

  const questions: Question[] = [];
  let failedSteps = 0;

  if (pages.length === 0) {
    return { questions, failedSteps: 0 };
  }

  if (pages.length === 1) {
    const total = 1;
    const page = pages[0]!;
    let ok = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) {
        break;
      }
      try {
        const qs = await parseVisionPage({
          forwardProvider,
          apiKey,
          apiUrl,
          model,
          imageDataUrl: page.dataUrl,
          pageIndex: page.pageIndex,
          totalPages: 1,
          signal,
        });
        questions.push(...qs);
        ok = true;
        break;
      } catch (e) {
        if (e instanceof FatalParseError) {
          onProgress?.({ current: 1, total, questionsSoFar: questions.length });
          return {
            questions: dedupeQuestionsByStem(questions),
            failedSteps,
            fatalError: e.message,
          };
        }
        if (isAbortError(e)) {
          break;
        }
      }
    }
    if (!signal.aborted && !ok) {
      failedSteps += 1;
    }
    onProgress?.({ current: 1, total, questionsSoFar: questions.length });
    return { questions: dedupeQuestionsByStem(questions), failedSteps };
  }

  const total = pages.length - 1;
  for (let i = 0; i < total; i++) {
    if (signal.aborted) {
      break;
    }

    const left = pages[i]!;
    const right = pages[i + 1]!;
    let stepSucceeded = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) {
        break;
      }
      try {
        const qs = await parseVisionPagePair({
          forwardProvider,
          apiKey,
          apiUrl,
          model,
          leftImageDataUrl: left.dataUrl,
          rightImageDataUrl: right.dataUrl,
          leftPageIndex: left.pageIndex,
          rightPageIndex: right.pageIndex,
          totalPages: pages.length,
          signal,
        });
        questions.push(...qs);
        stepSucceeded = true;
        break;
      } catch (e) {
        if (e instanceof FatalParseError) {
          onProgress?.({
            current: i + 1,
            total,
            questionsSoFar: questions.length,
          });
          return {
            questions: dedupeQuestionsByStem(questions),
            failedSteps,
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

    if (!stepSucceeded) {
      failedSteps += 1;
    }

    onProgress?.({
      current: i + 1,
      total,
      questionsSoFar: questions.length,
    });
  }

  return { questions: dedupeQuestionsByStem(questions), failedSteps };
}
