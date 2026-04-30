import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import { normalizeUnknownError, pipelineLog } from "@/lib/logging/pipelineLogger";
import {
  DEFAULT_OCR_COORD_REF,
  validateOcrBlock,
  assessOcrPageQuality,
} from "@/lib/ai/ocrValidate";
import { describeBadAiResponse, responseLooksLikeHtml } from "@/lib/ai/upstreamErrors";
import {
  stageVisionDataUrlForUpstream,
  visionImageUrlTryOrder,
} from "@/lib/ai/stageVisionDataUrl";
import type { OcrBlock, OcrCoordSystem, OcrPageResult, OcrPoint } from "@/types/ocr";

export interface RunOcrPageOptions {
  imageDataUrl: string;
  pageIndex: number;
  totalPages: number;
  signal: AbortSignal;
}

type RunOcrPageResult = { ocrResult: OcrPageResult } | { ok: false; error: string };

export function buildOcrSystemPrompt(): string {
  return [
    "You are an OCR engine for PDF page images.",
    "Extract all readable text and return only valid JSON (no markdown, no extra prose).",
    "Acceptable output shapes:",
    '{"page":{"text":"...","blocks":[{"text":"...","confidence":0.9,"bbox":{"x":0.1,"y":0.2,"width":0.3,"height":0.1}}]}}',
    "or",
    '{"pages":[{"text":"...","blocks":[...]}]}',
    "or",
    '{"text":"...","blocks":[...]}',
    "Rules:",
    "- `text` must contain the full page text as a single string.",
    "- `blocks` is an array of text blocks.",
    "- each block requires `text`.",
    "- optional `bbox` uses relative coordinates between 0 and 1 (origin top-left of the page image).",
    "- optional `polygon` is an array of {x,y} in the same 0..1 space (≥3 points).",
    "- optional `confidence` should be 0..1.",
  ].join("\n");
}

export function buildOcrUserPrompt(pageIndex: number, totalPages: number): string {
  return `Extract all readable text from this PDF page image. Page ${pageIndex} of ${totalPages}. Return structured JSON only.`;
}

async function imageTransportUrls(dataUrl: string, signal: AbortSignal): Promise<string[]> {
  const staged = await stageVisionDataUrlForUpstream(dataUrl, signal);
  return visionImageUrlTryOrder(dataUrl, staged);
}

function readChatCompletionContent(text: string): string {
  let data: {
    choices?: Array<{ message?: { content?: string | unknown } }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    if (responseLooksLikeHtml(text)) {
      throw new Error("API returned HTML instead of JSON — check the chat-completions URL.");
    }
    throw new Error("Invalid JSON from chat API");
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Empty model message content");
  }
  return content;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const RELATIVE_COORD_SYSTEM: OcrCoordSystem = {
  origin: "top-left",
  units: "relative_0_1",
};

function readPolygon(raw: unknown): OcrPoint[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const pts: OcrPoint[] = [];
  for (const p of raw) {
    if (typeof p !== "object" || p === null) {
      return undefined;
    }
    const o = p as Record<string, unknown>;
    const x = toNumber(o.x);
    const y = toNumber(o.y);
    if (x === null || y === null) {
      return undefined;
    }
    pts.push({ x, y });
  }
  return pts;
}

function parseOcrContent(content: string, pageIndex: number): OcrPageResult {
  const parseWarnings: string[] = [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OCR model did not return valid JSON content");
  }

  let pageNode: Record<string, unknown> = parsed;
  if (typeof parsed.page === "object" && parsed.page !== null) {
    pageNode = parsed.page as Record<string, unknown>;
  } else if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
    const first = parsed.pages[0];
    if (typeof first === "object" && first !== null) {
      pageNode = first as Record<string, unknown>;
    }
  }

  const text = typeof pageNode.text === "string" ? pageNode.text : "";
  const rawBlocks = Array.isArray(pageNode.blocks) ? pageNode.blocks : [];

  let invalidBlockCount = 0;
  const blocks: OcrBlock[] = [];

  for (const raw of rawBlocks) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }
    const block = raw as Record<string, unknown>;
    const blockText = typeof block.text === "string" ? block.text : "";
    if (!blockText.trim()) {
      continue;
    }

    const candidate: OcrBlock = { text: blockText };

    const confidence = toNumber(block.confidence);
    if (confidence !== null) {
      candidate.confidence = confidence;
    }

    if (typeof block.bbox === "object" && block.bbox !== null) {
      const bbox = block.bbox as Record<string, unknown>;
      const x = toNumber(bbox.x);
      const y = toNumber(bbox.y);
      const width = toNumber(bbox.width);
      const height = toNumber(bbox.height);
      const spaceRaw = bbox.space;
      const space =
        spaceRaw === "pixel" || spaceRaw === "relative" ? spaceRaw : "relative";
      if (x !== null && y !== null && width !== null && height !== null) {
        candidate.bbox = { x, y, width, height, space };
      } else {
        invalidBlockCount += 1;
        parseWarnings.push(
          `Dropped malformed bbox with non-finite coordinates on page ${pageIndex}.`,
        );
      }
    }

    const poly = readPolygon(block.polygon);
    if (poly) {
      candidate.polygon = poly;
    }

    const { block: validated, droppedBbox, droppedPolygon } =
      validateOcrBlock(candidate);
    if (droppedBbox || droppedPolygon) {
      invalidBlockCount += 1;
    }
    blocks.push(validated);
  }

  const quality = assessOcrPageQuality(text, blocks, invalidBlockCount);
  const warnings = [...new Set([...parseWarnings, ...quality.warnings])];

  return {
    pageIndex,
    text,
    blocks,
    status: quality.status,
    warnings: warnings.length > 0 ? warnings : undefined,
    invalidBlockCount,
    coordRef: DEFAULT_OCR_COORD_REF,
    coordSystem: RELATIVE_COORD_SYSTEM,
    providerMeta: {
      modelOutputShape: "json_object",
    },
  };
}

export async function runOcrPage(opts: RunOcrPageOptions): Promise<RunOcrPageResult> {
  const { imageDataUrl, pageIndex, totalPages, signal } = opts;
  const model = "server";
  const imageUrls = await imageTransportUrls(imageDataUrl, signal);
  let lastError: string | null = null;

  for (let idx = 0; idx < imageUrls.length; idx++) {
    const imageUrl = imageUrls[idx]!;

    try {
      let body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: buildOcrSystemPrompt() },
          {
            role: "user",
            content: [
              { type: "text", text: buildOcrUserPrompt(pageIndex, totalPages) },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        stream: false,
        response_format: { type: "json_object" },
      };

      let res = await forwardAiPost({
        signal,
        body,
      });
      let text = await res.text();

      if (res.status === 400) {
        const fallbackBody = { ...body };
        delete fallbackBody.response_format;
        body = fallbackBody;
        res = await forwardAiPost({
          signal,
          body,
        });
        text = await res.text();
      }

      if (res.status === 401) {
        pipelineLog("OCR", "request", "warn", "OCR API 401 (handled)", {
          pageIndex,
          totalPages,
          status: res.status,
        });
        return { ok: false, error: AI_PROCESSING_UNAVAILABLE_MESSAGE };
      }
      if (res.status === 503) {
        return { ok: false, error: AI_PROCESSING_UNAVAILABLE_MESSAGE };
      }
      if (res.status === 429) {
        pipelineLog("OCR", "request", "warn", "OCR API 429 (handled)", {
          pageIndex,
          totalPages,
          status: res.status,
        });
        return { ok: false, error: "Too many requests. Please wait and try again." };
      }
      if (!res.ok) {
        const proxyMsg = res.status === 502 ? parseProxyForwardErrorBody(text) : null;
        lastError = proxyMsg ?? describeBadAiResponse(res.status, text);
        continue;
      }

      const content = readChatCompletionContent(text);
      return { ocrResult: parseOcrContent(content, pageIndex) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      pipelineLog("OCR", "request", "warn", "OCR attempt threw", {
        pageIndex,
        totalPages,
        ...normalizeUnknownError(e),
        raw: e,
      });
    }
  }

  pipelineLog(
    "OCR",
    "request",
    "warn",
    `OCR page exhausted retries (page ${pageIndex + 1}/${totalPages}): ${lastError ?? "unknown"}`,
    {
      pageIndex,
      totalPages,
      lastError: lastError ?? null,
    },
  );
  return { ok: false, error: lastError ?? "OCR request failed for this page." };
}
