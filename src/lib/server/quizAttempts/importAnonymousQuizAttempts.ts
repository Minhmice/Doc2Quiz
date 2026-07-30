import type { AnonymousQuizAttempt } from "@/lib/client/anonymousQuizAttempts";

type ImportRpcSupabase = {
  rpc: (
    functionName: string,
    args: { p_attempts: AnonymousQuizAttempt[] },
  ) => PromiseLike<{
    data: { acknowledgedIds: string[] } | null;
    error: { message: string } | null;
  }>;
};

export type QuizAttemptImportErrorCode = "invalid" | "forbidden";

export class QuizAttemptImportError extends Error {
  constructor(readonly code: QuizAttemptImportErrorCode) {
    super(code);
    this.name = "QuizAttemptImportError";
  }
}

const errorCodes: QuizAttemptImportErrorCode[] = ["invalid", "forbidden"];

export async function importAnonymousQuizAttempts(
  supabase: ImportRpcSupabase,
  attempts: AnonymousQuizAttempt[],
) {
  const { data, error } = await supabase.rpc("import_anonymous_quiz_attempts", {
    p_attempts: attempts,
  });

  if (error) {
    const errorCode =
      errorCodes.find((candidate) => error.message.includes(candidate)) ?? "invalid";
    throw new QuizAttemptImportError(errorCode);
  }
  if (!data) throw new QuizAttemptImportError("invalid");

  return {
    acknowledgedIds: Array.isArray(data.acknowledgedIds) ? data.acknowledgedIds : [],
  };
}
