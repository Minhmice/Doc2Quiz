/**
 * One PDF page as image → OpenAI-compatible chat completions (multimodal).
 * Only for providers that use Bearer + /v1/chat/completions (openai | custom).
 */

import { FatalParseError } from "@/lib/ai/errors";
import {
  forwardAiPost,
  parseProxyForwardErrorBody,
} from "@/lib/ai/sameOriginForward";
import {
  describeBadAiResponse,
  responseLooksLikeHtml,
} from "@/lib/ai/upstreamErrors";
import {
  questionsFromAssistantContent,
  resolveChatApiUrl,
  resolveModelId,
} from "@/lib/ai/parseChunk";
import {
  MCQ_EXTRACTION_SYSTEM_PROMPT,
  visionPagePairUserPrompt,
  visionPageUserPrompt,
} from "@/lib/ai/prompts/mcqExtractionPrompts";
import { stageVisionDataUrlForUpstream } from "@/lib/ai/stageVisionDataUrl";

export type VisionForwardProvider = "openai" | "custom";

function imageTransportUrls(
  dataUrl: string,
  signal: AbortSignal,
): Promise<string[]> {
  return stageVisionDataUrlForUpstream(dataUrl, signal).then((staged) =>
    staged.staged ? [dataUrl, staged.url] : [dataUrl],
  );
}

async function postVisionCompletion(options: {
  forwardProvider: VisionForwardProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  userText: string;
  imageUrl: string;
  signal: AbortSignal;
  useJsonObjectFormat: boolean;
}): Promise<Response> {
  const {
    forwardProvider,
    endpoint,
    apiKey,
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

async function postVisionCompletionPair(options: {
  forwardProvider: VisionForwardProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  userText: string;
  imageUrlA: string;
  imageUrlB: string;
  signal: AbortSignal;
  useJsonObjectFormat: boolean;
}): Promise<Response> {
  const {
    forwardProvider,
    endpoint,
    apiKey,
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
  forwardProvider: VisionForwardProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  imageDataUrl: string;
  pageIndex: number;
  totalPages: number;
  signal: AbortSignal;
}): Promise<import("@/types/question").Question[]> {
  const {
    forwardProvider,
    apiKey,
    apiUrl,
    model,
    imageDataUrl,
    pageIndex,
    totalPages,
    signal,
  } = options;

  const endpoint = resolveChatApiUrl(
    forwardProvider === "custom" ? "custom" : "openai",
    apiUrl,
  );
  const modelId = resolveModelId(
    forwardProvider === "custom" ? "custom" : "openai",
    model,
  );

  const userText = visionPageUserPrompt(pageIndex, totalPages);

  /** Prefer inline data first; many dev setups use localhost staging URLs upstream cannot fetch. */
  const imageUrls = await imageTransportUrls(imageDataUrl, signal);

  let lastError: Error | null = null;

  for (let t = 0; t < imageUrls.length; t++) {
    const imageUrl = imageUrls[t];
    const transport = imageUrl.startsWith("data:") ? "data_url" : "https_hosted";

    try {
      let res = await postVisionCompletion({
        forwardProvider,
        endpoint,
        apiKey,
        model: modelId,
        userText,
        imageUrl,
        signal,
        useJsonObjectFormat: true,
      });

      let text = await res.text();

      if (res.status === 400) {
        res = await postVisionCompletion({
          forwardProvider,
          endpoint,
          apiKey,
          model: modelId,
          userText,
          imageUrl,
          signal,
          useJsonObjectFormat: false,
        });
        text = await res.text();
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

  throw lastError ?? new Error("Vision parse failed for this page.");
}

/**
 * Two consecutive page images in one request (cross-page MCQs). More tokens than single-page parse.
 */
export async function parseVisionPagePair(options: {
  forwardProvider: VisionForwardProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
  leftImageDataUrl: string;
  rightImageDataUrl: string;
  leftPageIndex: number;
  rightPageIndex: number;
  totalPages: number;
  signal: AbortSignal;
}): Promise<import("@/types/question").Question[]> {
  const {
    forwardProvider,
    apiKey,
    apiUrl,
    model,
    leftImageDataUrl,
    rightImageDataUrl,
    leftPageIndex,
    rightPageIndex,
    totalPages,
    signal,
  } = options;

  const endpoint = resolveChatApiUrl(
    forwardProvider === "custom" ? "custom" : "openai",
    apiUrl,
  );
  const modelId = resolveModelId(
    forwardProvider === "custom" ? "custom" : "openai",
    model,
  );

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
          forwardProvider,
          endpoint,
          apiKey,
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
            forwardProvider,
            endpoint,
            apiKey,
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
