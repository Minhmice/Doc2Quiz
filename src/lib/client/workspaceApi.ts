import type { DocumentPatch, WorkspacePatch } from "@/lib/workspaces/schemas";
import type { WorkspaceIngestIdentity } from "@/lib/client/ingestWorkspace";
import type { WorkspaceIngestJsonBody } from "@/lib/workspaces/schemas";

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

function mapNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error("Connection lost. Check your network and try again.");
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Request failed.");
}

async function parseJsonError(res: Response, fallback: string): Promise<never> {
  const payload = (await res.json().catch(() => ({}))) as ApiErrorPayload;
  throw new Error(payload.message ?? payload.error ?? fallback);
}

export async function patchWorkspace(
  workspaceId: string,
  patch: WorkspacePatch,
): Promise<{ id: string; title: string; subtitle: string | null }> {
  try {
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      await parseJsonError(res, "Workspace update failed.");
    }
    const body = (await res.json()) as {
      data: { id: string; title: string; subtitle: string | null };
    };
    return body.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function patchDocument(
  workspaceId: string,
  documentId: string,
  patch: DocumentPatch,
): Promise<{ id: string; title: string; description: string | null }> {
  try {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/documents/${documentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) {
      await parseJsonError(res, "Document update failed.");
    }
    const body = (await res.json()) as {
      data: { id: string; title: string; description: string | null };
    };
    return body.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function softDeleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  try {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/documents/${documentId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      await parseJsonError(res, "Document delete failed.");
    }
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function replaceDocumentSource(
  workspaceId: string,
  documentId: string,
  body: WorkspaceIngestJsonBody,
): Promise<WorkspaceIngestIdentity> {
  try {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/documents/${documentId}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const payload = (await res.json().catch(() => ({}))) as ApiErrorPayload &
      Partial<WorkspaceIngestIdentity>;
    if (!res.ok) {
      throw new Error(
        payload.message ?? payload.error ?? "Source replacement failed.",
      );
    }
    if (
      !payload.workspaceId ||
      !payload.documentId ||
      !payload.documentVersionId ||
      typeof payload.versionNumber !== "number"
    ) {
      throw new Error("Replacement response missing version identity.");
    }
    return {
      workspaceId: payload.workspaceId,
      documentId: payload.documentId,
      documentVersionId: payload.documentVersionId,
      versionNumber: payload.versionNumber,
      conversionStatus: payload.conversionStatus ?? "ok",
      rawMarkdownLength: payload.rawMarkdownLength ?? 0,
      title: payload.title ?? "Untitled",
    };
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function softDeleteDocumentVersion(
  workspaceId: string,
  documentId: string,
  documentVersionId: string,
): Promise<void> {
  try {
    const url = new URL(
      `/api/workspaces/${workspaceId}/documents/${documentId}/versions`,
      window.location.origin,
    );
    url.searchParams.set("documentVersionId", documentVersionId);
    const res = await fetch(url.pathname + url.search, { method: "DELETE" });
    if (!res.ok) {
      await parseJsonError(res, "Version delete failed.");
    }
  } catch (error) {
    throw mapNetworkError(error);
  }
}
