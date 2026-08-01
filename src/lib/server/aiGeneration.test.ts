import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const postChatCompletionAssistantTextMock = vi.fn();

vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));

import { generateValidatedJson } from "./aiGeneration";

const schema = z.object({ title: z.string() });
const messages = [{ role: "user" as const, content: "Generate JSON" }];
const createError = (message: string) => new Error(`generation: ${message}`);

function generate() {
  return generateValidatedJson({
    configUrl: "https://ai.example.test/v1",
    apiKey: "secret",
    model: "test-model",
    messages,
    schema,
    createError,
  });
}

describe("generateValidatedJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts fenced valid JSON without repair", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValueOnce({
      ok: true,
      text: "```json\n{\"title\":\"Ready\"}\n```",
    });

    await expect(generate()).resolves.toEqual({ title: "Ready" });
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(1);
  });

  it("repairs invalid output using schema feedback", async () => {
    postChatCompletionAssistantTextMock
      .mockResolvedValueOnce({ ok: true, text: "{\"title\":42}" })
      .mockResolvedValueOnce({ ok: true, text: "{\"title\":\"Repaired\"}" });

    await expect(generate()).resolves.toEqual({ title: "Repaired" });
    expect(postChatCompletionAssistantTextMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: [
          ...messages,
          { role: "assistant", content: "{\"title\":42}" },
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Invalid schema:"),
          }),
        ],
      }),
    );
  });

  it("wraps upstream errors with the caller error type", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      body: "overloaded",
    });

    await expect(generate()).rejects.toThrow(
      "generation: AI request failed (503): overloaded",
    );
  });

  it("rejects output that remains invalid after repair", async () => {
    postChatCompletionAssistantTextMock
      .mockResolvedValueOnce({ ok: true, text: "not json" })
      .mockResolvedValueOnce({ ok: true, text: "{\"title\":false}" });

    await expect(generate()).rejects.toThrow(
      "generation: AI generator output failed validation:",
    );
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledTimes(2);
  });
});
