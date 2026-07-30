import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  MultiSourceGenerateError,
  MultiSourceGenerateValidationError,
} from "@/lib/pipeline/multiSourceGenerate";
import { GenerationInProgressError } from "@/lib/server/quota/generationQuotaReservation";
import { QuotaExceededError } from "@/lib/server/quota/QuotaExceededError";

const runMultiSourceQuizGenerateMock = vi.fn();
const requireApiUserMock = vi.fn();
const reserveGenerationQuotaMock = vi.fn();
const commitGenerationQuotaMock = vi.fn();
const releaseGenerationQuotaMock = vi.fn();
const resolveLegacyStudySetBridgeMock = vi.fn();

vi.mock("@/lib/pipeline/multiSourceGenerate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/multiSourceGenerate")>();
  return {
    ...actual,
    runMultiSourceQuizGenerate: (...args: unknown[]) =>
      runMultiSourceQuizGenerateMock(...args),
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

import { POST } from "@/app/api/study-sets/[id]/quiz/generate/route";

const VERSION_A = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "parent-set";
const BRIDGE_ID = "quiz-bridge";

const RESERVED = {
  kind: "reserved" as const,
  reservationToken: "token-quiz-1",
  usedBonus: false,
  reservationExpiresAt: "2026-07-30T06:00:00.000Z",
};

const BRIDGE_RESOLUTION = {
  outputId: "out-existing",
  workspaceId: "ws-1",
  bridgeStudySetId: BRIDGE_ID,
  legacyParentStudySetId: PARENT_ID,
  kind: "quiz" as const,
  resolutionMode: "bridge" as const,
  historyStudySetId: BRIDGE_ID,
};

const PARENT_RESOLUTION = {
  ...BRIDGE_RESOLUTION,
  resolutionMode: "parent" as const,
  historyStudySetId: PARENT_ID,
};

function jsonRequest(body: unknown = {}) {
  return new Request("http://localhost/api/study-sets/set-1/quiz/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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

describe("POST /api/study-sets/[id]/quiz/generate (legacy bridge adapter)", () => {
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
    runMultiSourceQuizGenerateMock.mockResolvedValue({
      ok: true,
      requestedCount: 4,
      recommendedCount: 4,
      generatedCount: 4,
      questionIds: ["q-1", "q-2", "q-3", "q-4"],
      generationMode: "hybrid",
      factReuseCount: 1,
      warnings: [],
      rejectionSummary: {},
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
    expect(runMultiSourceQuizGenerateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when bridge is inaccessible", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(null);

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(404);
    expect(runMultiSourceQuizGenerateMock).not.toHaveBeenCalled();
  });

  it("passes explicit quiz route kind into resolver", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: BRIDGE_ID,
        routeKind: "quiz",
        userId: "user-1",
      }),
    );
  });

  it("returns 400 for invalid questionCount body", async () => {
    const response = await POST(jsonRequest({ questionCount: 99 }), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(400);
    expect(runMultiSourceQuizGenerateMock).not.toHaveBeenCalled();
  });

  it("delegates to workspace service using frozen snapshot sources", async () => {
    const response = await POST(jsonRequest({ questionCount: 4 }), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        canonicalVersionIds: [VERSION_A],
        questionCountOverride: 4,
      }),
    );
    expect(body.studySetId).toBe("bridge-new");
    expect(body.bridgeStudySetId).toBe("bridge-new");
    expect(reserveGenerationQuotaMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      user: { id: "user-1" },
      studySetId: "bridge-new",
      contentKind: "quiz",
    });
  });

  it("parent kind selection resolves quiz child only", async () => {
    resolveLegacyStudySetBridgeMock.mockResolvedValue(PARENT_RESOLUTION);

    await POST(jsonRequest(), {
      params: Promise.resolve({ id: PARENT_ID }),
    });

    expect(resolveLegacyStudySetBridgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studySetId: PARENT_ID,
        routeKind: "quiz",
      }),
    );
    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalledWith(
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
    await POST(jsonRequest({ canonicalVersionIds: [explicit] }), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalVersionIds: [explicit],
      }),
    );
  });

  it("uses frozen snapshots after source soft delete (snapshot study)", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalledWith(
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
    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalled();
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

  it("returns 400 for MultiSourceGenerateValidationError", async () => {
    runMultiSourceQuizGenerateMock.mockRejectedValue(
      new MultiSourceGenerateValidationError(
        "Canonical version is outside workspace.",
      ),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "validation_error" });
  });

  it("returns 422 for MultiSourceGenerateError", async () => {
    runMultiSourceQuizGenerateMock.mockRejectedValue(
      new MultiSourceGenerateError("Source is not ready.", 422, "SOURCE_NOT_READY"),
    );

    const response = await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(response.status).toBe(422);
  });

  it("does not call replace_quiz_questions or runQuizGenerate", async () => {
    await POST(jsonRequest(), {
      params: Promise.resolve({ id: BRIDGE_ID }),
    });

    expect(runMultiSourceQuizGenerateMock).toHaveBeenCalled();
  });
});
