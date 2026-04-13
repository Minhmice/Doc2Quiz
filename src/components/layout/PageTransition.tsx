"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type PageTransitionProps = {
  children: React.ReactNode;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/**
 * Route segment fade-in on pathname change. Plain `div` + CSS opacity only (no
 * Framer `transform`) so `position: sticky` inside pages still respects `main`.
 * Do not use `flex-1` here: as `main`'s flex child it would fill the viewport
 * and prevent `main` from gaining scrollable overflow when page content is tall.
 * Used from `app/(app)/template.tsx` so the shell (top bar) stays stable.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      key={pathname}
      className={cn(
        "flex w-full min-w-0 flex-col",
        !reduceMotion && "d2q-route-transition",
      )}
    >
      {children}
    </div>
  );
}
