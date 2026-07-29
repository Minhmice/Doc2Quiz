"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, Loader2, Maximize2 } from "lucide-react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";
import { Doc2QuizAnimatedLoading } from "@/components/processing/doc2quiz-animated-loading";

export type ConversionStepStatus = "pending" | "active" | "complete";

export type ConversionStep = Readonly<{
  key: string;
  label: string;
  status: ConversionStepStatus;
}>;

export type ConversionProgressShellProps = Readonly<{
  title: string;
  subtitle?: string;
  meta?: string;
  steps?: readonly ConversionStep[];
  error?: boolean;
  showBar?: boolean;
  footer?: ReactNode;
  slang?: ReactNode;
  className?: string;
}>;

function ConversionProgressBar({ active, label }: { active: boolean; label: string }) {
  if (!active) {
    return null;
  }

  return (
    <div
      className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="d2q-conversion-bar relative h-full w-full overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 w-[36%] rounded-full bg-primary"
          aria-hidden
        />
        <span
          className="d2q-conversion-shimmer absolute inset-0 motion-reduce:hidden"
          aria-hidden
        />
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: ConversionStepStatus }) {
  if (status === "complete") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-chart-2/15 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-reduce:animate-none">
        <Check className="size-3 text-chart-2" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-pulse motion-reduce:animate-none"
          aria-hidden
        />
        <Loader2
          className="relative size-3.5 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span
      className="size-5 shrink-0 rounded-full border border-border/70"
      aria-hidden
    />
  );
}

export function ConversionProgressStepList({
  steps,
  label,
}: {
  steps: readonly ConversionStep[];
  label: string;
}) {
  return (
    <ol className="mt-4 space-y-1.5" aria-label={label}>
      {steps.map((step, index) => {
        const isActive = step.status === "active";

        return (
          <li
            key={step.key}
            className={cn(
              "d2q-step-enter flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 motion-reduce:transition-none",
              isActive && "bg-primary/8 text-foreground",
              step.status === "complete" && "text-foreground",
              step.status === "pending" && "text-muted-foreground",
            )}
            style={{ "--i": index } as CSSProperties}
          >
            <StepIcon status={step.status} />
            <span className={cn(isActive && "font-medium")}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ConversionProgressShell({
  title,
  subtitle,
  meta,
  steps = [],
  error = false,
  showBar = true,
  footer,
  slang,
  className,
}: ConversionProgressShellProps) {
  const { messages } = useLocale();
  const [showFullScreen, setShowFullScreen] = useState(false);
  const hasActiveStep = steps.some((step) => step.status === "active");
  const barActive = !error && showBar && (hasActiveStep || steps.length === 0);

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card",
          error && "border-destructive/30 bg-destructive/5",
          className,
        )}
        aria-busy={!error && (hasActiveStep || steps.length === 0)}
      >
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              {meta ? (
                <p className="text-xs font-medium tabular-nums text-muted-foreground">
                  {meta}
                </p>
              ) : null}
              <p
                className={cn(
                  "text-lg font-bold tracking-tight text-balance text-foreground",
                  meta && "mt-1",
                  error && "text-destructive",
                )}
                aria-live="polite"
              >
                {title}
              </p>
            </div>

            {/* Expand to Full-Screen High-Octane Loading Mode */}
            {!error && barActive && (
              <button
                type="button"
                onClick={() => setShowFullScreen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white font-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Expand to Fullscreen Panic Loading View"
              >
                <Maximize2 className="size-3.5" />
                <span>Panic View</span>
              </button>
            )}
          </div>

          {subtitle ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
              {subtitle}
            </p>
          ) : null}

          {!error && slang ? <div>{slang}</div> : null}

          <ConversionProgressBar active={barActive} label={messages.progress.processing} />

          {steps.length > 0 ? (
            <ConversionProgressStepList steps={steps} label={messages.progress.steps} />
          ) : null}

          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
      </div>

      {/* Full Screen High Octane Overlay */}
      {showFullScreen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-background">
          <Doc2QuizAnimatedLoading
            documentTitle={title}
            onBack={() => setShowFullScreen(false)}
          />
        </div>
      )}
    </>
  );
}
