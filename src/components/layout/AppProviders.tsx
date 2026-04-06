"use client";

import { ParseProgressProvider } from "@/components/ai/ParseProgressContext";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/layout/CommandPalette";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ParseProgressProvider>
      <CommandPalette />
      <AppShell>{children}</AppShell>
    </ParseProgressProvider>
  );
}
