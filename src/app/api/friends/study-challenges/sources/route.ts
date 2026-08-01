import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";

type SourceRow = { id?: unknown; title?: unknown; kind?: unknown; status?: unknown; deleted_at?: unknown; created_by?: unknown; approved_questions?: unknown };

function countQuestions(value: unknown): number {
  const row = Array.isArray(value) ? value[0] : null;
  return row && typeof row === "object" && typeof (row as { count?: unknown }).count === "number" ? (row as { count: number }).count : 0;
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("learning_outputs").select("id, title, kind, status, deleted_at, created_by, approved_questions(count)").eq("created_by", auth.user.id).eq("kind", "quiz").eq("status", "ready").is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "social_unavailable" }, { status: 404 });
  const quizzes = (Array.isArray(data) ? data : []).flatMap((row) => {
    const item = row as SourceRow;
    const questionCount = countQuestions(item.approved_questions);
    return typeof item.id === "string" && typeof item.title === "string" && item.kind === "quiz" && item.status === "ready" && item.deleted_at === null && item.created_by === auth.user.id && questionCount > 0
      ? [{ outputId: item.id, title: item.title, questionCount, status: "ready" as const }]
      : [];
  });
  return NextResponse.json({ data: quizzes });
}

export const runtime = "nodejs";
