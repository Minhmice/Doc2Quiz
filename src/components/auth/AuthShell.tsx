import type { ReactNode } from "react";

import { AuthBrandAside } from "@/components/auth/AuthBrandAside";
import { AuthMobileHeader } from "@/components/auth/AuthMobileHeader";
import { cn } from "@/lib/utils";

export function AuthShell({
  children,
  className,
}: Readonly<{
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh md:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <AuthBrandAside />
        <div className="relative flex min-h-dvh flex-col">
          <AuthMobileHeader />
          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 md:py-12">
            <div
              className={cn(
                "w-full max-w-[420px] rounded-sm bg-card p-6 sm:p-8",
                "shadow-[0_24px_48px_-18px_color-mix(in_srgb,var(--foreground)_12%,transparent)]",
                className,
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
