export type CanonicalSection = {
  id: string;
  ordinal: number;
  heading: string;
  bodyMarkdown: string;
  sectionType: string;
  sectionKey: string | null;
};

export type CanonicalDocumentMetadata = {
  language?: string;
  content_type?: "theory" | "exam" | "mixed" | string;
  title?: string;
  [key: string]: unknown;
};

export type CanonicalPreviewData = {
  studySet: {
    id: string;
    title: string;
    pipelineStage: string;
  };
  document: {
    canonicalMarkdown: string | null;
    rawMarkdown: string | null;
    metadata: CanonicalDocumentMetadata | null;
    originalFilename: string | null;
  };
  sections: CanonicalSection[];
};

export type CanonicalizeResult = {
  studySetId: string;
  pipelineStage: string;
  sectionCount: number;
  title: string;
};

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
  return new Error("Something went wrong. Try again.");
}

async function parseApiError(
  res: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await res.json().catch(() => ({}))) as ApiErrorPayload;
  return new Error(payload.message ?? payload.error ?? fallback);
}

export async function postCanonicalize(
  studySetId: string,
): Promise<CanonicalizeResult> {
  try {
    const res = await fetch(`/api/study-sets/${studySetId}/canonicalize`, {
      method: "POST",
    });
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Something went wrong while building canonical knowledge. Try again.",
      );
    }
    return (await res.json()) as CanonicalizeResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

export async function fetchCanonicalPreview(
  studySetId: string,
): Promise<CanonicalPreviewData> {
  try {
    const res = await fetch(`/api/study-sets/${studySetId}/canonical`);
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Couldn't load canonical preview. Try refreshing the page.",
      );
    }
    const payload = (await res.json()) as { data?: CanonicalPreviewData };
    if (!payload.data) {
      throw new Error("Couldn't load canonical preview. Try refreshing the page.");
    }
    return payload.data;
  } catch (error) {
    throw mapNetworkError(error);
  }
}
