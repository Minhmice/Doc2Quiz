"use client";

import { ParseProgressProvider } from "@/components/ai/ParseProgressContext";
import { AppShell } from "@/components/layout/AppShell";
import { AppStatusDock } from "@/components/layout/AppStatusDock";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ParseProgressProvider>
      <AppShell>{children}</AppShell>
      <AppStatusDock />
    </ParseProgressProvider>
  );
}
