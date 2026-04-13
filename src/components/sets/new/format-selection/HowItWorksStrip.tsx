import { Fragment } from "react";
import { ArrowRight } from "lucide-react";

export type HowItWorksStripProps = Readonly<{
  className?: string;
}>;

const steps = [
  { label: "1. Choose format", active: true },
  { label: "2. Upload PDF", active: false },
  { label: "3. Review AI draft", active: false },
  { label: "4. Start studying", active: false },
] as const;

export function HowItWorksStrip({ className }: HowItWorksStripProps) {
  return (
    <div
      className={`mb-10 border-y border-border/20 py-4${className ? ` ${className}` : ""}`}
    >
      <p className="font-label flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground md:text-xs">
        <span className="text-border">How it works:</span>
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 ? (
              <ArrowRight
                className="size-3 shrink-0 opacity-40"
                aria-hidden
              />
            ) : null}
            <span
              className={
                step.active
                  ? "font-bold text-chart-2"
                  : "text-muted-foreground/60"
              }
            >
              {step.label}
            </span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
