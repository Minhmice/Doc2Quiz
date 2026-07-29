import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  FlashcardGenerateError,
  FlashcardGenerateValidationError,
} from "@/lib/pipeline/flashcardGenerate";

const runFlashcardGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const isAiProcessingConfiguredMock = vi.fn();

vi.mock("@/lib/pipeline/flashcardGenerate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/flashcardGenerate")>();
  return {
    ...actual,
    runFlashcardGenerate: (...args: unknown[]) =>
      runFlashcardGenerateMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/ai-processing-config", () => ({
  isAiProcessingConfigured: () => isAiProcessingConfiguredMock(),
}));

import { POST } from "@/app/api/study-sets/[id]/flashcards/generate/route";

const validBody = {
  learningGoal: "memorize",
  coverage: "entire_document",
  amount: "recommended",
};

function jsonRequest(body: unknown = validBody) {
  return new Request(
    "http://localhost/api/study-sets/set-1/flashcards/generate",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function createAuthSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "set-1" },
              error: null,
            })),
          })),
        })),
      })),
    })),
  };
}

describe("POST /api/study-sets/[id]/flashcards/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAiProcessingConfiguredMock.mockReturnValue(true);
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase(),
      user: { id: "user-1" },
    });
    runFlashcardGenerateMock.mockResolvedValue({
      ok: true,
      recommendedCount: 5,
      generatedCount: 4,
      detectedFormat: "term_definition",
      cardIds: ["c-1", "c-2", "c-3", "c-4"],
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when study set is not found", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
    };
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
    });

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(404);
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for FlashcardGenerateValidationError", async () => {
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateValidationError(
        "Flashcard generation requires pipeline_stage at least canonical.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("returns 422 for FlashcardGenerateError", async () => {
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateError(
        "Flashcard generator output failed validation.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 503 when AI is not configured at route", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 503 when runFlashcardGenerate reports AI not configured", async () => {
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateError("AI processing is not configured.", 503),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
  });

  it("returns 400 for invalid wizard body", async () => {
    const response = await POST(
      jsonRequest({ learningGoal: "memorize", coverage: "entire_document" }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for count out of range", async () => {
    const response = await POST(
      jsonRequest({
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: { count: 99 },
      }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 200 with counts, detectedFormat, and cardIds on success", async () => {
    const response = await POST(
      jsonRequest({
        learningGoal: "exam_preparation",
        coverage: { sectionKeys: ["sec_001"] },
        amount: { count: 5 },
      }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      recommendedCount: 5,
      generatedCount: 4,
      detectedFormat: "term_definition",
      cardIds: ["c-1", "c-2", "c-3", "c-4"],
    });
    expect(runFlashcardGenerateMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      userId: "user-1",
      studySetId: "set-1",
      user: { id: "user-1" },
      learningGoal: "exam_preparation",
      coverage: { sectionKeys: ["sec_001"] },
      amount: { count: 5 },
    });
  });
});
