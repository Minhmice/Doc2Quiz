import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { WorkspacePermissionError } from "@/lib/server/workspaces/permissions";
import {
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
} from "@/lib/workspaces/errors";

const requireApiUserMock = vi.fn();
const requireWorkspacePermissionMock = vi.fn();
const patchWorkspaceMetadataMock = vi.fn();
const patchDocumentMetadataMock = vi.fn();
const softDeleteDocumentMock = vi.fn();
const appendDocumentVersionMock = vi.fn();
const softDeleteDocumentVersionMock = vi.fn();
const runCanonicalVersionMock = vi.fn();
const runMultiSourceQuizGenerateMock = vi.fn();
const runMultiSourceFlashcardGenerateMock = vi.fn();
const getUserUsageMock = vi.fn();
const reserveGenerationQuotaMock = vi.fn();
const commitGenerationQuotaMock = vi.fn();

vi.mock("@/lib/api/requireApiUser", () => ({
  requireApiUser: () => requireApiUserMock(),
}));

vi.mock("@/lib/server/workspaces/permissions", () => ({
  requireWorkspacePermission: (...args: unknown[]) =>
    requireWorkspacePermissionMock(...args),
  WorkspacePermissionError: class WorkspacePermissionError extends Error {
    constructor(readonly code: "not_found" | "forbidden") {
      super(code);
      this.name = "WorkspacePermissionError";
    }
  },
}));

vi.mock("@/lib/workspaces/documentVersions", () => ({
  patchWorkspaceMetadata: (...args: unknown[]) =>
    patchWorkspaceMetadataMock(...args),
  patchDocumentMetadata: (...args: unknown[]) =>
    patchDocumentMetadataMock(...args),
  softDeleteDocument: (...args: unknown[]) => softDeleteDocumentMock(...args),
  appendDocumentVersion: (...args: unknown[]) =>
    appendDocumentVersionMock(...args),
  softDeleteDocumentVersion: (...args: unknown[]) =>
    softDeleteDocumentVersionMock(...args),
}));

vi.mock("@/lib/pipeline/canonicalVersion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/canonicalVersion")>();
  return {
    ...actual,
    runCanonicalVersion: (...args: unknown[]) =>
      runCanonicalVersionMock(...args),
  };
});

vi.mock("@/lib/pipeline/multiSourceGenerate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/pipeline/multiSourceGenerate")>();
  return {
    ...actual,
    runMultiSourceQuizGenerate: (...args: unknown[]) =>
      runMultiSourceQuizGenerateMock(...args),
  };
});

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
    releaseGenerationQuota: vi.fn(),
  };
});

import { PATCH as patchWorkspace } from "@/app/api/workspaces/[workspaceId]/route";
import {
  DELETE as deleteDocument,
  PATCH as patchDocument,
} from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/route";
import {
  DELETE as deleteVersion,
  POST as postVersion,
} from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/route";
import { POST as postCanonicalize } from "@/app/api/workspaces/[workspaceId]/documents/[documentId]/versions/[documentVersionId]/canonicalize/route";
import { POST as postQuiz } from "@/app/api/workspaces/[workspaceId]/outputs/quiz/route";
import { POST as postFlashcards } from "@/app/api/workspaces/[workspaceId]/outputs/flashcards/route";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000099";
const documentId = "00000000-0000-4000-8000-000000000002";
const documentVersionId = "00000000-0000-4000-8000-000000000003";
const canonicalVersionId = "00000000-0000-4000-8000-000000000004";

const workspaceParams = Promise.resolve({ workspaceId });
const documentParams = Promise.resolve({ workspaceId, documentId });
const versionParams = Promise.resolve({
  workspaceId,
  documentId,
  documentVersionId,
});

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("workspace content route permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      supabase: { tag: "client" },
      user: { id: "user-1" },
    });
    requireWorkspacePermissionMock.mockResolvedValue({ role: "owner" });
    patchWorkspaceMetadataMock.mockResolvedValue({
      id: workspaceId,
      title: "Workspace",
      subtitle: null,
    });
    patchDocumentMetadataMock.mockResolvedValue({
      id: documentId,
      title: "Doc",
      description: null,
    });
    softDeleteDocumentMock.mockResolvedValue(undefined);
    appendDocumentVersionMock.mockResolvedValue({
      workspaceId,
      documentId,
      documentVersionId,
      versionNumber: 2,
      conversionStatus: "completed",
      rawMarkdownLength: 100,
      title: "Doc",
    });
    softDeleteDocumentVersionMock.mockResolvedValue(undefined);
    runCanonicalVersionMock.mockResolvedValue({
      canonicalVersionId,
      versionNumber: 1,
      sectionCount: 2,
      title: "Doc",
      model: "m",
      promptVersion: "1",
      parserVersion: "1",
      createdAt: "2026-07-30T00:00:00Z",
    });
    getUserUsageMock.mockResolvedValue({
      plan: "free",
      weeklyUsed: 0,
      weeklyLimit: 10,
      weeklyRemaining: 10,
      bonusCredits: 0,
      weekResetsAt: "2026-08-02T17:00:00.000Z",
    });
    reserveGenerationQuotaMock.mockResolvedValue({
      kind: "reserved",
      reservationToken: "token-1",
      usedBonus: false,
      reservationExpiresAt: "2026-07-30T06:00:00.000Z",
    });
    commitGenerationQuotaMock.mockResolvedValue({ status: "committed" });
    runMultiSourceQuizGenerateMock.mockResolvedValue({
      requestedCount: 4,
      recommendedCount: 4,
      generatedCount: 4,
      questionIds: ["q-1"],
      generationMode: "hybrid",
      factReuseCount: 0,
      warnings: [],
      rejectionSummary: null,
      outputId: "out-1",
      bridgeStudySetId: "ss-1",
      snapshotCount: 1,
    });
    runMultiSourceFlashcardGenerateMock.mockResolvedValue({
      recommendedCount: 5,
      generatedCount: 5,
      detectedFormat: "qa",
      cardIds: ["c-1"],
      outputId: "out-2",
      bridgeStudySetId: "ss-2",
      snapshotCount: 1,
    });
  });

  describe.each([
    ["owner", "owner"],
    ["editor", "editor"],
  ] as const)("allowed %s mutations", (label, role) => {
    beforeEach(() => {
      requireWorkspacePermissionMock.mockResolvedValue({ role });
    });

    it(`${label} can patch workspace metadata`, async () => {
      const response = (await patchWorkspace(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}`,
          "PATCH",
          { title: "Updated" },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(200);
      expect(requireWorkspacePermissionMock).toHaveBeenCalledWith(
        { tag: "client" },
        workspaceId,
        "edit",
        "user-1",
      );
      expect(patchWorkspaceMetadataMock).toHaveBeenCalled();
    });

    it(`${label} can patch and delete documents`, async () => {
      const patchResponse = (await patchDocument(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}`,
          "PATCH",
          { title: "Doc" },
        ),
        { params: documentParams },
      )) as Response;
      expect(patchResponse.status).toBe(200);

      const deleteResponse = (await deleteDocument(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}`,
          { method: "DELETE" },
        ),
        { params: documentParams },
      )) as Response;
      expect(deleteResponse.status).toBe(204);
      expect(requireWorkspacePermissionMock).toHaveBeenCalledWith(
        { tag: "client" },
        workspaceId,
        "edit",
        "user-1",
      );
    });

    it(`${label} can append and delete document versions`, async () => {
      const postResponse = (await postVersion(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions`,
          "POST",
          { kind: "paste", text: "# Notes" },
        ),
        { params: documentParams },
      )) as Response;
      expect(postResponse.status).toBe(200);

      const deleteResponse = (await deleteVersion(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions?documentVersionId=${documentVersionId}`,
          { method: "DELETE" },
        ),
        { params: documentParams },
      )) as Response;
      expect(deleteResponse.status).toBe(204);
    });

    it(`${label} can canonicalize a document version`, async () => {
      const response = (await postCanonicalize(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions/${documentVersionId}/canonicalize`,
          { method: "POST" },
        ),
        { params: versionParams },
      )) as Response;

      expect(response.status).toBe(200);
      expect(runCanonicalVersionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          documentId,
          documentVersionId,
        }),
      );
    });
  });

  describe.each([
    ["viewer", "forbidden", 403],
    ["outsider", "not_found", 404],
  ] as const)("denied %s mutations", (label, code, status) => {
    beforeEach(() => {
      requireWorkspacePermissionMock.mockRejectedValue(
        new WorkspacePermissionError(code),
      );
    });

    it(`returns ${status} for ${label} patching workspace`, async () => {
      const response = (await patchWorkspace(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}`,
          "PATCH",
          { title: "Nope" },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code });
      expect(patchWorkspaceMetadataMock).not.toHaveBeenCalled();
    });

    it(`returns ${status} for ${label} document mutations`, async () => {
      const patchResponse = (await patchDocument(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}`,
          "PATCH",
          { title: "Nope" },
        ),
        { params: documentParams },
      )) as Response;
      expect(patchResponse.status).toBe(status);

      const deleteResponse = (await deleteDocument(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}`,
          { method: "DELETE" },
        ),
        { params: documentParams },
      )) as Response;
      expect(deleteResponse.status).toBe(status);
      expect(patchDocumentMetadataMock).not.toHaveBeenCalled();
      expect(softDeleteDocumentMock).not.toHaveBeenCalled();
    });

    it(`returns ${status} for ${label} version mutations`, async () => {
      const postResponse = (await postVersion(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions`,
          "POST",
          { kind: "paste", text: "# Notes" },
        ),
        { params: documentParams },
      )) as Response;
      expect(postResponse.status).toBe(status);

      const deleteResponse = (await deleteVersion(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions?documentVersionId=${documentVersionId}`,
          { method: "DELETE" },
        ),
        { params: documentParams },
      )) as Response;
      expect(deleteResponse.status).toBe(status);
      expect(appendDocumentVersionMock).not.toHaveBeenCalled();
      expect(softDeleteDocumentVersionMock).not.toHaveBeenCalled();
    });

    it(`returns ${status} for ${label} canonicalize`, async () => {
      const response = (await postCanonicalize(
        new Request(
          `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions/${documentVersionId}/canonicalize`,
          { method: "POST" },
        ),
        { params: versionParams },
      )) as Response;

      expect(response.status).toBe(status);
      expect(runCanonicalVersionMock).not.toHaveBeenCalled();
    });
  });

  it("rejects cross-workspace document version with not_found", async () => {
    runCanonicalVersionMock.mockRejectedValue(
      new WorkspaceNotFoundError("Document version not found."),
    );

    const response = (await postCanonicalize(
      new Request(
        `http://localhost/api/workspaces/${workspaceId}/documents/${documentId}/versions/${documentVersionId}/canonicalize`,
        { method: "POST" },
      ),
      { params: versionParams },
    )) as Response;

    expect(response.status).toBe(404);
    expect(runCanonicalVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId }),
    );
  });

  describe.each([
    ["owner", "owner"],
    ["editor", "editor"],
  ] as const)("allowed %s output generation", (label, role) => {
    beforeEach(() => {
      requireWorkspacePermissionMock.mockResolvedValue({ role });
    });

    it(`${label} can generate quiz outputs`, async () => {
      const response = (await postQuiz(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/outputs/quiz`,
          "POST",
          { canonicalVersionIds: [canonicalVersionId] },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(200);
      expect(requireWorkspacePermissionMock).toHaveBeenCalledWith(
        { tag: "client" },
        workspaceId,
        "edit",
        "user-1",
      );
      expect(runMultiSourceQuizGenerateMock).toHaveBeenCalled();
    });

    it(`${label} can generate flashcard outputs`, async () => {
      const response = (await postFlashcards(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/outputs/flashcards`,
          "POST",
          {
            canonicalVersionIds: [canonicalVersionId],
            learningGoal: "memorize",
            coverage: "entire_document",
            amount: "recommended",
          },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(200);
      expect(runMultiSourceFlashcardGenerateMock).toHaveBeenCalled();
    });
  });

  describe.each([
    ["viewer", "forbidden", 403],
    ["outsider", "not_found", 404],
  ] as const)("denied %s output generation", (label, code, status) => {
    beforeEach(() => {
      requireWorkspacePermissionMock.mockRejectedValue(
        new WorkspacePermissionError(code),
      );
    });

    it(`returns ${status} for ${label} quiz generation before quota/pipeline`, async () => {
      const response = (await postQuiz(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/outputs/quiz`,
          "POST",
          { canonicalVersionIds: [canonicalVersionId] },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: code });
      expect(getUserUsageMock).not.toHaveBeenCalled();
      expect(runMultiSourceQuizGenerateMock).not.toHaveBeenCalled();
      expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    });

    it(`returns ${status} for ${label} flashcard generation before quota/pipeline`, async () => {
      const response = (await postFlashcards(
        jsonRequest(
          `http://localhost/api/workspaces/${workspaceId}/outputs/flashcards`,
          "POST",
          {
            canonicalVersionIds: [canonicalVersionId],
            learningGoal: "memorize",
            coverage: "entire_document",
            amount: "recommended",
          },
        ),
        { params: workspaceParams },
      )) as Response;

      expect(response.status).toBe(status);
      expect(getUserUsageMock).not.toHaveBeenCalled();
      expect(runMultiSourceFlashcardGenerateMock).not.toHaveBeenCalled();
      expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
    });
  });

  it("rejects cross-workspace canonical IDs before quota reservation", async () => {
    const { MultiSourceGenerateValidationError } = await import(
      "@/lib/pipeline/multiSourceGenerate"
    );
    runMultiSourceQuizGenerateMock.mockRejectedValue(
      new MultiSourceGenerateValidationError(
        "Canonical version does not belong to this workspace.",
      ),
    );

    const response = (await postQuiz(
      jsonRequest(
        `http://localhost/api/workspaces/${workspaceId}/outputs/quiz`,
        "POST",
        { canonicalVersionIds: [canonicalVersionId] },
      ),
      { params: Promise.resolve({ workspaceId: otherWorkspaceId }) },
    )) as Response;

    expect(response.status).toBe(400);
    expect(reserveGenerationQuotaMock).not.toHaveBeenCalled();
  });
});
