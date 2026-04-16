/**
 * Vision-first batch parse: prefers **fewest** OpenAI-compatible chat requests
 * (`min_requests`: up to `VISION_MAX_PAGES_DEFAULT` images, overlap 0) with
 * **legacy 10+overlap2** fallback when a single full-document batch fails.
 *
 * Lane contracts (non-negotiable):
 *   QUIZ LANE (mode === "quiz"):
 *     - Vision-only: PDF pages are rendered to images and sent to a multimodal model.
 *     - Question extraction only, strict MCQ schema (QuizVisionItem[]).
 *     - No flashcards produced; no OCR or text-chunk path.
 *
 *   FLASHCARD LANE (mode === "flashcard"):
 *     - Vision-only: theory/concept extraction, strict flashcard schema (FlashcardVisionItem[]).
 *     - No MCQ or quiz-style items produced.
 *
 * These lanes MUST NOT cross — no coercing flashcard→quiz or quiz→flashcard.
 */


import { FatalParseError, isAbortError } from "@/lib/ai/errors";
import { parseVisionFlashcardResponse } from "@/lib/ai/parseVisionFlashcardResponse";
import { parseVisionQuizResponse } from "@/lib/ai/parseVisionQuizResponse";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { forwardAiPost, parseProxyForwardErrorBody } from "@/lib/ai/sameOriginForward";
import type { ValidateVisionFlashcardOptions } from "@/lib/ai/validateVisionFlashcardItems";
import type { ValidateVisionQuizOptions } from "@/lib/ai/validateVisionQuizItems";
import {
  planVisionBatches,
  type PageBatch,
  type VisionBatchingPreset,
  VISION_BATCH_LEGACY_OVERLAP,
  VISION_BATCH_LEGACY_PAGE_SIZE,
} from "@/lib/ai/visionBatching";
import {
  createVisionBenchmarkAccumulator,
  formatVisionBenchmarkReport,
  summarizeConfidenceBuckets,
} from "@/lib/ai/visionBenchmark";
import { dedupeVisionItems } from "@/lib/ai/visionDedupe";
import {
  getCachedVisionBatchResult,
  hashVisionBatch,
  setCachedVisionBatchResult,
} from "@/lib/ai/visionParseCache";
import {
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "@/lib/ai/visionPrompts";
import {
  primaryVisionImageUrlForUpstream,
  stageVisionDataUrlsBatch,
} from "@/lib/ai/stageVisionDataUrl";
import { resolveChatApiUrl, resolveModelId } from "@/lib/ai/parseChunk";
import {
  isPipelineVerbose,
  visionPipelineEvent,
} from "@/lib/logging/pipelineLogger";
import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import { VISION_MAX_PAGES_DEFAULT } from "@/lib/pdf/renderPagesToImages";
import type {
  ParseOutputMode,
  VisionParseBenchmark,
  VisionParseItem,
} from "@/types/visionParse";
import type { FlashcardGenerationConfig } from "@/types/flashcardGeneration";
import { normalizeFlashcardGenerationConfig } from "@/types/flashcardGeneration";
export type VisionForwardProvider = "openai" | "custom";

function readChatCompletionContent(text: string): string {
  let data: {
    choices?: Array<{ message?: { content?: string | unknown } }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error(
        "API returned HTML instead of JSON — check the chat-completions URL.",
      );
    }
    throw new Error("Invalid JSON from chat API");
  }
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty model message content");
  }
  return content;
}

function estimateBatchTokens(
  userChars: number,
  imageCount: number,
  responseChars: number,
): number {
  /** Explicit MVP heuristic — not provider usage fields. */
  return Math.round(
    userChars / 4 + imageCount * 850 + responseChars / 4 + 400,
  );
}

async function postVisionBatchCompletion(options: {
  forwardProvider: VisionForwardProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  systemText: string;
  userText: string;
  imageUrls: string[];
  signal: AbortSignal;
  useJsonObjectFormat: boolean;
}): Promise<Response> {
  const {
    forwardProvider,
    endpoint,
    apiKey,
    model,
    systemText,
    userText,
    imageUrls,
    signal,
    useJsonObjectFormat,
  } = options;

  const userContent: unknown[] = [{ type: "text", text: userText }];
  for (const url of imageUrls) {
    userContent.push({
      type: "image_url",
      image_url: { url },
    });
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userContent },
    ],
    stream: false,
    /** Cap completion size — reduces runaway generation and long wall times on slow routers. */
    max_tokens: 16384,
  };
  if (useJsonObjectFormat) {
    body.response_format = { type: "json_object" };
  }

  return forwardAiPost({
    provider: forwardProvider,
    targetUrl: endpoint,
    apiKey,
    signal,
    body,
  });
}

export type RunVisionBatchSequentialOptions = {
  pages: PageImageResult[];
  mode: ParseOutputMode;
  signal: AbortSignal;
  forwardProvider: VisionForwardProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  /** Default `min_requests` — one window per up-to-20 pages, overlap 0 (strict `sourcePages`). */
  batchingPreset?: VisionBatchingPreset;
  onItemsExtracted?: (
    items: VisionParseItem[],
    meta: {
      batchIndex: number;
      startPage: number;
      endPage: number;
      cacheHit: boolean;
    },
  ) => void;
  /** Fires when the batch list is known (and again if we fall back to legacy windows). */
  onBatchPlanResolved?: (info: {
    batches: PageBatch[];
    preset: VisionBatchingPreset;
    reason: "initial" | "legacy_fallback";
  }) => void;
  /** Flashcard lane only — influences prompts; always paired with strict per-card `sourcePages`. */
  flashcardGeneration?: FlashcardGenerationConfig;
};

export type RunVisionBatchSequentialResult = {
  items: VisionParseItem[];
  benchmark: VisionParseBenchmark;
  failedBatches: number;
  benchmarkReportText: string;
};

const MAX_BATCH_ATTEMPTS = 2;

function attachSourcePages(
  item: VisionParseItem,
  startPage: number,
  endPage: number,
): VisionParseItem {
  const pageRange = [startPage, endPage];
  if (item.kind === "quiz") {
    return { ...item, sourcePages: pageRange };
  }
  return { ...item, sourcePages: pageRange };
}

function normalizeParsedBatchItems(
  items: VisionParseItem[],
  batch: PageBatch,
  strictSourcePages: boolean,
): VisionParseItem[] {
  if (strictSourcePages) {
    return items;
  }
  return items.map((it) => attachSourcePages(it, batch.startPage, batch.endPage));
}

export async function runVisionBatchSequential(
  opts: RunVisionBatchSequentialOptions,
): Promise<RunVisionBatchSequentialResult> {
  const {
    pages,
    mode,
    signal,
    forwardProvider,
    apiKey,
    apiUrl,
    model,
    onItemsExtracted,
    onBatchPlanResolved,
    flashcardGeneration: flashcardGenerationInput,
  } = opts;

  const resolvedFlashGen =
    mode === "flashcard"
      ? normalizeFlashcardGenerationConfig(flashcardGenerationInput)
      : undefined;

  const totalPagesLabel =
    pages.length === 0 ? 0 : Math.max(...pages.map((p) => p.pageIndex));

  visionPipelineEvent({
    stage: "parse_start",
    mode,
    message: "vision_batch_parse_start",
    itemCount: pages.length,
  });

  const activePreset = opts.batchingPreset ?? "min_requests";
  let batches = planVisionBatches(pages, activePreset);
  const flashcardLane = mode === "flashcard";
  let strictSourcePages = flashcardLane || activePreset === "min_requests";
  let didLegacyFallback = false;

  onBatchPlanResolved?.({
    batches,
    preset: activePreset,
    reason: "initial",
  });

  const endpoint = resolveChatApiUrl(
    forwardProvider === "custom" ? "custom" : "openai",
    apiUrl,
  );
  const modelId = resolveModelId(
    forwardProvider === "custom" ? "custom" : "openai",
    model,
  );

  const acc = createVisionBenchmarkAccumulator();
  const allItems: VisionParseItem[] = [];
  let failedBatches = 0;
  const tParse0 = performance.now();

  const parseOptsForBatch = (batch: PageBatch): ValidateVisionQuizOptions =>
    strictSourcePages
      ? {
          requireSourcePages: true,
          pageBounds: {
            minPage: batch.startPage,
            maxPage: batch.endPage,
          },
        }
      : {};

  const parseOptsFlashForBatch = (
    batch: PageBatch,
  ): ValidateVisionFlashcardOptions =>
    flashcardLane || strictSourcePages
      ? {
          requireSourcePages: true,
          pageBounds: {
            minPage: batch.startPage,
            maxPage: batch.endPage,
          },
        }
      : {};

  async function processBatchWave(
    waveBatches: PageBatch[],
    systemText: string,
  ): Promise<void> {
    for (const batch of waveBatches) {
      if (signal.aborted) {
        break;
      }

      visionPipelineEvent({
        stage: "batch_start",
        mode,
        batchIndex: batch.batchIndex,
        startPage: batch.startPage,
        endPage: batch.endPage,
        model: modelId,
      });

      const cacheKey = await hashVisionBatch(
        batch.pages,
        mode,
        flashcardLane && resolvedFlashGen
          ? JSON.stringify(resolvedFlashGen)
          : undefined,
      );
      const cached = await getCachedVisionBatchResult(cacheKey);
      const t0 = performance.now();

      if (cached) {
        visionPipelineEvent({
          stage: "batch_cache_hit",
          mode,
          batchIndex: batch.batchIndex,
          cacheHit: true,
        });
        const withPages = normalizeParsedBatchItems(
          cached,
          batch,
          strictSourcePages,
        );
        allItems.push(...withPages);
        onItemsExtracted?.(withPages, {
          batchIndex: batch.batchIndex,
          startPage: batch.startPage,
          endPage: batch.endPage,
          cacheHit: true,
        });
        visionPipelineEvent({
          stage: "batch_stream_append",
          mode,
          batchIndex: batch.batchIndex,
          itemCount: withPages.length,
          cacheHit: true,
        });
        acc.recordBatch({
          batchIndex: batch.batchIndex,
          startPage: batch.startPage,
          endPage: batch.endPage,
          itemCount: withPages.length,
          latencyMs: performance.now() - t0,
          estimatedTokens: estimateBatchTokens(
            buildVisionUserPrompt({
              mode,
              startPage: batch.startPage,
              endPage: batch.endPage,
              totalPages: totalPagesLabel,
              requirePerItemSourcePages: strictSourcePages,
              flashcardGeneration: resolvedFlashGen,
            }).length,
            batch.pages.length,
            200,
          ),
          cacheHit: true,
        });
        continue;
      }

      let batchItems: VisionParseItem[] | null = null;
      let lastErr: Error | null = null;
      let responseChars = 0;
      let lastResponseText = "";

      for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt++) {
        if (signal.aborted) {
          break;
        }
        try {
          const userText = buildVisionUserPrompt({
            mode,
            startPage: batch.startPage,
            endPage: batch.endPage,
            totalPages: totalPagesLabel,
            requirePerItemSourcePages: strictSourcePages,
            flashcardGeneration: resolvedFlashGen,
          });

          visionPipelineEvent({
            stage: "batch_request_start",
            mode,
            batchIndex: batch.batchIndex,
            attempt: attempt + 1,
          });

          const stagedBatch = await stageVisionDataUrlsBatch(
            batch.pages.map((p) => p.dataUrl),
            signal,
          );
          const imageUrls = batch.pages.map((p, i) =>
            primaryVisionImageUrlForUpstream(p.dataUrl, stagedBatch[i]),
          );

          if (isPipelineVerbose()) {
            const stagedCount = stagedBatch.filter((s) => s.staged).length;
            visionPipelineEvent({
              stage: "batch_staging_complete",
              mode,
              itemCount: stagedCount,
              message: `Staged ${stagedCount}/${imageUrls.length} images via batch`,
            });
          }

          let res = await postVisionBatchCompletion({
            forwardProvider,
            endpoint,
            apiKey,
            model: modelId,
            systemText,
            userText,
            imageUrls,
            signal,
            useJsonObjectFormat: true,
          });
          let text = await res.text();
          lastResponseText = text;

          if (res.status === 400) {
            res = await postVisionBatchCompletion({
              forwardProvider,
              endpoint,
              apiKey,
              model: modelId,
              systemText,
              userText,
              imageUrls,
              signal,
              useJsonObjectFormat: false,
            });
            text = await res.text();
            lastResponseText = text;
          }

          if (res.status === 401) {
            throw new FatalParseError(
              "Invalid API key. Please check and try again.",
            );
          }
          if (res.status === 429) {
            throw new FatalParseError(
              "Too many requests. Please wait and try again.",
            );
          }
          if (!res.ok) {
            const proxyMsg =
              res.status === 502 ? parseProxyForwardErrorBody(text) : null;
            lastErr = new Error(
              proxyMsg ?? describeBadAiResponse(res.status, text),
            );
            continue;
          }

          const content = readChatCompletionContent(text);
          responseChars = content.length;
          
          // Extract actual token usage from API response (OpenAI format)
          let actualTokens: number | undefined;
          try {
            const json = JSON.parse(text) as {
              usage?: { total_tokens?: number };
            };
            actualTokens = json.usage?.total_tokens;
          } catch {
            // ignore parse errors
          }
          
          // QUIZ LANE: parseVisionQuizResponse returns QuizVisionItem[] only.
          // FLASHCARD LANE: parseVisionFlashcardResponse returns FlashcardVisionItem[] only.
          // These lanes must not cross — no coercing flashcard→quiz or quiz→flashcard.
          const parsed =
            mode === "flashcard"
              ? parseVisionFlashcardResponse(
                  content,
                  parseOptsFlashForBatch(batch),
                )
              : parseVisionQuizResponse(content, parseOptsForBatch(batch));
          batchItems = normalizeParsedBatchItems(parsed, batch, strictSourcePages);
          
          // Calculate estimated tokens for this batch
          const estimatedTokens = estimateBatchTokens(
            userText.length,
            batch.pages.length,
            responseChars,
          );
          const tokensPerImage = estimatedTokens / batch.pages.length;
          
          // Log actual vs estimated tokens if available
          if (isPipelineVerbose() && actualTokens) {
            visionPipelineEvent({
              stage: "batch_request_done",
              mode,
              batchIndex: batch.batchIndex,
              message: `Actual usage: ${actualTokens} tokens (estimated: ${estimatedTokens})`,
            });
          }
          
          visionPipelineEvent({
            stage: "batch_parse_success",
            mode,
            batchIndex: batch.batchIndex,
            itemCount: batchItems.length,
          });
          
          // Warn if token count is suspiciously low
          if (tokensPerImage < 200) {
            visionPipelineEvent({
              stage: "batch_parse_success",
              mode,
              batchIndex: batch.batchIndex,
              itemCount: batchItems.length,
              message: `⚠️ Low token count: ~${Math.round(tokensPerImage)} tokens/image (expected ~850+). Response may be truncated.`,
            });
          }
          
          break;
        } catch (e) {
          if (e instanceof FatalParseError) {
            throw e;
          }
          if (isAbortError(e)) {
            throw e;
          }
          lastErr = e instanceof Error ? e : new Error(String(e));
          
          // Include response size hint if available
          const errorDetail = responseChars > 0
            ? `${lastErr.message} (response: ${responseChars} chars)`
            : lastErr.message;
          
          visionPipelineEvent({
            stage: "batch_parse_error",
            mode,
            batchIndex: batch.batchIndex,
            attempt: attempt + 1,
            error: errorDetail,
            message: `Attempt ${attempt + 1}/${MAX_BATCH_ATTEMPTS} failed: ${errorDetail}`,
          });
          
          // If it's a parse error and we have response text, log preview
          if (lastErr.message.includes("Invalid JSON") && lastResponseText && lastResponseText.length > 0) {
            const preview = lastResponseText.length > 300 
              ? lastResponseText.slice(0, 300) + "..." 
              : lastResponseText;
            visionPipelineEvent({
              stage: "batch_parse_error",
              mode,
              batchIndex: batch.batchIndex,
              message: `Response preview: ${preview.replace(/\s+/g, " ")}`,
            });
          }
        }
      }

      const latencyMs = performance.now() - t0;

      if (!batchItems) {
        failedBatches += 1;
        
        // Emit final error to UI so user knows WHY it failed
        const errorMsg = lastErr 
          ? lastErr.message 
          : "Batch failed after all retry attempts";
        
        visionPipelineEvent({
          stage: "batch_parse_error",
          mode,
          batchIndex: batch.batchIndex,
          itemCount: 0,
          error: errorMsg,
          message: `⚠️ Batch ${batch.batchIndex} (pages ${batch.startPage}-${batch.endPage}) FAILED: ${errorMsg}`,
        });
        
        acc.recordBatch({
          batchIndex: batch.batchIndex,
          startPage: batch.startPage,
          endPage: batch.endPage,
          itemCount: 0,
          latencyMs,
          estimatedTokens: estimateBatchTokens(200, batch.pages.length, 0),
          cacheHit: false,
        });
        continue;
      }

      await setCachedVisionBatchResult(cacheKey, batchItems);
      allItems.push(...batchItems);
      onItemsExtracted?.(batchItems, {
        batchIndex: batch.batchIndex,
        startPage: batch.startPage,
        endPage: batch.endPage,
        cacheHit: false,
      });
      visionPipelineEvent({
        stage: "batch_stream_append",
        mode,
        batchIndex: batch.batchIndex,
        itemCount: batchItems.length,
        cacheHit: false,
      });

      const userTextDone = buildVisionUserPrompt({
        mode,
        startPage: batch.startPage,
        endPage: batch.endPage,
        totalPages: totalPagesLabel,
        requirePerItemSourcePages: strictSourcePages,
        flashcardGeneration: resolvedFlashGen,
      });
      acc.recordBatch({
        batchIndex: batch.batchIndex,
        startPage: batch.startPage,
        endPage: batch.endPage,
        itemCount: batchItems.length,
        latencyMs,
        estimatedTokens: estimateBatchTokens(
          userTextDone.length,
          batch.pages.length,
          responseChars,
        ),
        cacheHit: false,
      });

      visionPipelineEvent({
        stage: "batch_request_done",
        mode,
        batchIndex: batch.batchIndex,
        latencyMs,
        itemCount: batchItems.length,
        cacheHit: false,
      });
    }
  }

  let systemText = buildVisionSystemPrompt(mode, {
    requirePerItemSourcePages: strictSourcePages,
    flashcardGeneration: resolvedFlashGen,
  });
  await processBatchWave(batches, systemText);

  const minPlanSingleWindow =
    activePreset === "min_requests" &&
    pages.length > 1 &&
    planVisionBatches(pages, "min_requests").length === 1;

  if (
    !flashcardLane &&
    minPlanSingleWindow &&
    !didLegacyFallback &&
    allItems.length === 0 &&
    failedBatches > 0
  ) {
    /**
     * Single full-document `min_requests` batch failed (HTTP or empty parse).
     * Re-run the same pages with **legacy 10 + overlap 2** windows — provenance
     * comes from batch page range again (no per-item `sourcePages` requirement).
     */
    visionPipelineEvent({
      stage: "batch_parse_error",
      mode,
      batchIndex: 0,
      message: "vision_batch_fallback_legacy_10_2",
      error: "min_requests monolith failed; retrying with legacy batches",
    });
    batches = planVisionBatches(pages, "legacy_10_2");
    strictSourcePages = false;
    didLegacyFallback = true;
    systemText = buildVisionSystemPrompt(mode, {
      requirePerItemSourcePages: false,
    });
    onBatchPlanResolved?.({
      batches,
      preset: "legacy_10_2",
      reason: "legacy_fallback",
    });
    await processBatchWave(batches, systemText);
  }

  visionPipelineEvent({ stage: "dedupe_start", mode });
  const modeFiltered = allItems.filter((it) =>
    mode === "flashcard" ? it.kind === "flashcard" : it.kind === "quiz",
  );
  const deduped = dedupeVisionItems(modeFiltered, mode);
  const removedCount = modeFiltered.length - deduped.length;
  visionPipelineEvent({
    stage: "dedupe_done",
    mode,
    itemCount: deduped.length,
    message: removedCount > 0 
      ? `Removed ${removedCount} duplicate${removedCount === 1 ? "" : "s"}, kept ${deduped.length} unique item${deduped.length === 1 ? "" : "s"}`
      : `No duplicates found, kept all ${deduped.length} item${deduped.length === 1 ? "" : "s"}`,
  });

  const totalLatencyMs = performance.now() - tParse0;
  const reportDims =
    didLegacyFallback || activePreset === "legacy_10_2"
      ? {
          batchSize: VISION_BATCH_LEGACY_PAGE_SIZE,
          overlap: VISION_BATCH_LEGACY_OVERLAP,
        }
      : {
          batchSize: Math.min(pages.length, VISION_MAX_PAGES_DEFAULT),
          overlap: 0,
        };
  const benchmark = acc.finalize({
    mode,
    totalPages: totalPagesLabel,
    totalItems: deduped.length,
    totalLatencyMs,
    confidenceSummary: summarizeConfidenceBuckets(deduped),
    batchSize: reportDims.batchSize,
    overlap: reportDims.overlap,
  });

  visionPipelineEvent({
    stage: "benchmark_ready",
    mode,
    latencyMs: totalLatencyMs,
    itemCount: deduped.length,
  });
  visionPipelineEvent({
    stage: "parse_done",
    mode,
    itemCount: deduped.length,
    message: `Parse complete: ${deduped.length} ${mode === "flashcard" ? "flashcard" : "question"}${deduped.length === 1 ? "" : "s"}`,
  });

  const benchmarkReportText = formatVisionBenchmarkReport(benchmark);
  if (isPipelineVerbose()) {
    console.info("[VISION][benchmark_report]\n" + benchmarkReportText);
  }

  return {
    items: deduped,
    benchmark,
    failedBatches,
    benchmarkReportText,
  };
}
