"use client";

import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function AuthThemeToggle() {
  return (
    <div className="shrink-0 [&_button]:border-border/60 [&_button]:bg-card/80 [&_button]:backdrop-blur-sm">
      <ThemeToggle />
    </div>
  );
}
