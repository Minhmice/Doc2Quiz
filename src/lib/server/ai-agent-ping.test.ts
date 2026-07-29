import { beforeEach, describe, expect, it, vi } from "vitest";

const postChatCompletionAssistantTextMock = vi.fn();

vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));

vi.mock("@/lib/server/ai-processing-config", () => ({
  isAiProcessingConfigured: vi.fn(),
  getAiProcessingConfig: vi.fn(),
}));

import { isAiProcessingConfigured, getAiProcessingConfig } from "@/lib/server/ai-processing-config";
import {
  aiAgentPingHttpStatus,
  runAiAgentPing,
} from "@/lib/server/ai-agent-ping";

describe("runAiAgentPing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAiProcessingConfigured).mockReturnValue(true);
    vi.mocked(getAiProcessingConfig).mockReturnValue({
      url: "https://api.example.com/v1",
      key: "sk-test",
      model: "gpt-test",
      tier: "free",
    });
  });

  it("returns not configured when env is missing", async () => {
    vi.mocked(isAiProcessingConfigured).mockReturnValue(false);

    const result = await runAiAgentPing();

    expect(result).toEqual({
      ok: false,
      configured: false,
      error: "ai_not_configured",
    });
    expect(postChatCompletionAssistantTextMock).not.toHaveBeenCalled();
  });

  it("returns ok with latency when upstream succeeds", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: true,
      text: "pong",
    });

    const result = await runAiAgentPing({ tier: "pro" });

    expect(result.ok).toBe(true);
    expect(result.configured).toBe(true);
    expect(result.model).toBe("gpt-test");
    expect(result.text).toBe("pong");
    expect(typeof result.latencyMs).toBe("number");
    expect(getAiProcessingConfig).toHaveBeenCalledWith("pro");
    expect(postChatCompletionAssistantTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 8,
        temperature: 0,
      }),
    );
  });

  it("returns upstream error details when chat fails", async () => {
    postChatCompletionAssistantTextMock.mockResolvedValue({
      ok: false,
      status: 401,
      body: "invalid key",
    });

    const result = await runAiAgentPing();

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      status: 401,
      error: "invalid key",
      model: "gpt-test",
    });
  });
});

describe("aiAgentPingHttpStatus", () => {
  it("maps auth failures to 502", () => {
    expect(
      aiAgentPingHttpStatus({
        ok: false,
        configured: true,
        status: 401,
      }),
    ).toBe(502);
  });

  it("maps success to 200", () => {
    expect(
      aiAgentPingHttpStatus({
        ok: true,
        configured: true,
      }),
    ).toBe(200);
  });
});
