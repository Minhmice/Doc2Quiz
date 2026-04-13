"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared shell for import draft preview + skeleton (matches review `QuestionCard` layout + import accent). */
export const importMcqCardChrome =
  "scroll-mt-24 overflow-hidden rounded-xl border border-border/80 border-l-4 border-l-d2q-accent bg-card shadow-md ring-1 ring-foreground/10";

export type ImportMcqCardShellProps = Readonly<{
  headerLeft: ReactNode;
  headerRight: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}>;

export function ImportMcqCardShell({
  headerLeft,
  headerRight,
  children,
  className,
  id,
  "aria-label": ariaLabel,
}: ImportMcqCardShellProps) {
  return (
    <Card
      id={id}
      className={cn(importMcqCardChrome, className)}
      aria-label={ariaLabel}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex min-w-0 flex-col gap-1">{headerLeft}</div>
        <div className="flex flex-wrap gap-2">{headerRight}</div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm text-card-foreground">
        {children}
      </CardContent>
    </Card>
  );
}
