import type {
  CanonicalSectionPage,
  CanonicalVersionMetadata,
} from "@/lib/workspaces/canonicalReader";

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

export type WorkspaceCanonicalizeResult = {
  canonicalVersionId: string;
  versionNumber: number;
  sectionCount: number;
  title: string;
  model: string | null;
  promptVersion: string;
  parserVersion: string;
  createdAt: string;
  processingMode?: "ai" | "heuristic";
  fallbackReason?: string | null;
};

export async function postWorkspaceCanonicalize(params: {
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
  signal?: AbortSignal;
}): Promise<WorkspaceCanonicalizeResult> {
  try {
    const res = await fetch(
      `/api/workspaces/${params.workspaceId}/documents/${params.documentId}/versions/${params.documentVersionId}/canonicalize`,
      { method: "POST", signal: params.signal },
    );
    if (!res.ok) {
      await parseJsonError(
        res,
        "Something went wrong while building canonical knowledge. Try again.",
      );
    }
    return (await res.json()) as WorkspaceCanonicalizeResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function fetchCanonicalVersionMetadata(params: {
  workspaceId: string;
  versionId: string;
  signal?: AbortSignal;
}): Promise<CanonicalVersionMetadata> {
  try {
    const res = await fetch(
      `/api/workspaces/${params.workspaceId}/canonical-versions/${params.versionId}`,
      { signal: params.signal },
    );
    if (!res.ok) {
      await parseJsonError(
        res,
        "Couldn't load canonical version metadata. Try refreshing the page.",
      );
    }
    const payload = (await res.json()) as { data?: CanonicalVersionMetadata };
    if (!payload.data) {
      throw new Error(
        "Couldn't load canonical version metadata. Try refreshing the page.",
      );
    }
    return payload.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function fetchCanonicalSectionPage(params: {
  workspaceId: string;
  versionId: string;
  afterOrdinal?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CanonicalSectionPage> {
  try {
    const url = new URL(
      `/api/workspaces/${params.workspaceId}/canonical-versions/${params.versionId}/sections`,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost",
    );
    if (params.afterOrdinal != null) {
      url.searchParams.set("afterOrdinal", String(params.afterOrdinal));
    }
    if (params.limit != null) {
      url.searchParams.set("limit", String(params.limit));
    }

    const res = await fetch(url.pathname + url.search, {
      signal: params.signal,
    });
    if (!res.ok) {
      await parseJsonError(
        res,
        "Couldn't load canonical sections. Try again.",
      );
    }
    const payload = (await res.json()) as { data?: CanonicalSectionPage };
    if (!payload.data) {
      throw new Error("Couldn't load canonical sections. Try again.");
    }
    return payload.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}
