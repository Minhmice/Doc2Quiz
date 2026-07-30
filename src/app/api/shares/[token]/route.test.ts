import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicShareError } from "@/lib/server/shares/publicShare";

const createSupabaseAdminClientMock = vi.fn();
const resolvePublicShareMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClientMock(),
}));

vi.mock("@/lib/server/shares/publicShare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/shares/publicShare")>();
  return {
    ...actual,
    resolvePublicShare: (...args: unknown[]) => resolvePublicShareMock(...args),
  };
});

import { GET } from "./route";

const quizPayload = {
  shareId: "share-1",
  permission: "study" as const,
  target: {
    kind: "quiz" as const,
    outputId: "out-1",
    title: "Shared quiz",
    questions: [
      {
        id: "q-1",
        prompt: "Prompt?",
        choices: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Because",
      },
    ],
  },
};

describe("GET /api/shares/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseAdminClientMock.mockReturnValue({ rpc: vi.fn() });
  });

  it("returns safe DTO for an active share", async () => {
    resolvePublicShareMock.mockResolvedValue(quizPayload);

    const response = (await GET(new Request("http://localhost/api/shares/token"), {
      params: Promise.resolve({ token: "token" }),
    })) as Response;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: quizPayload });
    expect(resolvePublicShareMock).toHaveBeenCalledWith(createSupabaseAdminClientMock(), "token");
    expect(JSON.stringify(quizPayload)).not.toMatch(
      /user_id|workspace_id|study_set_id|source|token_digest|created_by/i,
    );
  });

  it("returns identical not_found for unknown, revoked, expired, and invalid tokens", async () => {
    resolvePublicShareMock.mockRejectedValue(new PublicShareError("not_found"));

    for (const token of ["missing", "revoked", "expired", "!!!"]) {
      const response = (await GET(new Request(`http://localhost/api/shares/${token}`), {
        params: Promise.resolve({ token }),
      })) as Response;

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });
});
