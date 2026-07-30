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

vi.mock("@/lib/workspaces/legacyBridge", () => ({
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
const PARENT_ID = "parent-set";
const BRIDGE_ID = "flash-bridge";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-flash-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
};

const BRIDGE_RESOLUTION = {
  outputId: "out-existing",
  workspaceId: "ws-1",
  bridgeStudySetId: BRIDGE_ID,
  legacyParentStudySetId: PARENT_ID,
  kind: "flashcards" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: BRIDGE_ID,
};

const PARENT_RESOLUTION = {
  ...BRIDGE_RESOLUTION,
  resolutionMode: "parent" as const,
  historyStudySetId: PARENT_ID,
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
  snapshots?: Array<{ canonical_version_id: string | null; ordinal: number }>;
}) {
  const snapshots = options?.snapshots ?? [
    { canonical_version_id: VERSION_A, ordinal: 1 },
  ];

  return {
    from: vi.fn((table: string) => {
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
      if (
        table === "quota_consumptions" ||
        table === "study_sessions" ||
        table === "study_mistakes"
      ) {
        throw new Error(`must not mutate historic ${table}`);
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
    resolveLegacyStudySetBridgeMock.mockResolvedValue(BRIDGE_RESOLUTION);
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
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(401);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when parent or bridge is inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(404);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("passes explicit flashcards route kind into resolver", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: BRIDGE_ID,
        routeKind: "flashcards",
        userId: "user-1",
      }),
    );
  });

  it("returns 400 for invalid wizard body", async () => {
    const response = await POST(
      jsonRequest({ learningGoal: "memorize", coverage: "entire_document" }),
      {
        params: Promise.resolve({ id: BRIDGE_ID }),
      },
    );

    expect(response.status).toBe(400);
    expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
  });

  it("authorized bridge resolution preserves success DTO and quota keys", async () => {
    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
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
      outputId: "out-new",
      snapshotCount: 1,
    });
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "bridge-new",
      contentKind: "flashcards",
    });
  });

  it("parent kind matching selects flashcards child only", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(PARENT_RESOLUTION);

    await POST(jsonRequest(), {
      params: Promise.resolve({ id: PARENT_ID }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: PARENT_ID,
        routeKind: "flashcards",
      }),
    );
    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1" }),
    );
  });

  it("bridge resolution does not fall back to parent history keys", async () => {
    expect(BRIDGE_RESOLUTION.historyStudySetId).toBe(BRIDGE_ID);
    expect(BRIDGE_RESOLUTION.historyStudySetId).not.toBe(PARENT_ID);

    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalled();
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith(
      expect.objectContaining({ studySetId: "bridge-new" }),
    );
  });

  it("does not mutate historic quota/session/mistake fixtures", async () => {
    const supabase = createAuthSupabase();
    requireApiUserMock.mockResolvedValue({
      supabase,
      user: { id: "user-1" },
    });

    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(supabase.from).not.toHaveBeenCalledWith("quota_consumptions");
    expect(supabase.from).not.toHaveBeenCalledWith("study_sessions");
    expect(supabase.from).not.toHaveBeenCalledWith("study_mistakes");
  });

  it("prefers explicit canonicalVersionIds over snapshot fallback", async () => {
    const explicit = "22222222-2222-4222-8222-222222222222";
    await POST(
      jsonRequest({ ...validBody, canonicalVersionIds: [explicit] }),
      {
        params: Promise.resolve({ id: BRIDGE_ID }),
      },
    );

    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalVersionIds: [explicit],
      }),
    );
  });

  it("uses frozen snapshots after source soft delete (snapshot study)", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalVersionIds: [VERSION_A],
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
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(402);
    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalled();
  });

  it("returns 409 when generation is already in progress", async () => {
    reserveGenerationQuotaMock.mockRejectedValue(
      new GenerationInProgressError("2026-07-30T06:07:00.000Z"),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
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
      params: Promise.resolve({ id: BRIDGE_ID }),
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
      params: Promise.resolve({ id: BRIDGE_ID }),
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
      params: Promise.resolve({ id: BRIDGE_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("ai_not_configured");
  });

  it("does not invoke replacement semantics or mutate prior banks", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalled();
  });
});
