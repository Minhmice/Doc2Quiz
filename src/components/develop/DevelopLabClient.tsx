"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DevelopLabClient() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 py-8">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Develop
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          UI component preview for Doc2Quiz: local-only building blocks and
          patterns. These sections are not production routes; they exist so
          design and behavior stay consistent while features ship elsewhere.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="font-heading text-base text-amber-800 dark:text-amber-300">
            Preview batches archived
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-400">
            The preview-batch components (Buttons, Cards, Forms, Overlays,
            Layout) have been archived and are no longer rendered here. Source
            code is preserved at{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
              src/components-legacy/develop/preview-batches
            </code>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/80 shadow-sm" size="sm">
        <CardHeader>
          <CardTitle className="font-heading text-base">Legacy mocks</CardTitle>
          <CardDescription>
            Static HTML reference pages still live under{" "}
            <code className="text-foreground">example/</code> in the repo; they
            are no longer embedded in this develop view.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
