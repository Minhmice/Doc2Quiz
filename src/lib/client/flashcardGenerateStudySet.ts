import type { FlashcardGenerateBody } from "@/lib/pipeline/flashcardSchemas";

export type FlashcardGenerateResult = {
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: string;
  cardIds: string[];
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

export async function postFlashcardGenerate(
  studySetId: string,
  body: FlashcardGenerateBody,
): Promise<FlashcardGenerateResult> {
  try {
    const res = await fetch(
      `/api/study-sets/${studySetId}/flashcards/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Something went wrong while generating flashcards. Try again.",
      );
    }
    return (await res.json()) as FlashcardGenerateResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}
