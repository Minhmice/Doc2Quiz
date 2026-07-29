import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  QuizGenerateError,
  QuizGenerateValidationError,
} from "@/lib/pipeline/quizGenerate";
import { GenerationInProgressError } from "@/lib/server/quota/generationQuotaReservation";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";

const runQuizGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const reserveGenerationQuotaMock = vi.fn();
const commitGenerationQuotaMock = vi.fn();
const releaseGenerationQuotaMock = vi.fn();

vi.mock("@/lib/pipeline/quizGenerate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/quizGenerate")>();
  return {
    ...actual,
    runQuizGenerate: (...args: unknown[]) => runQuizGenerateMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
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

import { POST } from "@/app/api/study-sets/[id]/quiz/generate/route";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-quiz-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
};

const ALREADY_COMMITTED = {
  kind: "already_committed" as const,
  usedBonus: false,
};

function jsonRequest(body: unknown = {}) {
  return new Request("http://localhost/api/study-sets/set-1/quiz/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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

describe("POST /api/study-sets/[id]/quiz/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase(),
      user: { id: "user-1" },
    });
    reserveGenerationQuotaMock.mockResolvedValue(RESERVED);
    commitGenerationQuotaMock.mockResolvedValue({ status: "committed" });
    releaseGenerationQuotaMock.mockResolvedValue({ status: "released" });
    runQuizGenerateMock.mockResolvedValue({
      ok: true,
      requestedCount: 4,
      recommendedCount: 4,
      generatedCount: 4,
      questionIds: ["q-1", "q-2", "q-3", "q-4"],
      generationMode: "hybrid",
      factReuseCount: 1,
      warnings: [],
      rejectionSummary: {},
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
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid questionCount body without reserving quota", async () => {
    const response = await POST(jsonRequest({ questionCount: 99 }), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(400);
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("returns 402 before pipeline when quota is exceeded", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new QuotaExceededError({
        weeklyUsed: 10,
        weeklyLimit: 10,
        bonusCredits: 0,
        weekResetsAt: "2026-08-02T17:00:00.000Z",
      }),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: "quota_exceeded",
      weeklyUsed: 10,
      weeklyLimit: 10,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
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
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("reserves before pipeline, commits on success, and does not release", async () => {
    const response = await POST(jsonRequest({ questionCount: 4 }), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(200);
    expect(reserveGenerationQuotaMock).toHaveBeenCalledBefore(runQuizGenerateMock);
    expect(runQuizGenerateMock).toHaveBeenCalledBefore(commitGenerationQuotaMock);
    expect(commitGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      reservationToken: "token-quiz-1",
    });
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("skips commit and release for already_committed regeneration", async () => {
    reserveGenerationQuotaMock.mockResolvedValue(ALREADY_COMMITTED);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(200);
    expect(runQuizGenerateMock).toHaveBeenCalled();
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
    expect(releaseGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("releases once after pipeline validation failure", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateValidationError(
        "Quiz generation requires pipeline_stage at least canonical.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(400);
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
    expect(releaseGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      reservationToken: "token-quiz-1",
    });
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("releases once after pipeline error", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateError("Quiz generator output failed validation."),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
    expect(commitGenerationQuotaMock).not.toHaveBeenCalled();
  });

  it("releases once after unexpected pipeline failure", async () => {
    runQuizGenerateMock.mockRejectedValue(new Error("unexpected"));

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(500);
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
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateError("Quiz generator output failed validation."),
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

  it("returns 400 for QuizGenerateValidationError", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateValidationError(
        "Quiz generation requires pipeline_stage at least canonical.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("returns 422 for QuizGenerateError", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateError("Quiz generator output failed validation."),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
  });

  it("returns structured source-capacity details", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateError(
        "Source supports at most 12 questions; requested 40.",
        422,
        "SOURCE_CAPACITY_INSUFFICIENT",
        {
          requestedCount: 40,
          maxSupportedCount: 12,
          reason: "requested_count_exceeds_validated_fact_opportunities",
        },
      ),
    );

    const response = await POST(jsonRequest({ questionCount: 40 }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      error: "SOURCE_CAPACITY_INSUFFICIENT",
      requested_count: 40,
      max_supported_count: 12,
      reason: "requested_count_exceeds_validated_fact_opportunities",
    });
  });

  it("continues through the pipeline without a route-level AI gate", async () => {
    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    expect(response.status).toBe(200);
    expect(runQuizGenerateMock).toHaveBeenCalled();
  });

  it("returns 503 when runQuizGenerate reports AI not configured", async () => {
    runQuizGenerateMock.mockRejectedValue(
      new QuizGenerateError("AI processing is not configured.", 503),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
    expect(releaseGenerationQuotaMock).toHaveBeenCalledOnce();
  });

  it("returns 200 with counts and questionIds on success", async () => {
    const response = await POST(jsonRequest({ questionCount: 4 }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      requestedCount: 4,
      recommendedCount: 4,
      generatedCount: 4,
      questionIds: ["q-1", "q-2", "q-3", "q-4"],
      generationMode: "hybrid",
      factReuseCount: 1,
      warnings: [],
      rejectionSummary: {},
    });
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "set-1",
      contentKind: "quiz",
    });
    expect(runQuizGenerateMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      userId: "user-1",
      studySetId: "set-1",
      user: { id: "user-1" },
      questionCountOverride: 4,
    });
  });
});
