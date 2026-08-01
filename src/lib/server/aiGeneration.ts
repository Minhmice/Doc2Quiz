import { summarizeZodError } from "@/lib/pipeline/zodErrorSummary";
import { formatUpstreamAiError } from "@/lib/server/formatUpstreamAiError";
import { postChatCompletionAssistantText } from "@/lib/server/openAiChatCompletion";
import type { z } from "zod";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type GenerateJsonParams<T extends z.ZodType> = {
  configUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schema: T;
  createError: (message: string) => Error;
  signal?: AbortSignal;
};

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parse<T extends z.ZodType>(schema: T, text: string) {
  try {
    return schema.safeParse(JSON.parse(stripJsonFence(text)));
  } catch {
    return schema.safeParse(null);
  }
}

export async function generateValidatedJson<T extends z.ZodType>({
  configUrl,
  apiKey,
  model,
  messages,
  schema,
  createError,
  signal,
}: GenerateJsonParams<T>): Promise<z.output<T>> {
  const first = await postChatCompletionAssistantText({
    configUrl,
    apiKey,
    model,
    messages,
    responseFormatJsonObject: true,
    temperature: 0,
    signal,
  });

  if (!first.ok) {
    throw createError(formatUpstreamAiError(first.status, first.body));
  }

  let parsed = parse(schema, first.text);
  if (!parsed.success) {
    const repair = await postChatCompletionAssistantText({
      configUrl,
      apiKey,
      model,
      messages: [
        ...messages,
        { role: "assistant", content: first.text },
        {
          role: "user",
          content: `Invalid schema: ${summarizeZodError(parsed.error)}. Return ONLY valid JSON matching the schema.`,
        },
      ],
      responseFormatJsonObject: true,
      temperature: 0,
      signal,
    });

    if (!repair.ok) {
      throw createError(formatUpstreamAiError(repair.status, repair.body));
    }
    parsed = parse(schema, repair.text);
  }

  if (!parsed.success) {
    throw createError(`AI generator output failed validation: ${summarizeZodError(parsed.error)}`);
  }
  return parsed.data;
}
