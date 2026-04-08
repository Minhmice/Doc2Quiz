import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type { Question } from "@/types/question";
import { dedupeQuestionsByStem } from "@/lib/ai/dedupeQuestions";
import { FatalParseError, isAbortError } from "@/lib/ai/errors";
import { putMediaBlob } from "@/lib/db/studySetDb";
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

export type RunVisionSequentialResult = {
  questions: Question[];
  /** Failed API passes (single page or one overlapping pair). */
  failedSteps: number;
  fatalError?: string;
  /** Count of pages where storing the page image for questions failed (attach mode only). */
  attachImageFailures?: number;
};

async function tryAssignQuestionImageIds(
  studySetId: string,
  page: PageImageResult,
  qs: Question[],
  pageMediaCache: Map<number, string>,
): Promise<{ ok: boolean }> {
  for (const q of qs) {
    q.sourcePageIndex = page.pageIndex;
  }
  if (qs.length === 0) {
    return { ok: true };
  }
  let mediaId = pageMediaCache.get(page.pageIndex);
  if (!mediaId) {
    try {
      const res = await fetch(page.dataUrl);
      if (!res.ok) {
        return { ok: false };
      }
      const blob = await res.blob();
      mediaId = await putMediaBlob(studySetId, blob);
      pageMediaCache.set(page.pageIndex, mediaId);
    } catch {
      return { ok: false };
    }
  }
  for (const q of qs) {
    q.questionImageId = mediaId;
    q.sourceImageMediaId = mediaId;
  }
  return { ok: true };
}

export async function runVisionSequential(options: {
  forwardProvider: VisionForwardProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  pages: PageImageResult[];
  signal: AbortSignal;
  onProgress?: (p: VisionParseProgress) => void;
  /** When true with `studySetId`, parse one page at a time and attach page images to questions. */
  attachPageImages?: boolean;
  /** Required when `attachPageImages` is true (caller should disable attach if missing). */
  studySetId?: string;
}): Promise<RunVisionSequentialResult> {
  const {
    forwardProvider,
    apiKey,
    apiUrl,
    model,
    pages,
    signal,
    onProgress,
    studySetId,
  } = options;
  const attachPageImages = options.attachPageImages ?? false;
  const useAttach =
    attachPageImages &&
    studySetId !== undefined &&
    studySetId.length > 0;

  const questions: Question[] = [];
  let failedSteps = 0;

  if (pages.length === 0) {
    return { questions, failedSteps: 0 };
  }

  if (useAttach) {
    const pageMediaCache = new Map<number, string>();
    let attachImageFailures = 0;
    const total = pages.length;

    for (let i = 0; i < pages.length; i++) {
      if (signal.aborted) {
        break;
      }

      const page = pages[i]!;
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
            totalPages: pages.length,
            signal,
          });
          const attachOk = await tryAssignQuestionImageIds(
            studySetId!,
            page,
            qs,
            pageMediaCache,
          );
          if (!attachOk.ok) {
            attachImageFailures += 1;
          }
          questions.push(...qs);
          ok = true;
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
              ...(attachImageFailures > 0 ? { attachImageFailures } : {}),
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

      onProgress?.({
        current: i + 1,
        total,
        questionsSoFar: questions.length,
      });
    }

    return {
      questions: dedupeQuestionsByStem(questions),
      failedSteps,
      ...(attachImageFailures > 0 ? { attachImageFailures } : {}),
    };
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
        for (const q of qs) {
          q.sourcePageIndex = page.pageIndex;
        }
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

  // Dedupe can collapse duplicate stems from different pages; less common in attach (single-page) mode.
  return { questions: dedupeQuestionsByStem(questions), failedSteps };
}
