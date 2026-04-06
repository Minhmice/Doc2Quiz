"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppRootProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={300}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
