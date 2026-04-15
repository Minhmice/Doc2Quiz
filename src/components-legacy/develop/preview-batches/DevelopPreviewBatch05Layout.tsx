"use client";

import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type DevelopPreviewBatch05LayoutProps = Readonly<Record<string, never>>;

export function DevelopPreviewBatch05Layout(
  {}: DevelopPreviewBatch05LayoutProps,
) {
  return (
    <section id="develop-preview-layout" className="space-y-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Layout & navigation
      </h2>

      <div className="space-y-4 rounded-xl border border-border/80 bg-card/40 p-4 ring-1 ring-foreground/5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nested tabs
        </p>
        <Tabs defaultValue="overview" className="gap-3">
          <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm text-muted-foreground">
            Sample overview panel for layout previews.
          </TabsContent>
          <TabsContent value="details" className="text-sm text-muted-foreground">
            Sample details panel — swap for real content in production screens.
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Progress (static value)
        </p>
        <Progress value={62} className="max-w-md">
          <ProgressLabel>Parse status</ProgressLabel>
          <ProgressValue />
        </Progress>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Skeleton loaders
        </p>
        <div className="flex max-w-md flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-[60%] max-w-[12rem]" />
              <Skeleton className="h-3 w-full max-w-[20rem]" />
            </div>
          </div>
          <Skeleton className="h-24 w-full max-w-lg rounded-lg" />
        </div>
      </div>
    </section>
  );
}
