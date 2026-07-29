"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { GlobalNavigationLoadingScreen } from "@/components/layout/GlobalNavigationLoadingScreen";

interface NavigationLoadingContextValue {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext);
}

const DELAY_MS = 0; // Show loading immediately on navigation trigger
const MIN_DURATION_MS = 350; // Minimum 350ms display duration once visible

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const previousPathRef = useRef<string>(`${pathname}?${searchParams.toString()}`);

  const startLoading = useCallback(() => {
    // Clear any existing timers
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);

    setIsLoading(true);
    startTimeRef.current = Date.now();
  }, []);

  const stopLoading = useCallback(() => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, MIN_DURATION_MS - elapsed);

      minDurationTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        startTimeRef.current = null;
      }, remaining);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Detect when pathname or searchParams change (Route transition completes)
  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (currentUrl !== previousPathRef.current) {
      previousPathRef.current = currentUrl;
      stopLoading();
    }
  }, [pathname, searchParams, stopLoading]);

  // Click event listener for link navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return; // Only primary clicks
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // Modifier clicks

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external, download, hash-only, and blank target links
      if (target.getAttribute("target") === "_blank") return;
      if (target.hasAttribute("download")) return;
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      if (href.startsWith("#")) return;

      // Check if it's the exact same route
      try {
        const targetUrl = new URL(href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search &&
          (targetUrl.hash !== currentUrl.hash || targetUrl.href === currentUrl.href)
        ) {
          return;
        }
      } catch {
        // Fallback check
        if (href === pathname) return;
      }

      startLoading();
    };

    const handlePopState = () => {
      startLoading();
    };

    const handleSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLFormElement;
      if (!target || target.getAttribute("target") === "_blank") return;
      startLoading();
    };

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("submit", handleSubmit, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("submit", handleSubmit, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname, startLoading]);

  return (
    <NavigationLoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      {children}
      <AnimatePresence>
        {isLoading && <GlobalNavigationLoadingScreen />}
      </AnimatePresence>
    </NavigationLoadingContext.Provider>
  );
}
