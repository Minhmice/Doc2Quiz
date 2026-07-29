import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  QuizGenerateError,
  QuizGenerateValidationError,
} from "@/lib/pipeline/quizGenerate";

const runQuizGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const assertGenerationQuotaMock = vi.fn();
const recordQuotaConsumptionMock = vi.fn();

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

vi.mock("@/lib/server/quota/assertGenerationQuota", () => ({
  assertGenerationQuota: (...args: unknown[]) => assertGenerationQuotaMock(...args),
}));

vi.mock("@/lib/server/quota/recordQuotaConsumption", () => ({
  recordQuotaConsumption: (...args: unknown[]) => recordQuotaConsumptionMock(...args),
}));

import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";
import { POST } from "@/app/api/study-sets/[id]/quiz/generate/route";

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
    assertGenerationQuotaMock.mockResolvedValue(undefined);
    recordQuotaConsumptionMock.mockResolvedValue(undefined);
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
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 402 before pipeline when quota is exceeded", async () => {
    assertGenerationQuotaMock.mockRejectedValue(new QuotaExceededError({
      weeklyUsed: 10, weeklyLimit: 10, bonusCredits: 0, weekResetsAt: "2026-08-02T17:00:00.000Z",
    }));

    const response = await POST(jsonRequest(), { params: Promise.resolve({ id: "set-1" }) });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({
      error: "quota_exceeded", weeklyUsed: 10, weeklyLimit: 10,
      bonusCredits: 0, weekResetsAt: "2026-08-02T17:00:00.000Z",
    });
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
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
  });

  it("returns 400 for invalid questionCount body", async () => {
    const response = await POST(jsonRequest({ questionCount: 99 }), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(400);
    expect(runQuizGenerateMock).not.toHaveBeenCalled();
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
    expect(recordQuotaConsumptionMock).toHaveBeenCalledWith({
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
