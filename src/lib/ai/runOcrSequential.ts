import { isAbortError } from "@/lib/ai/errors";
import { pipelineLog } from "@/lib/logging/pipelineLogger";
import { runOcrPage } from "@/lib/ai/ocrAdapter";
import { verifyOcrPageRegions } from "@/lib/ai/ocrRegionVerify";
import { DEFAULT_OCR_COORD_REF } from "@/lib/ai/ocrValidate";
import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type {
  OcrPageRegionVerification,
  OcrPageResult,
  OcrProvider,
  OcrRunResult,
} from "@/types/ocr";

export type OcrParseProgress = {
  current: number;
  total: number;
  textSoFar: number;
};

export async function runOcrSequential(opts: {
  pages: PageImageResult[];
  signal: AbortSignal;
  onProgress?: (p: OcrParseProgress) => void;
  provider: OcrProvider;
  endpoint: string;
  apiKey: string;
  model: string;
}): Promise<OcrRunResult | null> {
  const { pages, signal, onProgress, provider, endpoint, apiKey, model } = opts;

  pipelineLog("OCR", "sequential", "info", "runOcrSequential invoked", {
    pageCount: pages.length,
    provider,
    model,
  });

  if (pages.length === 0) {
    return {
      version: 2,
      provider,
      savedAt: new Date().toISOString(),
      pages: [],
      stats: {
        totalPages: 0,
        successPages: 0,
        partialPages: 0,
        failedPages: 0,
        totalBlocks: 0,
        invalidBlocks: 0,
      },
    };
  }

  const outPages: OcrPageResult[] = [];
  let textSoFar = 0;

  function failedRegionVerification(
    pageIndex: number,
    note: string,
  ): OcrPageRegionVerification {
    return {
      pageIndex,
      pageUsableForCrop: false,
      relativeBboxBlockCount: 0,
      cropReadyBlockCount: 0,
      blocks: [],
      pageIssues: [note],
    };
  }

  function pushFailedPage(pageIndex: number, message: string) {
    pipelineLog("OCR", "page", "warn", "OCR page failed", {
      pageIndex,
      error: message,
    });
    outPages.push({
      pageIndex,
      text: "",
      blocks: [],
      status: "failed",
      warnings: [message],
      invalidBlockCount: 0,
      coordRef: DEFAULT_OCR_COORD_REF,
      providerMeta: { error: message },
      regionVerification: failedRegionVerification(
        pageIndex,
        message,
      ),
    });
  }

  for (let i = 0; i < pages.length; i++) {
    if (signal.aborted) {
      break;
    }

    const page = pages[i]!;
    try {
      const result = await runOcrPage({
        imageDataUrl: page.dataUrl,
        pageIndex: page.pageIndex,
        totalPages: pages.length,
        signal,
        endpoint,
        apiKey,
        model,
      });

      if ("ocrResult" in result) {
        const ocrResult = result.ocrResult;
        outPages.push({
          ...ocrResult,
          regionVerification: verifyOcrPageRegions(ocrResult),
        });
        textSoFar += ocrResult.text.length;
      } else {
        pushFailedPage(page.pageIndex, result.error);
      }
    } catch (e) {
      if (isAbortError(e)) {
        break;
      }
      pushFailedPage(
        page.pageIndex,
        e instanceof Error ? e.message : "OCR page threw unexpectedly.",
      );
    }

    onProgress?.({
      current: i + 1,
      total: pages.length,
      textSoFar,
    });
  }

  if (signal.aborted) {
    pipelineLog("OCR", "sequential", "warn", "runOcrSequential aborted; returning null", {
      pagesCompleted: outPages.length,
    });
    return null;
  }

  let successPages = 0;
  let partialPages = 0;
  let failedPages = 0;
  let totalBlocks = 0;
  let invalidBlocks = 0;

  for (const p of outPages) {
    const st = p.status ?? "success";
    if (st === "success") {
      successPages += 1;
    } else if (st === "partial") {
      partialPages += 1;
    } else {
      failedPages += 1;
    }
    totalBlocks += p.blocks.length;
    invalidBlocks += p.invalidBlockCount ?? 0;
  }

  const result: OcrRunResult = {
    version: 2,
    provider,
    savedAt: new Date().toISOString(),
    pages: outPages,
    stats: {
      totalPages: outPages.length,
      successPages,
      partialPages,
      failedPages,
      totalBlocks,
      invalidBlocks,
    },
  };
  pipelineLog("OCR", "sequential", "info", "runOcrSequential complete", result.stats);
  return result;
}
