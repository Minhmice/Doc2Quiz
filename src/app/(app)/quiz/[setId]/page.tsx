"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ensureStudySetDb, getApprovedBank, getStudySetMeta } from "@/lib/client/studySetDb";
import { quizEdit, quizPlay, quizReview, quizResults } from "@/lib/routes/studySetPaths";

function QuizOverviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" aria-busy="true" role="status">
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-5 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-24" />
        ))}
      </div>
    </div>
  );
}

export default function QuizOverviewPage() {
  const { setId } = useParams<{ setId: string }>();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await ensureStudySetDb();
      const meta = await getStudySetMeta(setId);
      const bank = await getApprovedBank(setId);
      setTitle(meta?.title ?? "Study set");
      setQuestions((bank?.questions ?? []).slice(0, 3).map((q) => q.question));
      setLoading(false);
    })();
  }, [setId]);

  if (loading) return <QuizOverviewSkeleton />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <h1 className="font-heading text-3xl font-extrabold">{title}</h1>
      <p className="text-muted-foreground">Quiz · {questions.length} preview items</p>
      <div className="space-y-2">
        {questions.map((stem, i) => (
          <div key={i} className="line-clamp-2 rounded-lg border border-border bg-card p-4">{stem}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href={quizPlay(setId)}>Start quiz</Link>
        <Link className="rounded-md border border-border px-4 py-2" href={quizReview(setId)}>Review</Link>
        <Link className="rounded-md border border-border px-4 py-2" href={quizEdit(setId)}>Edit</Link>
        <Link className="rounded-md border border-border px-4 py-2" href={quizResults(setId)}>Results</Link>
      </div>
    </div>
  );
}
