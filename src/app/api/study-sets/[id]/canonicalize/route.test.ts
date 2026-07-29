import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  CanonicalizeError,
  CanonicalizePersistenceError,
  CanonicalizeValidationError,
} from "@/lib/pipeline/canonicalize";

const runCanonicalizeMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/pipeline/canonicalize", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/canonicalize")>();
  return {
    ...actual,
    runCanonicalize: (...args: unknown[]) => runCanonicalizeMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { POST } from "@/app/api/study-sets/[id]/canonicalize/route";

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

describe("POST /api/study-sets/[id]/canonicalize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase(),
      user: { id: "user-1" },
    });
    runCanonicalizeMock.mockResolvedValue({
      studySetId: "set-1",
      pipelineStage: "canonical",
      sectionCount: 2,
      title: "Canonical Title",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when study set not found", async () => {
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

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for validation errors", async () => {
    runCanonicalizeMock.mockRejectedValue(
      new CanonicalizeValidationError("raw_markdown is empty."),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("validation_error");
    expect(body.message).toMatch(/empty/i);
  });

  it("returns 422 for canonicalize errors", async () => {
    runCanonicalizeMock.mockRejectedValue(
      new CanonicalizeError("Canonical builder output failed validation"),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("canonicalize_error");
  });

  it("returns 503 for persistence network errors", async () => {
    runCanonicalizeMock.mockRejectedValue(
      new CanonicalizePersistenceError("Cannot reach Supabase."),
    );

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("persistence_unavailable");
    expect(body.message).toMatch(/Supabase/);
  });

  it("returns 200 with pipelineStage canonical on success", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pipelineStage).toBe("canonical");
    expect(body.sectionCount).toBe(2);
    expect(body.title).toBe("Canonical Title");
    expect(runCanonicalizeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        studySetId: "set-1",
      }),
    );
  });
});
