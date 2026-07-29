export type QuizGenerateResult = {
  requestedCount: number;
  recommendedCount: number;
  generatedCount: number;
  questionIds: string[];
  generationMode: "source" | "ai" | "deterministic" | "hybrid";
  factReuseCount: number;
  warnings: string[];
  rejectionSummary: Record<string, number>;
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

export async function postQuizGenerate(
  studySetId: string,
  body?: { questionCount?: number },
): Promise<QuizGenerateResult> {
  try {
    const res = await fetch(`/api/study-sets/${studySetId}/quiz/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Something went wrong while generating questions. Try again.",
      );
    }
    return (await res.json()) as QuizGenerateResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}
