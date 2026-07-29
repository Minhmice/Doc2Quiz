"use client";

import { Suspense, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PageTransitionProvider } from "@/components/providers/PageTransitionProvider";

export function AppRootProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={300}>
      <Suspense fallback={children}>
        <PageTransitionProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </PageTransitionProvider>
      </Suspense>
    </TooltipProvider>
  );
}
