import Link from "next/link";

import { AuthGhostGrid } from "@/components/auth/AuthGhostGrid";
import { AuthThemeToggle } from "@/components/auth/AuthThemeToggle";

export function AuthBrandAside() {
  return (
    <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-muted/40 px-8 py-10 md:flex lg:px-12 lg:py-12">
      <AuthGhostGrid />
      <div className="relative z-[1] flex flex-col gap-10">
        <Link
          href="/"
          className="group flex w-fit items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-foreground shadow-sm"
            aria-hidden
          >
            D2
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-heading text-lg font-extrabold tracking-tight text-[var(--d2q-blue)]">
              Doc2Quiz
            </span>
            <span className="font-label mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              PDF → study content
            </span>
          </div>
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-accent-foreground lg:text-4xl">
            Study mode,
            <span className="text-primary"> structured.</span>
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground lg:text-base">
            Blueprint-style layout: grid lines, forest greens, coral accent — same spirit as{" "}
            <code className="font-label text-xs text-foreground/80">example/stitch_doc2quiz</code>.
          </p>
        </div>
      </div>
      <div className="relative z-[1] flex items-center justify-between gap-4">
        <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Doc2Quiz · cloud study sets
        </p>
        <AuthThemeToggle />
      </div>
    </aside>
  );
}
