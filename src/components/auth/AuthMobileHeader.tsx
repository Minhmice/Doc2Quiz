import Link from "next/link";

import { AuthThemeToggle } from "@/components/auth/AuthThemeToggle";

export function AuthMobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur-xl md:hidden">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-bold text-primary-foreground"
          aria-hidden
        >
          D2
        </span>
        <span className="font-heading text-base font-extrabold tracking-tight text-[var(--d2q-blue)]">
          Doc2Quiz
        </span>
      </Link>
      <AuthThemeToggle />
    </header>
  );
}
