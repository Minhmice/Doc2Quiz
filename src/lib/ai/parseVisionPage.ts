/**
 * One PDF page as image → OpenAI-compatible chat completions (multimodal).
 * Only for providers that use Bearer + /v1/chat/completions (openai | custom).
 */

import { FatalParseError } from "@/lib/ai/errors";
import { AI_PROCESSING_UNAVAILABLE_MESSAGE } from "@/lib/ai/processingMessages";
import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import { questionsFromAssistantContent } from "@/lib/ai/parseChunk";
import {
  MCQ_EXTRACTION_SYSTEM_PROMPT,
  visionPagePairUserPrompt,
  visionPageUserPrompt,
} from "@/lib/ai/prompts/mcqExtractionPrompts";
import {
  stageVisionDataUrlForUpstream,
  VISION_UPSTREAM_IMAGE_TIP,
  visionImageUrlTryOrder,
} from "@/lib/ai/stageVisionDataUrl";

export type VisionForwardProvider = "openai" | "custom";

function imageTransportUrls(
  dataUrl: string,
  signal: AbortSignal,
): Promise<string[]> {
  return stageVisionDataUrlForUpstream(dataUrl, signal).then((staged) =>
    visionImageUrlTryOrder(dataUrl, staged),
  );
}

async function postVisionCompletion(options: {
  model: string;
  userText: string;
  imageUrl: string;
  signal: AbortSignal;
  useJsonObjectFormat: boolean;
}): Promise<Response> {
  const {
    model,
    userText,
    imageUrl,
    signal,
    useJsonObjectFormat,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: MCQ_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
    stream: false,
    max_tokens: 16384,
  };
  if (useJsonObjectFormat) {
    body.response_format = { type: "json_object" };
  }

  return forwardAiPost({
    signal,
    body,
  });
}

async function postVisionCompletionPair(options: {
  model: string;
  userText: string;
  imageUrlA: string;
  imageUrlB: string;
  signal: AbortSignal;
  useJsonObjectFormat: boolean;
}): Promise<Response> {
  const {
    model,
    userText,
    imageUrlA,
    imageUrlB,
    signal,
    useJsonObjectFormat,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: MCQ_EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageUrlA } },
          { type: "image_url", image_url: { url: imageUrlB } },
        ],
      },
    ],
    stream: false,
    max_tokens: 16384,
  };
  if (useJsonObjectFormat) {
    body.response_format = { type: "json_object" };
  }

  return forwardAiPost({
    signal,
    body,
  });
}

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

export async function parseVisionPage(options: {
  imageDataUrl: string;
  pageIndex: number;
  totalPages: number;
  signal: AbortSignal;
}): Promise<import("@/types/question").Question[]> {
  const {
    imageDataUrl,
    pageIndex,
    totalPages,
    signal,
  } = options;

  const modelId = "server";

  const userText = visionPageUserPrompt(pageIndex, totalPages);

  /** Prefer inline data first; many dev setups use localhost staging URLs upstream cannot fetch. */
  const imageUrls = await imageTransportUrls(imageDataUrl, signal);
  const onlyInlineDataImage =
    imageUrls.length === 1 && imageUrls[0]!.startsWith("data:");

  let lastError: Error | null = null;

  for (let t = 0; t < imageUrls.length; t++) {
    const imageUrl = imageUrls[t];
    const transport = imageUrl.startsWith("data:") ? "data_url" : "https_hosted";

    try {
      let res = await postVisionCompletion({
        model: modelId,
        userText,
        imageUrl,
        signal,
        useJsonObjectFormat: true,
      });

      let text = await res.text();

      if (res.status === 400) {
        res = await postVisionCompletion({
          model: modelId,
          userText,
          imageUrl,
          signal,
          useJsonObjectFormat: false,
        });
        text = await res.text();
      }

      if (res.status === 401) {
        throw new FatalParseError(AI_PROCESSING_UNAVAILABLE_MESSAGE);
      }
      if (res.status === 503) {
        throw new FatalParseError(AI_PROCESSING_UNAVAILABLE_MESSAGE);
      }
      if (res.status === 429) {
        throw new FatalParseError(
          "Too many requests. Please wait and try again.",
        );
      }
      if (!res.ok) {
        const proxyMsg =
          res.status === 502 ? parseProxyForwardErrorBody(text) : null;
        const msg =
          proxyMsg ?? describeBadAiResponse(res.status, text);
        lastError = new Error(
          `${msg} (image transport: ${transport}${t < imageUrls.length - 1 ? "; will retry alternate URL if available" : ""})`,
        );
        continue;
      }

      const content = readChatCompletionContent(text);
      return questionsFromAssistantContent(content);
    } catch (e) {
      if (e instanceof FatalParseError) {
        throw e;
      }
      lastError = e instanceof Error ? e : new Error(String(e));
      if (t < imageUrls.length - 1) {
        continue;
      }
      throw lastError;
    }
  }

  const base = lastError ?? new Error("Vision parse failed for this page.");
  if (onlyInlineDataImage && base instanceof Error) {
    throw new Error(`${base.message}\n\n${VISION_UPSTREAM_IMAGE_TIP}`);
  }
  throw base;
}

/**
 * Two consecutive page images in one request (cross-page MCQs). More tokens than single-page parse.
 */
export async function parseVisionPagePair(options: {
  leftImageDataUrl: string;
  rightImageDataUrl: string;
  leftPageIndex: number;
  rightPageIndex: number;
  totalPages: number;
  signal: AbortSignal;
}): Promise<import("@/types/question").Question[]> {
  const {
    leftImageDataUrl,
    rightImageDataUrl,
    leftPageIndex,
    rightPageIndex,
    totalPages,
    signal,
  } = options;

  const modelId = "server";

  const userText = visionPagePairUserPrompt(
    leftPageIndex,
    rightPageIndex,
    totalPages,
  );

  const [aUrls, bUrls] = await Promise.all([
    imageTransportUrls(leftImageDataUrl, signal),
    imageTransportUrls(rightImageDataUrl, signal),
  ]);

  let lastError: Error | null = null;

  for (const imageUrlA of aUrls) {
    for (const imageUrlB of bUrls) {
      const transportA = imageUrlA.startsWith("data:") ? "data_url" : "https_hosted";
      const transportB = imageUrlB.startsWith("data:") ? "data_url" : "https_hosted";

      try {
        let res = await postVisionCompletionPair({
          model: modelId,
          userText,
          imageUrlA,
          imageUrlB,
          signal,
          useJsonObjectFormat: true,
        });

        let text = await res.text();

        if (res.status === 400) {
          res = await postVisionCompletionPair({
            model: modelId,
            userText,
            imageUrlA,
            imageUrlB,
            signal,
            useJsonObjectFormat: false,
          });
          text = await res.text();
        }

        if (res.status === 401) {
          throw new FatalParseError(AI_PROCESSING_UNAVAILABLE_MESSAGE);
        }
        if (res.status === 503) {
          throw new FatalParseError(AI_PROCESSING_UNAVAILABLE_MESSAGE);
        }
        if (res.status === 429) {
          throw new FatalParseError(
            "Too many requests. Please wait and try again.",
          );
        }
        if (!res.ok) {
          const proxyMsg =
            res.status === 502 ? parseProxyForwardErrorBody(text) : null;
          const msg = proxyMsg ?? describeBadAiResponse(res.status, text);
          lastError = new Error(
            `${msg} (image transports: ${transportA}, ${transportB})`,
          );
          continue;
        }

        const content = readChatCompletionContent(text);
        return questionsFromAssistantContent(content);
      } catch (e) {
        if (e instanceof FatalParseError) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw lastError ?? new Error("Vision parse failed for this page pair.");
}
