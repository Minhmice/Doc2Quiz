import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DevelopPreviewBatch01ButtonsProps = Readonly<Record<string, never>>;

export function DevelopPreviewBatch01Buttons(
  {}: DevelopPreviewBatch01ButtonsProps,
) {
  return (
    <section id="develop-preview-buttons" className="space-y-8">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Buttons & badges
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Primary actions, quiet surfaces, and compact chrome used across
          Doc2Quiz.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variants</CardTitle>
          <CardDescription>
            <code className="text-foreground">Button</code> from{" "}
            <code className="text-foreground">@/components/ui/button</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button">Default</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Button type="button" variant="ghost">
            Ghost
          </Button>
          <Button type="button" variant="destructive">
            Destructive
          </Button>
          <Button type="button" variant="link">
            Link
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sizes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" size="xs">
            Extra small
          </Button>
          <Button type="button" size="sm">
            Small
          </Button>
          <Button type="button" size="default">
            Default
          </Button>
          <Button type="button" size="lg">
            Large
          </Button>
          <Button type="button" size="icon" aria-label="Add">
            +
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">As child + Link</CardTitle>
          <CardDescription>
            Renders as anchor while keeping button styles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="#develop-preview-buttons"
            className={cn(
              buttonVariants({ variant: "default", size: "default" }),
              "inline-flex gap-1.5",
            )}
          >
            Jump to top of section
            <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </CardContent>
      </Card>
    </section>
  );
}
