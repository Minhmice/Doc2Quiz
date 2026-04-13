"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DevelopPreviewBatch01Buttons } from "./preview-batches/DevelopPreviewBatch01Buttons";
import { DevelopPreviewBatch02Cards } from "./preview-batches/DevelopPreviewBatch02Cards";
import { DevelopPreviewBatch03Forms } from "./preview-batches/DevelopPreviewBatch03Forms";
import { DevelopPreviewBatch04Overlays } from "./preview-batches/DevelopPreviewBatch04Overlays";
import { DevelopPreviewBatch05Layout } from "./preview-batches/DevelopPreviewBatch05Layout";

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

      <DevelopPreviewBatch01Buttons />
      <Separator />
      <DevelopPreviewBatch02Cards />
      <Separator />
      <DevelopPreviewBatch03Forms />
      <Separator />
      <DevelopPreviewBatch04Overlays />
      <Separator />
      <DevelopPreviewBatch05Layout />

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
