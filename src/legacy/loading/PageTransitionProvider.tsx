"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Doc2QuizTransitionOverlay } from "./Doc2QuizTransitionOverlay";

interface PageTransitionContextValue {
  isTransitioning: boolean;
  navigate: (href: string) => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  isTransitioning: false,
  navigate: () => {},
});

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

/** Custom hook for programmatic navigation with transition animation */
export function usePageTransitionRouter() {
  const router = useRouter();
  const { navigate } = usePageTransition();

  return {
    ...router,
    push: (href: string) => {
      navigate(href);
    },
    replace: (href: string) => {
      navigate(href);
    },
  };
}

const MIN_OVERLAY_HOLD_MS = 600; // Minimum hold duration so transition visual is enjoyed
const TIMEOUT_RECOVERY_MS = 10000; // Recovery timeout for slow connections

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Show transition overlay on initial page load / reload to cover unhydrated content
  const [showOverlay, setShowOverlay] = useState(true);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();

  const isTransitioningRef = useRef(false);
  const overlayStartTimeRef = useRef<number>(Date.now());
  const recoveryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathRef = useRef<string>(`${pathname}?${searchParams.toString()}`);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const resetTransition = useCallback(() => {
    clearRecoveryTimer();
    setIsTransitioning(false);
    setShowOverlay(false);
    isTransitioningRef.current = false;
  }, [clearRecoveryTimer]);

  // Initial page load / reload transition dismiss (ensures coverage during initial JS hydration)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, MIN_OVERLAY_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  const startTransition = useCallback(
    (href: string) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      // INSTANT COVERAGE: Turn overlay on IMMEDIATELY before navigation starts
      setShowOverlay(true);
      setIsTransitioning(true);
      overlayStartTimeRef.current = Date.now();

      // Timeout recovery after 10s for slow connections
      clearRecoveryTimer();
      recoveryTimerRef.current = setTimeout(() => {
        resetTransition();
      }, TIMEOUT_RECOVERY_MS);

      // Perform actual Next.js route navigation
      try {
        router.prefetch(href);
        router.push(href);
      } catch {
        resetTransition();
      }
    },
    [clearRecoveryTimer, resetTransition, router]
  );

  // Monitor route completion (pathname or searchParams changes)
  // Keeps overlay active on slow connections until destination route renders!
  useEffect(() => {
    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (currentUrl !== previousPathRef.current) {
      previousPathRef.current = currentUrl;

      if (isTransitioningRef.current) {
        const overlayElapsed = overlayStartTimeRef.current
          ? Date.now() - overlayStartTimeRef.current
          : MIN_OVERLAY_HOLD_MS;

        const remainingHold = Math.max(0, MIN_OVERLAY_HOLD_MS - overlayElapsed);

        setTimeout(() => {
          resetTransition();
        }, remainingHold);
      }
    }
  }, [pathname, searchParams, resetTransition]);

  // Click & hover prefetch interceptor for <a> tags
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }
      if (href.startsWith("#")) return;

      try {
        const targetUrl = new URL(href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }
      } catch {
        if (href === pathname) return;
      }

      e.preventDefault();
      startTransition(href);
    };

    // Auto-prefetch routes on hover for faster load caching
    const handlePointerOver = (e: PointerEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("//") && !href.startsWith("#")) {
        try {
          router.prefetch(href);
        } catch {
          // Prefetch fail-safe
        }
      }
    };

    const handlePopState = () => {
      if (isTransitioningRef.current) {
        resetTransition();
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("pointerover", handlePointerOver, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("pointerover", handlePointerOver, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname, startTransition, resetTransition, router]);

  return (
    <PageTransitionContext.Provider
      value={{
        isTransitioning,
        navigate: startTransition,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={
            isReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 12, scale: 0.98, filter: "blur(4px)" }
          }
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={
            isReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.97, filter: "blur(4px)" }
          }
          transition={{
            duration: isReducedMotion ? 0.05 : 0.35,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="w-full min-h-full"
        >
          {children}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showOverlay && <Doc2QuizTransitionOverlay />}
      </AnimatePresence>
    </PageTransitionContext.Provider>
  );
}
