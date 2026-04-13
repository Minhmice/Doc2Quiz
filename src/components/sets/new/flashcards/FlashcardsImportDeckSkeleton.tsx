"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function flashcardsImportSkeletonCount(pageCount: number | null): number {
  if (pageCount === null || pageCount < 1) {
    return 8;
  }
  return Math.min(20, Math.max(6, Math.ceil(pageCount * 1.2)));
}

export type FlashcardsImportDeckSkeletonProps = Readonly<{
  count: number;
  className?: string;
}>;

export function FlashcardsImportDeckSkeleton({
  count,
  className,
}: FlashcardsImportDeckSkeletonProps) {
  const n = Math.min(20, Math.max(4, count));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl bg-muted/40 p-4 ring-1 ring-border/60">
        <Skeleton className="mb-3 h-3 w-32" />
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {Array.from({ length: n }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" aria-hidden />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
