"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";

import { useLocale } from "@/components/locale/LocaleProvider";
import { cn } from "@/lib/utils";

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
      <span className="block h-full w-2/5 rounded-full bg-primary" aria-hidden />
    </div>
  );
}

function StepIcon({ status }: { status: ConversionStepStatus }) {
  if (status === "complete") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-chart-2/15">
        <Check className="size-3 text-chart-2" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === "active") {
    return (
      <span
        className="size-5 shrink-0 rounded-full border-2 border-primary bg-primary/10"
        aria-hidden
      />
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
      {steps.map((step) => {
        const isActive = step.status === "active";

        return (
          <li
            key={step.key}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
              isActive && "bg-primary/8 text-foreground",
              step.status === "complete" && "text-foreground",
              step.status === "pending" && "text-muted-foreground",
            )}
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
  const hasActiveStep = steps.some((step) => step.status === "active");
  const barActive = !error && showBar && (hasActiveStep || steps.length === 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card",
        error && "border-destructive/30 bg-destructive/5",
        className,
      )}
      aria-busy={!error && (hasActiveStep || steps.length === 0)}
    >
      <div className="px-5 py-5">
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
  );
}
