"use client";

import { ParseProgressProvider } from "@/components/ai/ParseProgressContext";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { DisplayNameProvider } from "@/components/profile/DisplayNameProvider";

export function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ParseProgressProvider>
      <DisplayNameProvider>
        <CommandPalette />
        <AppShell>{children}</AppShell>
      </DisplayNameProvider>
    </ParseProgressProvider>
  );
}
