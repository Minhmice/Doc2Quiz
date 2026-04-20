import { cn } from "@/lib/utils";

export function AuthGhostGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.22]",
        className,
      )}
      style={{
        backgroundImage: `
          linear-gradient(to right, color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    />
  );
}
