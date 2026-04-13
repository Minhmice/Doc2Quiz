import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type DevelopPreviewBatch02CardsProps = Readonly<Record<string, never>>;

export function DevelopPreviewBatch02Cards(
  {}: DevelopPreviewBatch02CardsProps,
) {
  return (
    <section id="develop-preview-cards" className="space-y-8">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Cards & feedback
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Surfaces for study-set summaries, parse status, and inline warnings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Full card</CardTitle>
            <CardDescription>Header, body, and footer actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Typical layout for a compact panel on the source or review steps.
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="button" size="sm">
              Primary
            </Button>
            <Button type="button" size="sm" variant="outline">
              Secondary
            </Button>
          </CardFooter>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-base">Small density</CardTitle>
            <CardDescription>
              <code className="text-foreground">size=&quot;sm&quot;</code> on
              Card for tighter stacks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Use where vertical space is limited (e.g. side rails).
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Alerts
        </p>
        <Alert>
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            Default alert for neutral context — configuration hints, soft
            validation.
          </AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4" aria-hidden />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            Destructive variant for failed saves, API errors, or blocked
            actions.
          </AlertDescription>
        </Alert>
        <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-50">
          <AlertTitle>Success-style (custom)</AlertTitle>
          <AlertDescription>
            No dedicated success variant — emerald utilities mirror parse-done
            cards.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  );
}
