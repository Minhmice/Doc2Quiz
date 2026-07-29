import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  MultiSourceFlashcardGenerateError,
  MultiSourceFlashcardValidationError,
} from "@/lib/pipeline/flashcardMultiSourceGenerate";
import { GenerationInProgressError } from "@/lib/server/quota/generationQuotaReservation";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";

const runMultiSourceFlashcardGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const reserveGenerationQuotaMock = vi.fn();
const commitGenerationQuotaMock = vi.fn();
const releaseGenerationQuotaMock = vi.fn();
const getUserUsageMock = vi.fn();

vi.mock("@/lib/pipeline/flashcardMultiSourceGenerate", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/pipeline/flashcardMultiSourceGenerate")
    >();
  return {
    ...actual,
    runMultiSourceFlashcardGenerate: (...args: unknown[]) =>
      runMultiSourceFlashcardGenerateMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/quota/getUserUsage", () => ({
  getUserUsage: (...args: unknown[]) => getUserUsageMock(...args),
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

import { POST } from "@/app/api/workspaces/[workspaceId]/outputs/flashcards/route";

const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-ws-flash-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
};

const params = Promise.resolve({ workspaceId: "ws-1" });

const validBody = {
  canonicalVersionIds: [VERSION_A],
  learningGoal: "memorize" as const,
  coverage: "entire_document" as const,
  amount: "recommended" as const,
};

function jsonRequest(body: unknown) {
  return new Request(
    "http://localhost/api/workspaces/ws-1/outputs/flashcards",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/workspaces/[workspaceId]/outputs/flashcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    getUserUsageMock.mockResolvedValue({
      plan: "free",
      weeklyUsed: 1,
      weeklyLimit: 10,
      weeklyRemaining: 9,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });
    reserveGenerationQuotaMock.mockResolvedValue(RESERVED);
    commitGenerationQuotaMock.mockResolvedValue({ status: "committed" });
    releaseGenerationQuotaMock.mockResolvedValue({ status: "released" });
    runMultiSourceFlashcardGenerateMock.mockResolvedValue({
      ok: true,
      recommendedCount: 5,
      generatedCount: 4,
      detectedFormat: "term_definition",
      cardIds: ["c-1", "c-2", "c-3", "c-4"],
      outputId: "out-1",
      bridgeStudySetId: "bridge-1",
      studySetId: "bridge-1",
      snapshotCount: 2,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(jsonRequest(validBody), { params });
    expect(response.status).toBe(401);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid Zod body and rejects injected markdown fields", async () => {
    const missing = await POST(
      jsonRequest({ learningGoal: "memorize", coverage: "entire_document", amount: "recommended" }),
      { params },
    );
    expect(missing.status).toBe(400);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();

    const injected = await POST(
      jsonRequest({
        ...validBody,
        canonicalMarkdown: "# injected",
        role: "owner",
      }),
      { params },
    );
    expect(injected.status).toBe(400);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 402 before pipeline when weekly quota is exhausted", async () => {
    getUserUsageMock.mockResolvedValue({
      plan: "free",
      weeklyUsed: 10,
      weeklyLimit: 10,
      weeklyRemaining: 0,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });

    const response = await POST(jsonRequest(validBody), { params });
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ error: "quota_exceeded" });
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for ineligible source selection", async () => {
    runMultiSourceFlashcardGenerateMock.mockRejectedValue(
      new MultiSourceFlashcardValidationError(
        "Canonical version is outside workspace: x",
      ),
    );

    const response = await POST(jsonRequest(validBody), { params });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "validation_error" });
  });

  it("returns 422 for typed generation failure", async () => {
    runMultiSourceFlashcardGenerateMock.mockRejectedValue(
      new MultiSourceFlashcardGenerateError(
        "Flashcard generation failed",
        422,
        "FLASHCARD_GENERATION_FAILED",
      ),
    );

    const response = await POST(
      jsonRequest({
        ...validBody,
        canonicalVersionIds: [VERSION_A, VERSION_B],
      }),
      { params },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "FLASHCARD_GENERATION_FAILED",
    });
  });

  it("returns 200 with bridge study set after snapshot persistence", async () => {
    const response = await POST(
      jsonRequest({
        canonicalVersionIds: [VERSION_A, VERSION_B],
        learningGoal: "exam_preparation",
        coverage: { sectionKeys: ["sec_001"] },
        amount: { count: 5 },
      }),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      recommendedCount: 5,
      generatedCount: 4,
      detectedFormat: "term_definition",
      cardIds: ["c-1", "c-2", "c-3", "c-4"],
      outputId: "out-1",
      studySetId: "bridge-1",
      bridgeStudySetId: "bridge-1",
      snapshotCount: 2,
    });
    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A, VERSION_B],
        learningGoal: "exam_preparation",
        coverage: { sectionKeys: ["sec_001"] },
        amount: { count: 5 },
      }),
    );
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "bridge-1",
      contentKind: "flashcards",
    });
    expect(commitGenerationQuotaMock).toHaveBeenCalled();
  });

  it("maps generation_in_progress from reserve to 409", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new GenerationInProgressError("2026-07-30T06:07:00.000Z"),
    );

    const response = await POST(jsonRequest(validBody), { params });
    expect(response.status).toBe(409);
  });
});
