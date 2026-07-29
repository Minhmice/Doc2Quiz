import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  FlashcardGenerateError,
  FlashcardGenerateValidationError,
} from "@/lib/pipeline/flashcardGenerate";
import { GenerationInProgressError } from "@/lib/server/quota/generationQuotaReservation";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";

const runFlashcardGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const isAiProcessingConfiguredMock = vi.fn();
const reserveGenerationQuotaMock = vi.fn();
const commitGenerationQuotaMock = vi.fn();
const releaseGenerationQuotaMock = vi.fn();

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

vi.mock("@/lib/server/quota/generationQuotaReservation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/server/quota/generationQuotaReservation")
    >();
  return {
    ...actual,
    reserveGenerationQuota: (...args: unknown[]) =>
      reserveGenerationQuotaMock(...args),
    commitGenerationQuota: (...args: unknown[]) =>
      commitGenerationQuotaMock(...args),
    releaseGenerationQuota: (...args: unknown[]) =>
      releaseGenerationQuotaMock(...args),
  };
});

import { POST } from "@/app/api/study-sets/[id]/flashcards/generate/route";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-flash-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
};

const ALREADY_COMMITTED = {
  kind: "already_committed" as const,
  usedBonus: false,
};

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
    reserveGenerationQuotaMock.mockResolvedValue(RESERVED);
    commitGenerationQuotaMock.mockResolvedValue({ status: "committed" });
    releaseGenerationQuotaMock.mockResolvedValue({ status: "released" });
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
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
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
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 503 when AI is not configured at route without reserving quota", async () => {
    isAiProcessingConfiguredMock.mockReturnValue(false);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid wizard body without reserving quota", async () => {
    const response = await POST(
      jsonRequest({ learningGoal: "memorize", coverage: "entire_document" }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns structured 402 when quota is exceeded", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new QuotaExceededError({
        weeklyUsed: 10,
        weeklyLimit: 10,
        bonusCredits: 0,
        weekResetsAt: "2026-08-03T17:00:00.000Z",
      }),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: "quota_exceeded",
      weeklyUsed: 10,
      weeklyLimit: 10,
    });
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns 409 when generation is already in progress", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new GenerationInProgressError("2026-07-30T06:07:00.000Z"),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "generation_in_progress" });
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("reserves before pipeline, commits on success, and does not release", async () => {
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

    expect(response.status).toBe(200);
    expect(reserveGenerationQuotaMock).toHaveBeenCalledBefore(
      runFlashcardGenerateMock,
    );
    expect(runFlashcardGenerateMock).toHaveBeenCalledBefore(
      commitGenerationQuotaMock,
    );
    expect(commitGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      reservationToken: "token-flash-1",
    });
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("skips commit and release for already_committed regeneration", async () => {
    reserveGenerationQuotaMock.mockResolvedValue(ALREADY_COMMITTED);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(200);
    expect(runFlashcardGenerateMock).toHaveBeenCalled();
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("releases once after pipeline validation failure", async () => {
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateValidationError(
        "Flashcard generation requires pipeline_stage at least canonical.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(400);
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
    expect(releaseGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      reservationToken: "token-flash-1",
    });
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("releases once after pipeline error", async () => {
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateError(
        "Flashcard generator output failed validation.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns 500 when commit fails after successful pipeline", async () => {
    commitGenerationQuotaMock.mockResolvedValue({ status: "reservation_not_found" });

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "internal_error",
    });
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns 500 when release fails after pipeline error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    runFlashcardGenerateMock.mockRejectedValue(
      new FlashcardGenerateError(
        "Flashcard generator output failed validation.",
      ),
    );
    releaseGenerationQuotaMock.mockRejectedValue(new Error("release rpc failed"));

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: "internal_error",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
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
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
  });

  it("returns 400 for count out of range without reserving quota", async () => {
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
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    expect(runFlashcardGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
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
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "set-1",
      contentKind: "flashcards",
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
