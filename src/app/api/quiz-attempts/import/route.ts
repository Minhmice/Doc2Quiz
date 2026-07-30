import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  importAnonymousQuizAttempts,
  QuizAttemptImportError,
} from "@/lib/server/quizAttempts/importAnonymousQuizAttempts";

const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(25),
});

const attemptSchema = z.object({
  clientAttemptId: z.string().uuid(),
  shareId: z.string().uuid(),
  outputId: z.string().uuid(),
  completedAt: z.string().min(1),
  correctCount: z.number().int().min(0).max(500),
  totalQuestions: z.number().int().min(1).max(500),
  answers: z.array(answerSchema).min(1).max(500),
});

const importBodySchema = z.object({
  attempts: z.array(attemptSchema).min(1).max(20),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof importBodySchema>;
  try {
    body = importBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await importAnonymousQuizAttempts(auth.supabase, body.attempts),
    );
  } catch (error) {
    if (error instanceof QuizAttemptImportError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "forbidden" ? 403 : 400 },
      );
    }

    console.error("quiz attempt import route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
