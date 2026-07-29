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
const resolveLegacyStudySetBridgeMock = vi.fn();

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

vi.mock("@/lib/workspaces/documentVersions", () => ({
  resolveLegacyStudySetBridge: (...args: unknown[]) =>
    resolveLegacyStudySetBridgeMock(...args),
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

const VERSION_A = "11111111-1111-4111-8111-111111111111";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-flash-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
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

function createAuthSupabase(options?: {
  owned?: boolean;
  snapshots?: Array<{ canonical_version_id: string | null; ordinal: number }>;
}) {
  const owned = options?.owned ?? true;
  const snapshots = options?.snapshots ?? [
    { canonical_version_id: VERSION_A, ordinal: 1 },
  ];

  return {
    from: vi.fn((table: string) => {
      if (table === "study_sets") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: owned ? { id: "set-1" } : null,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "output_source_snapshots") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: snapshots,
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "learning_outputs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({
                      data: null,
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("POST /api/study-sets/[id]/flashcards/generate (legacy bridge adapter)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase(),
      user: { id: "user-1" },
    });
    resolveLegacyStudySetBridgeMock.mockResolvedValue({
      workspaceId: "ws-1",
      legacyStudySetId: "set-1",
      learningOutputId: "out-existing",
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
      outputId: "out-new",
      bridgeStudySetId: "bridge-new",
      studySetId: "bridge-new",
      snapshotCount: 1,
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
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when study set is not found", async () => {
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase({ owned: false }),
      user: { id: "user-1" },
    });

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(404);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid wizard body", async () => {
    const response = await POST(
      jsonRequest({ learningGoal: "memorize", coverage: "entire_document" }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );

    expect(response.status).toBe(400);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("delegates to workspace service using frozen snapshot sources", async () => {
    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
        learningGoal: "memorize",
        coverage: "entire_document",
        amount: "recommended",
      }),
    );
    expect(body).toMatchObject({
      recommendedCount: 5,
      generatedCount: 4,
      detectedFormat: "term_definition",
      cardIds: ["c-1", "c-2", "c-3", "c-4"],
      studySetId: "bridge-new",
      bridgeStudySetId: "bridge-new",
    });
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "bridge-new",
      contentKind: "flashcards",
    });
  });

  it("prefers explicit canonicalVersionIds over snapshot fallback", async () => {
    const explicit = "22222222-2222-4222-8222-222222222222";
    await POST(
      jsonRequest({ ...validBody, canonicalVersionIds: [explicit] }),
      {
        params: Promise.resolve({ id: "set-1" }),
      },
    );

    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalVersionIds: [explicit],
      }),
    );
  });

  it("returns 402 when quota is exceeded on bridge", async () => {
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
    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalled();
  });

  it("returns 409 when generation is already in progress", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new GenerationInProgressError("2026-07-30T06:07:00.000Z"),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(409);
  });

  it("returns 400 for MultiSourceFlashcardValidationError", async () => {
    runMultiSourceFlashcardGenerateMock.mockRejectedValue(
      new MultiSourceFlashcardValidationError(
        "Canonical version is outside workspace.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "validation_error" });
  });

  it("returns 422 for MultiSourceFlashcardGenerateError", async () => {
    runMultiSourceFlashcardGenerateMock.mockRejectedValue(
      new MultiSourceFlashcardGenerateError(
        "Flashcard generation failed.",
        422,
        "FLASHCARD_GENERATION_FAILED",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 503 when AI is not configured", async () => {
    runMultiSourceFlashcardGenerateMock.mockRejectedValue(
      new MultiSourceFlashcardGenerateError(
        "AI processing is not configured.",
        503,
        "AI_NOT_CONFIGURED",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
  });

  it("does not call destructive replace paths", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalled();
  });
});
