"use client";

import { Suspense, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PageTransitionProvider } from "@/components/providers/PageTransitionProvider";
import { ThemePreferenceProvider } from "@/components/providers/ThemePreferenceProvider";
import type { ThemePreference } from "@/lib/profile/themePreference";

export function AppRootProviders({ children, initialThemePreference }: { children: ReactNode; initialThemePreference?: ThemePreference }) {
  return (
    <ThemePreferenceProvider initialPreference={initialThemePreference}>
      <TooltipProvider delay={300}>
        <Suspense fallback={children}>
          <PageTransitionProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </PageTransitionProvider>
        </Suspense>
      </TooltipProvider>
    </ThemePreferenceProvider>
  );
}
