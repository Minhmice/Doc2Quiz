import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { QuizAttemptImportError } from "@/lib/server/quizAttempts/importAnonymousQuizAttempts";

const requireApiUserMock = vi.fn();
const importAnonymousQuizAttemptsMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({ requireApiUser: () => requireApiUserMock() }));
vi.mock("@/lib/server/quizAttempts/importAnonymousQuizAttempts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/quizAttempts/importAnonymousQuizAttempts")>();
  return {
    ...actual,
    importAnonymousQuizAttempts: (...args: unknown[]) => importAnonymousQuizAttemptsMock(...args),
  };
});

import { POST } from "./route";

const attempt = {
  clientAttemptId: "d1000000-0000-4000-8000-000000000001",
  shareId: "a1000000-0000-4000-8000-000000000001",
  outputId: "b1000000-0000-4000-8000-000000000001",
  completedAt: "2026-07-30T10:00:00.000Z",
  correctCount: 1,
  totalQuestions: 1,
  answers: [{ questionId: "c1000000-0000-4000-8000-000000000001", selectedIndex: 0 }],
};

function request(body: unknown) {
  return new Request("http://localhost/api/quiz-attempts/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quiz-attempts/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ supabase: {}, user: { id: "user-1" } });
    importAnonymousQuizAttemptsMock.mockResolvedValue({
      acknowledgedIds: [attempt.clientAttemptId],
    });
  });

  it("imports attempts for authenticated user", async () => {
    const response = (await POST(request({ attempts: [attempt] }))) as Response;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ acknowledgedIds: [attempt.clientAttemptId] });
    expect(importAnonymousQuizAttemptsMock).toHaveBeenCalledWith({}, [attempt]);
  });

  it("returns 400 for invalid body", async () => {
    const response = (await POST(request({ attempts: "bad" }))) as Response;

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
  });

  it("returns 400 for import domain errors", async () => {
    importAnonymousQuizAttemptsMock.mockRejectedValue(new QuizAttemptImportError("invalid"));

    const response = (await POST(request({ attempts: [attempt] }))) as Response;

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid" });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    expect((await POST(request({ attempts: [attempt] })) as Response).status).toBe(401);
  });
});
