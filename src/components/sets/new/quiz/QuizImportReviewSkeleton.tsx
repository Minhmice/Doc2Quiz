"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ImportMcqCardShell } from "@/components/sets/new/import/ImportMcqCardShell";
import { cn } from "@/lib/utils";

export function quizImportSkeletonCount(pageCount: number | null): number {
  if (pageCount === null || pageCount < 1) {
    return 6;
  }
  return Math.min(15, Math.max(4, Math.ceil(pageCount / 2)));
}

export type QuizImportQuestionCardSkeletonProps = Readonly<{
  className?: string;
}>;

/** Single MCQ-shaped placeholder inside the same shell as import preview cards. */
export function QuizImportQuestionCardSkeleton({
  className,
}: QuizImportQuestionCardSkeletonProps) {
  return (
    <ImportMcqCardShell
      className={className}
      headerLeft={
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
      }
      headerRight={
        <div className="flex gap-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-14" />
        </div>
      }
    >
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-3 w-[75%]" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </ImportMcqCardShell>
  );
}

export type QuizImportReviewSkeletonProps = Readonly<{
  count: number;
  className?: string;
}>;

/** Stacked question-card placeholders only (no navigator strip). */
export function QuizImportReviewSkeleton({
  count,
  className,
}: QuizImportReviewSkeletonProps) {
  const n = Math.min(15, Math.max(3, count));

  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: n }, (_, i) => (
        <QuizImportQuestionCardSkeleton key={i} />
      ))}
    </div>
  );
}
