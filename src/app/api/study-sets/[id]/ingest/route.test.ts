import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import {
  IngestConversionError,
  IngestValidationError,
} from "@/lib/pipeline/ingest";

const runIngestMock = vi.fn();
const requireApiUserMock = vi.fn();

vi.mock("@/lib/pipeline/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pipeline/ingest")>();
  return {
    ...actual,
    runIngest: (...args: unknown[]) => runIngestMock(...args),
  };
});

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

import { POST } from "@/app/api/study-sets/[id]/ingest/route";

function jsonRequest(body: unknown, contentType = "application/json") {
  return new Request("http://localhost/api/study-sets/set-1/ingest", {
    method: "POST",
    headers: { "content-type": contentType },
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

describe("POST /api/study-sets/[id]/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: createAuthSupabase(),
      user: { id: "user-1" },
    });
    runIngestMock.mockResolvedValue({
      studySetId: "set-1",
      pipelineStage: "raw",
      rawMarkdownLength: 42,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiUserMock.mockResolvedValue({
      error: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const response = await POST(jsonRequest({ kind: "paste", text: "x".repeat(30) }), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 for validation errors", async () => {
    runIngestMock.mockRejectedValue(
      new IngestValidationError("Unsupported file type"),
    );

    const response = await POST(jsonRequest({ kind: "paste", text: "x".repeat(30) }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/unsupported/i);
  });

  it("returns 422 for conversion errors", async () => {
    runIngestMock.mockRejectedValue(
      new IngestConversionError("Conversion failed"),
    );

    const response = await POST(jsonRequest({ kind: "paste", text: "x".repeat(30) }), {
      params: Promise.resolve({ id: "set-1" }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 200 with pipeline stage on success", async () => {
    const response = await POST(jsonRequest({ kind: "paste", text: "x".repeat(30) }), {
      params: Promise.resolve({ id: "set-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pipelineStage).toBe("raw");
    expect(body.rawMarkdownLength).toBe(42);
    expect(runIngestMock).toHaveBeenCalled();
  });
});
